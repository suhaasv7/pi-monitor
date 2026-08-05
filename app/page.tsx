"use client";
import { useEffect, useState, type ReactNode } from "react";

const gb = (b: number) => (b / 1024 ** 3).toFixed(1);
const dur = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
};

// muted, glass-friendly threshold accents
const accent = (pct: number) =>
  pct > 85 ? "#ff6482" : pct > 60 ? "#ffd426" : "#5de5a0";

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 46, c = 2 * Math.PI * r;
  const col = accent(pct);
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset 0.7s ease, stroke 0.7s ease", filter: `drop-shadow(0 0 6px ${col})` }}
        />
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
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: col, boxShadow: `0 0 10px ${col}`, transition: "width 0.7s ease, background 0.7s ease" }}
      />
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

type Stats = {
  cpu: number; cores: number; load: number[]; temp: number | null;
  memTotal: number; memUsed: number; diskTotal: number; diskUsed: number; uptime: number;
};

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
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Raspberry Pi</h1>
            <p className="text-sm text-white/50">System monitor</p>
          </div>
          <span className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${err ? "bg-rose-400" : "bg-emerald-400"}`}
              style={{ boxShadow: err ? "0 0 8px #fb7185" : "0 0 8px #34d399" }} />
            {err ? "Offline" : "Live"}
          </span>
        </header>

        {!s ? (
          <div className="py-32 text-center text-white/40">{err ? "connection lost…" : "loading…"}</div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Card className="flex flex-col items-center justify-center">
                <Ring pct={s.cpu} label="CPU" />
                <span className="mt-3 text-xs text-white/40">{s.cores} cores</span>
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

            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Stat label="Disk" value={`${gb(s.diskUsed)}`} sub={`/ ${gb(s.diskTotal)} GB`}
                pct={Math.round((s.diskUsed / s.diskTotal) * 100)} />
              <Stat label="Load avg" value={s.load[0].toFixed(2)} sub={`${s.load[1]} · ${s.load[2]}`} />
              <Stat label="Uptime" value={dur(s.uptime)} />
            </div>
          </>
        )}
      </main>
    </>
  );
}
