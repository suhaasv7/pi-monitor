import { readFile, statfs } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";

const pexec = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const dynamic = "force-dynamic"; // never cache

// One snapshot of the counters that need a delta: per-cpu jiffies + net bytes.
async function snapshot() {
  const stat = await readFile("/proc/stat", "utf8");
  const cpus = stat
    .split("\n")
    .filter((l) => /^cpu\d*\s/.test(l)) // "cpu " (aggregate) + "cpu0", "cpu1"...
    .map((l) => {
      const n = l.split(/\s+/).slice(1).map(Number);
      return { idle: n[3] + n[4], total: n.reduce((a, b) => a + b, 0) };
    });

  let rx = 0, tx = 0;
  for (const line of (await readFile("/proc/net/dev", "utf8")).split("\n")) {
    const m = line.match(/^\s*([^:]+):\s+(.*)$/);
    if (!m || m[1].trim() === "lo") continue;
    const f = m[2].trim().split(/\s+/).map(Number);
    rx += f[0]; // received bytes
    tx += f[8]; // transmitted bytes
  }
  return { cpus, rx, tx };
}

async function tryRead(path: string) {
  try {
    return (await readFile(path, "utf8")).replace(/\0/g, "").trim();
  } catch {
    return null;
  }
}

// vcgencmd get_throttled bitmask — the Pi-specific health signal
async function throttle() {
  try {
    const { stdout } = await pexec("vcgencmd", ["get_throttled"]);
    const bits = parseInt(stdout.trim().split("=")[1], 16);
    return {
      undervoltage: !!(bits & 0x1),
      freqCapped: !!(bits & 0x2),
      throttled: !!(bits & 0x4),
      tempLimit: !!(bits & 0x8),
      undervoltageEver: !!(bits & 0x10000),
      throttledEver: !!(bits & 0x40000),
    };
  } catch {
    return null; // not a Pi / vcgencmd missing
  }
}

export async function GET() {
  const DT = 0.3;
  const a = await snapshot();
  await sleep(DT * 1000);
  const b = await snapshot();

  const usage = (i: number) => {
    const dt = b.cpus[i].total - a.cpus[i].total;
    const di = b.cpus[i].idle - a.cpus[i].idle;
    return dt > 0 ? Math.round((1 - di / dt) * 100) : 0;
  };
  const cpu = usage(0); // aggregate line
  const perCore = a.cpus.slice(1).map((_, i) => usage(i + 1));

  // Memory + swap (/proc/meminfo, kB -> bytes)
  const mi: Record<string, number> = Object.fromEntries(
    (await readFile("/proc/meminfo", "utf8"))
      .split("\n")
      .map((l) => l.match(/^(\w+):\s+(\d+)/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], Number(m[2]) * 1024])
  );

  const fs = await statfs("/");
  const diskTotal = fs.blocks * fs.bsize;

  // Top processes + process count (single ps call)
  let procs: { pid: string; cpu: number; mem: number; name: string }[] = [];
  let procCount = 0;
  try {
    const { stdout } = await pexec("ps", ["-eo", "pid,pcpu,pmem,comm", "--sort=-pcpu"]);
    const lines = stdout.trim().split("\n").slice(1);
    procCount = lines.length;
    procs = lines.slice(0, 8).map((l) => {
      const p = l.trim().split(/\s+/);
      return { pid: p[0], cpu: Number(p[1]), mem: Number(p[2]), name: p.slice(3).join(" ") };
    });
  } catch {}

  const freqKHz = await tryRead("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq");
  const tempRaw = await tryRead("/sys/class/thermal/thermal_zone0/temp");

  return Response.json({
    host: {
      model: (await tryRead("/proc/device-tree/model")) ?? os.hostname(),
      hostname: os.hostname(),
      kernel: os.release(),
      arch: os.arch(),
    },
    cpu,
    perCore,
    coreCount: perCore.length || os.cpus().length,
    freqMHz: freqKHz ? Math.round(Number(freqKHz) / 1000) : null,
    load: os.loadavg().map((n) => Math.round(n * 100) / 100),
    temp: tempRaw ? Number(tempRaw) / 1000 : null,
    memTotal: mi.MemTotal,
    memUsed: mi.MemTotal - mi.MemAvailable,
    swapTotal: mi.SwapTotal ?? 0,
    swapUsed: (mi.SwapTotal ?? 0) - (mi.SwapFree ?? 0),
    diskTotal,
    diskUsed: diskTotal - fs.bfree * fs.bsize,
    net: { rx: Math.max(0, (b.rx - a.rx) / DT), tx: Math.max(0, (b.tx - a.tx) / DT) },
    uptime: os.uptime(),
    procCount,
    procs,
    health: await throttle(),
    ts: Date.now(),
  });
}
