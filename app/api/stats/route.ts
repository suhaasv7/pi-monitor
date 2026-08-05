import { readFile, statfs } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";

const pexec = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const dynamic = "force-dynamic"; // never cache

const DISK_RE = /^(mmcblk\d+|sd[a-z]|nvme\d+n\d+)$/; // whole disks, not partitions

// Counters needing a delta: per-cpu jiffies, net bytes, disk sectors.
async function snapshot() {
  const cpus = (await readFile("/proc/stat", "utf8"))
    .split("\n")
    .filter((l) => /^cpu\d*\s/.test(l))
    .map((l) => {
      const n = l.split(/\s+/).slice(1).map(Number);
      return { idle: n[3] + n[4], total: n.reduce((a, b) => a + b, 0) };
    });

  let rx = 0, tx = 0;
  for (const line of (await readFile("/proc/net/dev", "utf8")).split("\n")) {
    const m = line.match(/^\s*([^:]+):\s+(.*)$/);
    if (!m || m[1].trim() === "lo") continue;
    const f = m[2].trim().split(/\s+/).map(Number);
    rx += f[0];
    tx += f[8];
  }

  let dr = 0, dw = 0;
  try {
    for (const line of (await readFile("/proc/diskstats", "utf8")).split("\n")) {
      const f = line.trim().split(/\s+/);
      if (f.length < 10 || !DISK_RE.test(f[2])) continue;
      dr += Number(f[5]); // sectors read
      dw += Number(f[9]); // sectors written
    }
  } catch {}

  return { cpus, rx, tx, dr, dw };
}

async function tryRead(path: string) {
  try {
    return (await readFile(path, "utf8")).replace(/\0/g, "").trim();
  } catch {
    return null;
  }
}

async function vcg(...args: string[]) {
  try {
    return (await pexec("vcgencmd", args)).stdout.trim();
  } catch {
    return null;
  }
}

async function throttle() {
  const out = await vcg("get_throttled");
  if (!out) return null;
  const bits = parseInt(out.split("=")[1], 16);
  return {
    undervoltage: !!(bits & 0x1),
    freqCapped: !!(bits & 0x2),
    throttled: !!(bits & 0x4),
    tempLimit: !!(bits & 0x8),
    undervoltageEver: !!(bits & 0x10000),
    throttledEver: !!(bits & 0x40000),
  };
}

function wifi() {
  return readFile("/proc/net/wireless", "utf8")
    .then((txt) => {
      for (const l of txt.split("\n")) {
        const p = l.trim().split(/\s+/);
        if (!p[0]?.endsWith(":")) continue;
        return { iface: p[0].slice(0, -1), quality: parseFloat(p[2]), signal: parseFloat(p[3]) };
      }
      return null;
    })
    .catch(() => null);
}

function ipAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) if (i.family === "IPv4" && !i.internal) return i.address;
  }
  return null;
}

async function mounts() {
  try {
    const { stdout } = await pexec("df", ["-kP"]);
    return stdout
      .trim()
      .split("\n")
      .slice(1)
      .map((l) => {
        const p = l.trim().split(/\s+/);
        return { target: p[5], size: Number(p[1]) * 1024, used: Number(p[2]) * 1024 };
      })
      .filter(
        (m) =>
          m.size > 0 &&
          (m.target === "/" || /^\/(boot|media|mnt)/.test(m.target))
      );
  } catch {
    return [];
  }
}

async function users() {
  try {
    const { stdout } = await pexec("who");
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const p = l.split(/\s+/);
        return { user: p[0], tty: p[1], from: l.match(/\(([^)]+)\)/)?.[1] ?? null };
      });
  } catch {
    return [];
  }
}

async function fanRpm() {
  try {
    const { stdout } = await pexec("sh", [
      "-c",
      "cat /sys/class/hwmon/hwmon*/fan1_input 2>/dev/null | head -1",
    ]);
    const v = Number(stdout.trim());
    return v > 0 ? v : null;
  } catch {
    return null;
  }
}

const clockMHz = (s: string | null) => (s ? Math.round(Number(s.split("=")[1]) / 1e6) : null);

export async function GET() {
  const DT = 0.3;
  const a = await snapshot();
  await sleep(DT * 1000);
  const b = await snapshot();

  const usage = (i: number) => {
    const dt = b.cpus[i].total - a.cpus[i].total;
    const di = b.cpus[i].idle - a.cpus[i].idle;
    return dt > 0 ? (1 - di / dt) * 100 : 0;
  };
  const cpu = Math.round(usage(0) * 10) / 10;
  const perCore = a.cpus.slice(1).map((_, i) => Math.round(usage(i + 1)));

  const mi: Record<string, number> = Object.fromEntries(
    (await readFile("/proc/meminfo", "utf8"))
      .split("\n")
      .map((l) => l.match(/^(\w+):\s+(\d+)/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], Number(m[2]) * 1024])
  );

  const fs = await statfs("/");
  const diskTotal = fs.blocks * fs.bsize;

  let procs: { pid: string; cpu: number; mem: number; name: string }[] = [];
  let procCount = 0;
  try {
    const { stdout } = await pexec("ps", ["-eo", "pid,pcpu,pmem,args", "--sort=-pcpu"]);
    const lines = stdout.trim().split("\n").slice(1);
    procCount = lines.length;
    procs = lines.slice(0, 10).map((l) => {
      const p = l.trim().split(/\s+/);
      const name = p.slice(3).join(" ").split("/").pop() || p.slice(3).join(" ");
      return { pid: p[0], cpu: Number(p[1]), mem: Number(p[2]), name };
    });
  } catch {}

  const freqKHz = await tryRead("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq");
  const tempRaw = await tryRead("/sys/class/thermal/thermal_zone0/temp");
  const voltStr = await vcg("measure_volts", "core");
  const osRelease = (await tryRead("/etc/os-release"))?.match(/PRETTY_NAME="?([^"\n]+)"?/)?.[1] ?? null;

  return Response.json({
    host: {
      model: (await tryRead("/proc/device-tree/model")) ?? os.hostname(),
      hostname: os.hostname(),
      kernel: os.release(),
      arch: os.arch(),
      os: osRelease,
      ip: ipAddress(),
    },
    cpu,
    perCore,
    coreCount: perCore.length || os.cpus().length,
    freqMHz: freqKHz ? Math.round(Number(freqKHz) / 1000) : null,
    gpuMHz: clockMHz(await vcg("measure_clock", "core")),
    volt: voltStr ? parseFloat(voltStr.split("=")[1]) : null,
    load: os.loadavg().map((n) => Math.round(n * 100) / 100),
    temp: tempRaw ? Number(tempRaw) / 1000 : null,
    memTotal: mi.MemTotal,
    memUsed: mi.MemTotal - mi.MemAvailable,
    swapTotal: mi.SwapTotal ?? 0,
    swapUsed: (mi.SwapTotal ?? 0) - (mi.SwapFree ?? 0),
    diskTotal,
    diskUsed: diskTotal - fs.bfree * fs.bsize,
    mounts: await mounts(),
    net: { rx: Math.max(0, (b.rx - a.rx) / DT), tx: Math.max(0, (b.tx - a.tx) / DT) },
    diskIO: { read: Math.max(0, ((b.dr - a.dr) * 512) / DT), write: Math.max(0, ((b.dw - a.dw) * 512) / DT) },
    wifi: await wifi(),
    uptime: os.uptime(),
    procCount,
    procs,
    health: await throttle(),
    users: await users(),
    fanRpm: await fanRpm(),
    ts: Date.now(),
  });
}
