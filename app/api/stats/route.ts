import { readFile, statfs } from "fs/promises";
import os from "os";

export const dynamic = "force-dynamic"; // never cache

async function cpuSnapshot() {
  const line = (await readFile("/proc/stat", "utf8")).split("\n")[0];
  const t = line.split(/\s+/).slice(1).map(Number); // user nice sys idle iowait irq softirq...
  const idle = t[3] + t[4];
  const total = t.reduce((a, b) => a + b, 0);
  return { idle, total };
}

export async function GET() {
  // CPU %: sample /proc/stat twice ~200ms apart (stateless, no concurrency issues)
  const a = await cpuSnapshot();
  await new Promise((r) => setTimeout(r, 200));
  const b = await cpuSnapshot();
  const dTotal = b.total - a.total;
  const dIdle = b.idle - a.idle;
  const cpu = dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : 0;

  // Memory from /proc/meminfo (kB -> bytes)
  const mi: Record<string, number> = Object.fromEntries(
    (await readFile("/proc/meminfo", "utf8"))
      .split("\n")
      .map((l) => l.match(/^(\w+):\s+(\d+)/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], Number(m[2]) * 1024])
  );
  const memTotal = mi.MemTotal;
  const memUsed = memTotal - mi.MemAvailable;

  // Temp: /sys thermal zone in millidegrees C. Real sensor — trust it, ±a few °C.
  let temp: number | null = null;
  try {
    temp = Number(await readFile("/sys/class/thermal/thermal_zone0/temp", "utf8")) / 1000;
  } catch {}

  // Disk on root fs
  const fs = await statfs("/");
  const diskTotal = fs.blocks * fs.bsize;
  const diskUsed = diskTotal - fs.bfree * fs.bsize;

  return Response.json({
    cpu,
    cores: os.cpus().length,
    load: os.loadavg().map((n) => Math.round(n * 100) / 100),
    temp,
    memTotal,
    memUsed,
    diskTotal,
    diskUsed,
    uptime: os.uptime(),
    ts: Date.now(),
  });
}
