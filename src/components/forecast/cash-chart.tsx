"use client";

import { useEffect, useRef, useState } from "react";
import type { ForecastInputs, ForecastResult } from "@/lib/calc/forecast";

const money = (v: number) => (v < 0 ? "-$" : "$") + Math.abs(Math.round(v)).toLocaleString("en-US");
const short = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "-" : "";
  return s + "$" + (a >= 1e6 ? (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M" : a >= 1e3 ? Math.round(a / 1e3) + "K" : Math.round(a));
};
const day = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayY = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const NICE = [1e3, 2e3, 2.5e3, 5e3, 1e4, 2e4, 2.5e4, 5e4, 1e5, 2e5, 2.5e5, 5e5, 1e6, 2e6, 2.5e6, 5e6, 1e7];

/** Headline tiles and the closing-cash line, with the buffer, the weeks under it and the lowest point marked. */
export function CashOverview({ res, inp }: { res: ForecastResult; inp: ForecastInputs }) {
  const c = res.cash.map((x) => x.closing);
  const n = c.length;
  if (!n) return null;
  let lo = 0;
  c.forEach((v, i) => { if (v < c[lo]) lo = i; });
  const under = c.filter((v) => v < inp.cashBuffer).length;
  const firstUnder = c.findIndex((v) => v < inp.cashBuffer);
  const tiles: { k: string; v: string; s: string; bad?: boolean }[] = [
    { k: "Lowest closing cash", v: money(c[lo]), s: `week of ${dayY(res.weeks[lo].start)} (${res.weeks[lo].isoLabel})`, bad: c[lo] < inp.cashBuffer },
    { k: `Weeks under the ${short(inp.cashBuffer)} buffer`, v: String(under), s: under ? `first in the week of ${day(res.weeks[firstUnder].start)}, of ${n} weeks` : "cash stays above the buffer", bad: under > 0 },
    { k: "Peak unpaid card balance", v: money(res.summary.peakCard), s: inp.cardLimit ? `limit ${money(inp.cardLimit)}; uncapped it would reach ${short(res.summary.peakCardUncapped)}` : "no card limit set" },
    { k: "Cash at the end of the plan", v: money(c[n - 1]), s: `week of ${dayY(res.weeks[n - 1].start)}, from ${money(inp.cashOnHand)} at the start` },
  ];
  return (
    <div className="space-y-3">
      <div className="card grid grid-cols-2 lg:grid-cols-4 overflow-hidden">
        {tiles.map((t, i) => (
          <div key={t.k} className={`px-5 py-4 min-w-0 border-line ${i % 2 ? "border-l" : ""} ${i >= 2 ? "border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
            <div className="text-xs text-dim">{t.k}</div>
            <div className={`text-[1.35rem] font-semibold tabular-nums tracking-tight mt-0.5 ${t.bad ? "text-bad" : "text-ink"}`}>{t.v}</div>
            <div className="text-xs text-mute">{t.s}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="px-5 pt-4">
          <div className="text-sm font-medium text-ink">Closing cash by week</div>
          <p className="text-xs text-dim mt-0.5">Plan figures from your inputs, not bank balances. The dashed line is the minimum buffer you set.</p>
        </div>
        <CashLine res={res} buffer={inp.cashBuffer} />
        <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 pb-4 text-xs text-dim">
          <span className="inline-flex items-center gap-2"><i className="inline-block w-4 h-0.5 rounded bg-gold" />Closing cash</span>
          <span className="inline-flex items-center gap-2"><i className="inline-block w-4 border-t border-dashed border-mute" />Minimum buffer, {short(inp.cashBuffer)}</span>
          <span className="inline-flex items-center gap-2"><i className="inline-block w-2.5 h-2.5 rounded-full bg-bad" />Weeks under the buffer</span>
        </div>
      </div>
    </div>
  );
}

function CashLine({ res, buffer }: { res: ForecastResult; buffer: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(752);
  const [cur, setCur] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = Math.max(320, boxW - 32);
  const c = res.cash.map((x) => x.closing), n = c.length;
  const H = Math.round(Math.min(380, Math.max(240, W * 0.36)));
  const m = { l: 56, r: 18, t: 22, b: 30 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const max = Math.max(...c, buffer, 1), min = Math.min(0, ...c);
  const step = NICE.find((s) => (max - min) / s <= 6) ?? 1e7;
  const q = step / 4, top = Math.ceil(max / step) * step, bot = min < 0 ? -Math.ceil(-min / q) * q : 0;
  const x = (i: number) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => m.t + ih - ((v - bot) / (top - bot)) * ih;
  let lo = 0;
  c.forEach((v, i) => { if (v < c[lo]) lo = i; });

  const grid: number[] = [];
  for (let v = 0; v <= top + 1; v += step) grid.push(v);
  if (bot < 0) for (let v = -step; v >= bot; v -= step) grid.push(v);

  // label the first week that starts in each month, skipping ones too close together
  const months: { i: number; t: string }[] = [];
  let lastMonth = "", lastX = -1e9;
  res.weeks.forEach((w, i) => {
    const d = new Date(w.start + "T12:00:00Z");
    const mo = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    if (mo === lastMonth) return;
    lastMonth = mo;
    if (x(i) - lastX < 44 || x(i) > W - m.r - 16) return;
    lastX = x(i);
    months.push({ i, t: mo + (mo === "Jan" || months.length === 0 ? ` '${String(d.getUTCFullYear()).slice(-2)}` : "") });
  });

  const at = (ev: React.PointerEvent<SVGRectElement>) => {
    const r = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = ((ev.clientX - r.left) * W) / r.width;
    return Math.max(0, Math.min(n - 1, Math.round((px - m.l) / (iw / Math.max(1, n - 1)))));
  };
  const scale = (boxW - 32) / W;
  const tip = cur == null ? null : (() => {
    const w = res.weeks[cur], cw = res.cash[cur];
    const px = 16 + x(cur) * scale, tw = 220;
    const left = px + 14 + tw > boxW - 8 ? Math.max(8, px - tw - 14) : px + 14;
    return (
      <div className="absolute pointer-events-none rounded-md border border-line bg-panel px-3 py-2 text-xs shadow-lg" style={{ left, top: Math.max(8, 16 + y(c[cur]) * scale - 96), width: tw }}>
        <div className="text-ink font-medium mb-1">{w.isoLabel}, week of {dayY(w.start)}</div>
        {([["Closing cash", cw.closing], ["Net cash flow", cw.net], ["Unpaid on the card", cw.cardBalance]] as const).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-dim"><span>{k}</span><b className={`tabular-nums ${v < 0 ? "text-bad" : "text-ink"}`}>{money(v)}</b></div>
        ))}
      </div>
    );
  })();

  return (
    <div ref={box} className="relative p-4 pb-2">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Closing cash by week, from ${money(c[0])} to ${money(c[n - 1])}`} className="block overflow-visible" style={{ fontSize: 12 }}>
        {grid.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--line-strong)" : "var(--line)"} />
            <text x={m.l - 8} y={y(v) + 4} textAnchor="end" fill="var(--text-mute)" className="tabular-nums">{short(v)}</text>
          </g>
        ))}
        {months.map((t) => <text key={t.i} x={x(t.i)} y={H - 8} textAnchor={t.i === 0 ? "start" : "middle"} fill="var(--text-mute)">{t.t}</text>)}
        <line x1={m.l} x2={W - m.r} y1={y(buffer)} y2={y(buffer)} stroke="var(--text-mute)" strokeDasharray="4 4" />
        <path d={c.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")} fill="none" stroke="var(--gold)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {c.map((v, i) => (v < buffer ? <circle key={i} cx={x(i)} cy={y(v)} r={4.5} fill="var(--bad)" stroke="var(--bg-panel)" strokeWidth={2} /> : null))}
        <text x={Math.min(Math.max(x(lo), m.l + 40), W - m.r - 40)} y={Math.min(y(c[lo]) + 20, H - m.b - 4)} textAnchor="middle" fill="var(--text)" fontWeight={600}>{short(c[lo])}, {res.weeks[lo].isoLabel}</text>
        <circle cx={x(n - 1)} cy={y(c[n - 1])} r={4.5} fill="var(--gold)" stroke="var(--bg-panel)" strokeWidth={2} />
        <text x={x(n - 1) - 8} y={y(c[n - 1]) - 10} textAnchor="end" fill="var(--text)" fontWeight={600}>{short(c[n - 1])}</text>
        {cur != null && (
          <>
            <line x1={x(cur)} x2={x(cur)} y1={m.t} y2={m.t + ih} stroke="var(--text-mute)" />
            <circle cx={x(cur)} cy={y(c[cur])} r={5} fill="var(--gold)" stroke="var(--bg-panel)" strokeWidth={2} />
          </>
        )}
        <rect
          x={m.l - 10} y={m.t} width={iw + 20} height={ih} fill="transparent" tabIndex={0}
          aria-label="Weekly values. Use the left and right arrow keys."
          onPointerMove={(e) => setCur(at(e))}
          onPointerDown={(e) => setCur(at(e))}
          onPointerLeave={() => setCur(null)}
          onBlur={() => setCur(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { setCur((p) => Math.min(n - 1, (p ?? -1) + 1)); e.preventDefault(); }
            else if (e.key === "ArrowLeft") { setCur((p) => Math.max(0, p == null ? n - 1 : p - 1)); e.preventDefault(); }
            else if (e.key === "Escape") setCur(null);
          }}
        />
      </svg>
      {tip}
    </div>
  );
}
