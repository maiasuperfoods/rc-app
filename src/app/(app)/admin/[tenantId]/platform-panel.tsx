import type { AppContext } from "@/lib/data";
import type { Tenant } from "@/lib/types";
import { buildSnapshot } from "@/lib/snapshot";
import { Card, Pill, Stat, fmtMoney, fmtPct, fmtX, timeAgo } from "@/components/ui";
import { pctChange } from "@/lib/calc/wbr";

/** The SaaS side of a brand for coaches: this week's numbers, flags, connections, brand book, unit economics, notes. */
export async function PlatformPanel({ ctx, t }: { ctx: AppContext; t: Tenant }) {
  const [s, notes] = await Promise.all([buildSnapshot(ctx.db, t), ctx.db.notes(t.id)]);
  const m = s.week.metrics;
  const p = s.week.previous;
  const allow = s.ue.blended?.allowableCac ?? null;
  if (s.daily.length === 0 && s.ue.offers.length === 0) {
    return (
      <Card>
        <div className="p-6 text-center text-sm text-dim">
          <p className="text-ink font-medium mb-1">No platform data yet.</p>
          <p>Numbers appear once the student connects Shopify and Triple Whale, or fills in Unit Economics. Pick this brand in the sidebar switcher to browse it as the student sees it.</p>
          {s.integrations.length > 0 && <p className="mt-3 text-xs text-mute">Connections: {s.integrations.filter((i) => i.connected).map((i) => i.provider.replace("_", " ")).join(", ") || "none"}</p>}
        </div>
      </Card>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Revenue / wk" value={fmtMoney(m.revenue)} delta={pctChange(m.revenue, p.revenue)} />
        <Stat label="NCPA vs allowable" value={<span>{fmtMoney(m.ncpa)} <span className="text-dim text-base">/ {fmtMoney(allow)}</span></span>} tone={allow != null ? (m.ncpa > allow ? "bad" : "good") : "neutral"} />
        <Stat label="Contribution margin" value={fmtPct(m.contributionMarginPct)} delta={pctChange(m.contributionMargin, p.contributionMargin)} />
        <Stat label="Hit rate · velocity" value={<span>{fmtPct(s.creative.hitRate)} <span className="text-dim text-base">· {s.creative.launched2w}/2wk</span></span>} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <Card title="This week's review" className="lg:col-span-2">
          <div className="space-y-3 text-sm text-ink leading-relaxed">{s.commentary.split("\n\n").map((x, i) => <p key={i}>{x}</p>)}</div>
        </Card>
        <div className="space-y-4">
          <Card title="Flags">
            {s.flags.length === 0 ? <p className="text-sm text-good">Clean.</p> : <ul className="space-y-2">{s.flags.map((f, i) => <li key={i} className="flex gap-2 text-sm"><Pill tone={f.severity === "red" ? "bad" : "warn"}>{f.severity}</Pill><span className="text-dim">{f.message}</span></li>)}</ul>}
          </Card>
          <Card title="Connections">
            <ul className="space-y-1.5 text-sm">
              {s.integrations.map((i) => (
                <li key={i.provider} className="flex justify-between items-center gap-2">
                  <span className="text-dim capitalize">{i.provider.replace("_", " ")}</span>
                  <span className="flex items-center gap-2 text-xs text-mute">{i.connected && timeAgo(i.lastSyncAt)}<Pill tone={i.lastError ? "bad" : i.connected ? "good" : "mute"}>{i.lastError ? "error" : i.connected ? "ok" : "off"}</Pill></span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Brand Book" hint={`v${s.brandBook.version} · updated ${new Date(s.brandBook.updatedAt).toLocaleDateString()}`}>
          <div className="text-sm space-y-2">
            <div><span className="text-mute">Mechanism:</span> <span className="text-dim">{s.brandBook.mechanism ? s.brandBook.mechanism.slice(0, 140) + (s.brandBook.mechanism.length > 140 ? "…" : "") : "not written"}</span></div>
            <div><span className="text-mute">Avatars:</span> <span className="text-dim">{s.brandBook.avatars.map((a) => a.name).join(", ") || "none"}</span></div>
            <div><span className="text-mute">Winning angles:</span> <span className="text-dim">{s.brandBook.angles.filter((a) => a.status === "winner").map((a) => a.name).join(", ") || "none yet"}</span></div>
          </div>
        </Card>
        <Card title="Unit economics">
          {s.ue.offers.length === 0 ? <p className="text-sm text-mute">Not set up.</p> : (
            <table className="table">
              <tbody>
                {s.ue.offers.map((o) => <tr key={o.offerId}><td>{o.offerName}</td><td className="num">{fmtMoney(o.price)}</td><td className="num"><Pill tone={o.passesRule ? "good" : "bad"}>{fmtPct(o.grossMarginPct)}</Pill></td><td className="num text-gold-soft">{fmtMoney(o.allowableCac)}</td></tr>)}
              </tbody>
            </table>
          )}
          <div className="text-xs text-mute mt-2">Opex {fmtMoney(s.ue.opexMonthly)}/mo · ROAS {fmtX(m.blendedRoas)}</div>
        </Card>
        <Card title="Notes" hint="Private to coaches">
          {notes.length === 0 ? <p className="text-sm text-mute">No notes yet.</p> : (
            <ul className="space-y-3">
              {notes.slice(0, 5).map((n) => <li key={n.id} className="text-sm"><div className="text-xs text-mute">{n.authorName} · {new Date(n.createdAt).toLocaleDateString()}</div><div className="text-dim">{n.body}</div></li>)}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
