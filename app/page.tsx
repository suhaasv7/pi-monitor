"use client";
import { useEffect, useState, type ReactNode } from "react";

const gb = (b: number) => (b / 1024 ** 3).toFixed(1);
const rate = (b: number) =>
  b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB/s` : `${Math.round(b / 1024)} KB/s`;
const dur = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
};

const accent = (pct: number) => (pct > 85 ? "#ff6482" : pct > 60 ? "#ffd426" : "#5de5a0");

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 46, c = 2 * Math.PI * r, col = accent(pct);
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.7s ease, stroke 0.7s ease", filter: `drop-shadow(0 0 6px ${col})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums">{Math.round(pct)}</span>
        <span className="text-[11px] uppercase tracking-widest text-white/50">{label}</span>
      </div>
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  const col = accent(pct);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full"
        style={{ width: `${pct}%`, background: col, boxShadow: `0 0 10px ${col}`, transition: "width 0.7s ease, background 0.7s ease" }} />
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-3xl p-6 ${className}`}>{children}</div>;
}

function Stat({ label, value, sub, pct }: { label: string; value: string; sub?: string; pct?: number }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-widest text-white/50">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        {sub && <span className="text-sm text-white/40">{sub}</span>}
      </div>
      {pct !== undefined && <div className="mt-4"><Bar pct={pct} /></div>}
    </Card>
  );
}

type Proc = { pid: string; cpu: number; mem: number; name: string };
type Health = {
  undervoltage: boolean; freqCapped: boolean; throttled: boolean; tempLimit: boolean;
  undervoltageEver: boolean; throttledEver: boolean;
};
type Stats = {
  host: { model: string; hostname: string; kernel: string; arch: string };
  cpu: number; perCore: number[]; coreCount: number; freqMHz: number | null;
  load: number[]; temp: number | null;
  memTotal: number; memUsed: number; swapTotal: number; swapUsed: number;
  diskTotal: number; diskUsed: number;
  net: { rx: number; tx: number };
  uptime: number; procCount: number; procs: Proc[]; health: Health | null;
};

function HealthBanner({ h }: { h: Health }) {
  const now = [
    h.undervoltage && "Under-voltage",
    h.throttled && "Throttled",
    h.freqCapped && "Frequency capped",
    h.tempLimit && "Temp limit",
  ].filter(Boolean);
  const ever = [h.undervoltageEver && "under-voltage", h.throttledEver && "throttling"].filter(Boolean);

  if (now.length)
    return (
      <div className="mb-6 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-5 py-3 text-sm text-rose-200">
        ⚠️ {now.join(" · ")} right now — check your power supply / cooling.
      </div>
    );
  if (ever.length)
    return (
      <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-3 text-sm text-amber-200">
        Recovered — {ever.join(" & ")} occurred since last boot.
      </div>
    );
  return (
    <div className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-200">
      ✓ Power & thermals healthy — no throttling.
    </div>
  );
}

export default function Home() {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    const tick = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then((d) => { setS(d); setErr(false); })
        .catch(() => setErr(true));
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div className="aurora" />
      <div className="aurora-3" />
      <main className="mx-auto max-w-5xl px-6 py-14">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Raspberry Pi</h1>
            <p className="text-sm text-white/50">
              {s ? `${s.host.model} · ${s.host.arch} · kernel ${s.host.kernel}` : "System monitor"}
            </p>
          </div>
          <span className="glass flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${err ? "bg-rose-400" : "bg-emerald-400"}`}
              style={{ boxShadow: err ? "0 0 8px #fb7185" : "0 0 8px #34d399" }} />
            {err ? "Offline" : "Live"}
          </span>
        </header>

        {!s ? (
          <div className="py-32 text-center text-white/40">{err ? "connection lost…" : "loading…"}</div>
        ) : (
          <>
            {s.health && <HealthBanner h={s.health} />}

            <div className="mb-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Card className="flex flex-col items-center justify-center">
                <Ring pct={s.cpu} label="CPU" />
                <span className="mt-3 text-xs text-white/40">
                  {s.coreCount} cores{s.freqMHz ? ` · ${(s.freqMHz / 1000).toFixed(1)} GHz` : ""}
                </span>
              </Card>
              <Card className="flex flex-col items-center justify-center">
                <Ring pct={Math.round((s.memUsed / s.memTotal) * 100)} label="RAM" />
                <span className="mt-3 text-xs text-white/40">{gb(s.memUsed)} / {gb(s.memTotal)} GB</span>
              </Card>
              <Card className="flex flex-col items-center justify-center">
                <Ring pct={s.temp != null ? Math.min(s.temp, 100) : 0} label="°C" />
                <span className="mt-3 text-xs text-white/40">{s.temp != null ? `${s.temp.toFixed(1)}°C` : "n/a"}</span>
              </Card>
            </div>

            {s.perCore.length > 1 && (
              <Card className="mb-6">
                <div className="mb-4 text-xs uppercase tracking-widest text-white/50">Per-core load</div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                  {s.perCore.map((c, i) => (
                    <div key={i}>
                      <div className="mb-1 flex justify-between text-xs text-white/50">
                        <span>Core {i}</span><span className="tabular-nums">{c}%</span>
                      </div>
                      <Bar pct={c} />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="mb-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Stat label="Disk" value={gb(s.diskUsed)} sub={`/ ${gb(s.diskTotal)} GB`}
                pct={Math.round((s.diskUsed / s.diskTotal) * 100)} />
              <Stat label="Swap" value={gb(s.swapUsed)} sub={`/ ${gb(s.swapTotal)} GB`}
                pct={s.swapTotal ? Math.round((s.swapUsed / s.swapTotal) * 100) : 0} />
              <Card>
                <div className="text-xs uppercase tracking-widest text-white/50">Network</div>
                <div className="mt-2 space-y-1 text-lg font-semibold tabular-nums">
                  <div className="flex items-center gap-2"><span className="text-emerald-400">↓</span>{rate(s.net.rx)}</div>
                  <div className="flex items-center gap-2"><span className="text-sky-400">↑</span>{rate(s.net.tx)}</div>
                </div>
              </Card>
              <Stat label="Load avg" value={s.load[0].toFixed(2)} sub={`${s.load[1]} · ${s.load[2]}`} />
              <Stat label="Uptime" value={dur(s.uptime)} />
              <Stat label="Processes" value={String(s.procCount)} sub="running" />
            </div>

            {s.procs?.length > 0 && (
              <Card>
                <div className="mb-4 text-xs uppercase tracking-widest text-white/50">Top processes</div>
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-3 text-sm tabular-nums sm:grid-cols-[auto_1fr_auto_auto]">
                  <div className="hidden text-white/40 sm:block">PID</div>
                  <div className="text-white/40">Process</div>
                  <div className="text-right text-white/40">CPU</div>
                  <div className="text-right text-white/40">MEM</div>
                  {s.procs.map((p) => (
                    <div key={p.pid} className="contents">
                      <div className="hidden text-white/40 sm:block">{p.pid}</div>
                      <div className="truncate">{p.name}</div>
                      <div className="text-right" style={{ color: accent(p.cpu) }}>{p.cpu.toFixed(1)}%</div>
                      <div className="text-right text-white/70">{p.mem.toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}
