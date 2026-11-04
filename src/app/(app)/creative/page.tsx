import Link from "next/link";
import { getContext } from "@/lib/data";
import { buildSnapshot } from "@/lib/snapshot";
import { Card, Empty, PageHeader, Pill, Stat, fmtMoney, fmtPct, fmtX } from "@/components/ui";
import { SimpleBars } from "@/components/charts";
import { CreativeTable } from "./table";
import { DEFAULT_THRESHOLDS, parseConvention } from "@/lib/calc/creative";

export default async function CreativePage() {
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const s = await buildSnapshot(ctx.db, t);
  const c = s.creative;
  const fields = parseConvention(s.brandBook.adNamingConvention);

  if (c.ads.length === 0) {
    return (
      <>
        <PageHeader title="Creative Performance" />
        <Empty title="No ads synced yet" body="Connect your Meta ad account and name your ads with the convention in the Brand Book. Every ad then lands here tagged by angle, avatar, hook and format." action={{ href: "/integrations", label: "Connect Meta" }} />
      </>
    );
  }

  const fatiguing = c.ads.filter((a) => a.status === "fatiguing");
  const iterations = c.ads
    .filter((a) => a.status === "winner" || a.status === "fatiguing")
    .slice(0, 5)
    .map((a) => ({ ad: a, next: a.status === "fatiguing" ? "Hook swap — same body, three new openers" : a.daysLive > 21 ? "Lead swap — new first 10 seconds for a second avatar" : "Format port — rebuild this angle as a different format" }));

  return (
    <>
      <PageHeader
        title="Creative Performance"
        subtitle={`Meta is used for creative diagnostics only; the business numbers live in the Weekly Review. Winner = ≥ ${fmtMoney(DEFAULT_THRESHOLDS.minSpendToJudge)} spend and ≥ ${DEFAULT_THRESHOLDS.winnerRoas.toFixed(1)}× ROAS. Fatiguing = a winner whose last-7-day ROAS dropped ${fmtPct(DEFAULT_THRESHOLDS.fatigueDrop)} or more.`}
        actions={<Link href="/brand-book" className="btn btn-ghost">Naming convention</Link>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Hit rate" value={fmtPct(c.hitRate)} hint={`${c.winners} winners of ${c.judged} judged`} formula="winners ÷ ads with enough spend to judge" tone={c.hitRate >= 0.15 ? "good" : c.hitRate >= 0.08 ? "warn" : "bad"} />
        <Stat label="Launched, last 2 weeks" value={c.velocity.slice(-2).reduce((a, v) => a + v.launched, 0)} hint="creative velocity" />
        <Stat label="Fatiguing winners" value={fatiguing.length} tone={fatiguing.length ? "warn" : "good"} hint="iterate before they die" />
        <Stat label="Ads following convention" value={fmtPct(c.conventionValidPct)} tone={c.conventionValidPct > 0.9 ? "good" : "warn"} hint={c.conventionValidPct < 1 ? "unparsed ads can't be sliced" : "every ad is sliceable"} />
      </div>

      <Card title="What printed this week" hint="Sorted by spend; the ads Meta trusted with the budget. Click a column to sort." className="mb-5">
        <CreativeTable ads={c.ads.slice(0, 15)} fields={fields} />
      </Card>
      <div className="grid lg:grid-cols-2 gap-4 mb-5">
          <Card title="Launch velocity" hint="New ads per week"><SimpleBars data={c.velocity} x="week" y="launched" label="Launched" height={200} /></Card>
          <Card title="Iteration queue" hint="Hook swap → lead swap → body → format port → rebuild">
            {iterations.length === 0 ? <p className="text-sm text-mute">Nothing to iterate until an ad clears the winner line.</p> : (
              <ul className="space-y-3">
                {iterations.map(({ ad, next }) => (
                  <li key={ad.adId} className="text-sm">
                    <div className="flex items-center gap-2"><Pill tone={ad.status === "fatiguing" ? "warn" : "good"}>{ad.status}</Pill><span className="truncate text-ink">{ad.taxonomy.angle ?? ad.adName}</span></div>
                    <div className="text-xs text-mute mt-0.5">{next}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {(["angle", "format", "hook", "stage", "creator", "avatar"] as const)
          .filter((f) => c.byField[f]?.length)
          .map((f) => (
            <Card key={f} title={`By ${f}`} hint="Single-component read. Three-way slices are unreliable under ~200 briefs.">
              <table className="table">
                <thead><tr><th>{f}</th><th className="num">Ads</th><th className="num">Spend</th><th className="num">ROAS</th><th className="num">Winners</th></tr></thead>
                <tbody>
                  {c.byField[f].slice(0, 8).map((r) => (
                    <tr key={r.value}><td>{r.value}</td><td className="num">{r.ads}</td><td className="num">{fmtMoney(r.spend)}</td><td className={`num ${r.roas >= DEFAULT_THRESHOLDS.winnerRoas ? "text-good" : ""}`}>{fmtX(r.roas)}</td><td className="num">{r.winners}</td></tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
      </div>
    </>
  );
}
