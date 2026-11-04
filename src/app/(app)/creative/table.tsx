"use client";
import { useState } from "react";
import { Pill, fmtMoney, fmtPct, fmtX } from "@/components/ui";
import type { AdRollup, TaxonomyField } from "@/lib/calc/creative";

type Key = "spend" | "roas" | "purchases" | "cpa" | "thumbstopRate" | "holdRate" | "daysLive";

export function CreativeTable({ ads, fields }: { ads: AdRollup[]; fields: TaxonomyField[] }) {
  const [sort, setSort] = useState<Key>("spend");
  const [filter, setFilter] = useState<AdRollup["status"] | "all">("all");
  const rows = ads
    .filter((a) => filter === "all" || a.status === filter)
    .sort((a, b) => ((b[sort] ?? -1) as number) - ((a[sort] ?? -1) as number));
  const th = (k: Key, label: string) => (
    <th className="num cursor-pointer select-none" onClick={() => setSort(k)}>
      {label}
      {sort === k ? " ↓" : ""}
    </th>
  );
  const tone = (s: AdRollup["status"]) => (s === "winner" ? "good" : s === "fatiguing" ? "warn" : s === "loser" ? "bad" : "mute");
  const shown: TaxonomyField[] = fields.filter((f) => ["format", "hook", "creator"].includes(f));
  return (
    <div>
      <div className="flex gap-1 mb-3 flex-wrap">
        {(["all", "winner", "fatiguing", "testing", "loser"] as const).map((s) => (
          <button key={s} className={`pill ${filter === s ? "pill-gold" : "pill-mute"}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              {shown.map((f) => <th key={f}>{f}</th>)}
              {th("daysLive", "Days")}
              {th("spend", "Spend")}
              {th("purchases", "Purch.")}
              {th("cpa", "CPA")}
              {th("roas", "ROAS")}
              {th("thumbstopRate", "Thumbstop")}
              {th("holdRate", "Hold")}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.adId}>
                <td className="max-w-[220px]"><div className="truncate text-ink" title={a.adName}>{a.valid ? a.taxonomy.angle : a.adName}</div>{!a.valid && <div className="text-xs text-warn">doesn&apos;t follow convention</div>}</td>
                {shown.map((f) => <td key={f} className="text-dim">{a.taxonomy[f] ?? "—"}</td>)}
                <td className="num">{a.daysLive}</td>
                <td className="num">{fmtMoney(a.spend)}</td>
                <td className="num">{a.purchases}</td>
                <td className="num">{fmtMoney(a.cpa)}</td>
                <td className={`num font-medium ${a.roas >= 2 ? "text-good" : a.roas < 1 ? "text-bad" : ""}`}>{fmtX(a.roas)}{a.status === "fatiguing" && <span className="text-xs text-warn"> ↓{fmtX(a.roasLast7)}</span>}</td>
                <td className="num">{fmtPct(a.thumbstopRate)}</td>
                <td className="num">{fmtPct(a.holdRate)}</td>
                <td><Pill tone={tone(a.status)}>{a.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
