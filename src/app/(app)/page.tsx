import Link from "next/link";
import { getContext } from "@/lib/data";
import { buildSnapshot } from "@/lib/snapshot";
import { Card, Empty, PageHeader, Pill, Stat, fmtMoney, fmtPct, fmtX } from "@/components/ui";
import { RevenueSpendChart } from "@/components/charts";
import { pctChange } from "@/lib/calc/wbr";
import { redirect } from "next/navigation";

const STAGE_LABEL = { grind: "Grind", validation: "Validation", acceleration: "Acceleration", expansion: "Expansion" } as const;

export default async function HomePage() {
  const ctx = await getContext();
  if (!ctx.tenant) redirect("/onboarding");
  const t = ctx.tenant;
  if (!t.onboardingComplete && !ctx.isCoach) redirect("/onboarding");
  const s = await buildSnapshot(ctx.db, t);
  const m = s.week.metrics;
  const p = s.week.previous;
  const allowable = s.ue.blended?.allowableCac ?? null;
  const hasData = s.daily.length > 0;

  const nextActions = buildNextActions(s);

  return (
    <>
      <PageHeader
        title={t.name}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            <Pill tone="gold">{STAGE_LABEL[t.stage]} stage</Pill>
            <span>Last complete week {s.week.start} → {s.week.end}</span>
          </span>
        }
        actions={
          <Link href="/wbr" className="btn btn-secondary">
            Open weekly review
          </Link>
        }
      />

      {!hasData ? (
        <Empty title="Your numbers will appear here" body="Connect Shopify and your ad account, and the first backfill will fill this page within 24 hours. Unit Economics works right now without any connection." action={{ href: "/integrations", label: "Connect your store" }} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Stat label="Revenue" value={fmtMoney(m.revenue)} delta={pctChange(m.revenue, p.revenue)} />
            <Stat label="Blended ROAS" value={fmtX(m.blendedRoas)} delta={pctChange(m.blendedRoas, p.blendedRoas)} formula="revenue ÷ ad spend (Triple Whale)" />
            <Stat label="NCPA" value={fmtMoney(m.ncpa)} hint={allowable != null ? `allowable ${fmtMoney(allowable)}` : "set up Unit Economics"} tone={allowable != null ? (m.ncpa > allowable ? "bad" : "good") : "neutral"} formula="ad spend ÷ new customers" />
            <Stat label="Contribution margin" value={fmtMoney(m.contributionMargin)} delta={pctChange(m.contributionMargin, p.contributionMargin)} hint={`${fmtPct(m.contributionMarginPct)} of revenue`} formula="revenue − COGS − fulfillment − processing − refunds − ad spend" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-6">
            <Card title="Revenue and ad spend, last 60 days" className="lg:col-span-2">
              <RevenueSpendChart data={s.daily.slice(-60)} />
            </Card>
            <Card title="Red flags" hint="What a coach would ask about first">
              {s.flags.length === 0 ? (
                <p className="text-sm text-good">Nothing on fire. Keep shipping creative.</p>
              ) : (
                <ul className="space-y-2">
                  {s.flags.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${f.severity === "red" ? "bg-bad" : "bg-warn"}`} />
                      <span className="text-dim">{f.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Next three actions" hint={`For the ${STAGE_LABEL[t.stage]} stage`}>
          <ol className="space-y-3">
            {nextActions.map((a, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="display text-gold text-lg leading-none">{["I", "II", "III"][i]}</span>
                <div>
                  <div className="text-ink">{a.title}</div>
                  <div className="text-mute text-xs mt-0.5">{a.why}</div>
                  <Link href={a.href} className="text-gold-soft text-xs mt-1 inline-block hover:underline">
                    {a.cta} →
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Creative winners this week" hint="From the creative dashboard">
          {s.creative.winners.length === 0 ? (
            <p className="text-sm text-mute">No ad has cleared the winner line yet.</p>
          ) : (
            <ul className="space-y-2">
              {s.creative.winners.slice(0, 4).map((a) => (
                <li key={a.adId} className="text-sm flex justify-between gap-2">
                  <span className="truncate text-dim">{a.label} <span className="text-mute">· {a.strategist}</span></span>
                  <span className="tabular-nums text-good shrink-0">{fmtX(a.ncRoas)} NC</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/creative" className="text-gold-soft text-xs mt-3 inline-block hover:underline">
            Open creative dashboard →
          </Link>
        </Card>
        <Card title="Stock" hint="Next reorder decision">
          {s.forecasts.length === 0 ? (
            <p className="text-sm text-mute">Add your supplier lead times to see reorder dates.</p>
          ) : (
            <ul className="space-y-2">
              {s.forecasts.slice(0, 4).map((f) => (
                <li key={f.skuId} className="text-sm flex justify-between gap-2">
                  <span className="truncate text-dim">{f.variantTitle}</span>
                  <Pill tone={f.reorderStatus === "overdue" ? "bad" : f.reorderStatus === "soon" ? "warn" : "good"}>
                    {f.reorderStatus === "ok" ? `${f.daysOfCover ?? "90+"} d cover` : f.reorderStatus === "soon" ? `reorder by ${f.reorderByDate}` : "reorder now"}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
          <Link href="/inventory" className="text-gold-soft text-xs mt-3 inline-block hover:underline">
            Open inventory →
          </Link>
        </Card>
      </div>
    </>
  );
}

function buildNextActions(s: Awaited<ReturnType<typeof buildSnapshot>>) {
  const out: { title: string; why: string; href: string; cta: string }[] = [];
  const allowable = s.ue.blended?.allowableCac ?? null;
  if (s.ue.offers.length === 0) out.push({ title: "Enter your landed cost and offers", why: "Everything else is guesswork until the 85% rule is checked.", href: "/unit-economics", cta: "Open Unit Economics" });
  if (s.ue.offers.some((o) => !o.passesRule)) out.push({ title: "Fix the offer that fails the 85% rule", why: "Raise the price, add units, or renegotiate landed cost.", href: "/unit-economics", cta: "See which offer" });
  if (allowable != null && s.week.metrics.ncpa > allowable) out.push({ title: "Pull NCPA under allowable before adding spend", why: "Ship iterations of the current winners (hook swap first).", href: "/creative", cta: "See winners and iterations" });
  if (s.brandBook.avatars.length < 2) out.push({ title: "Write at least two avatars in the Brand Book", why: "One ad, one avatar, one offer. You need avatars to brief creative.", href: "/brand-book", cta: "Open Brand Book" });
  if (s.creative.launched2w < 4) out.push({ title: "Launch more creative this week", why: "Fewer than four new ads in two weeks. Reps over talent.", href: "/creative", cta: "See launch velocity" });
  if (s.forecasts.some((f) => f.reorderStatus !== "ok" && f.reorderStatus !== "unknown")) out.push({ title: "Place the reorder", why: "A SKU is inside its lead-time window.", href: "/inventory", cta: "Review suggested PO" });
  if (s.integrations.some((i) => !i.connected)) out.push({ title: "Connect the remaining data sources", why: "Each one unlocks a section of the weekly review.", href: "/integrations", cta: "See connections" });
  out.push({ title: "Read this week's review and leave a note for your coach", why: "The Monday ritual: numbers, then one decision.", href: "/wbr", cta: "Open review" });
  return out.slice(0, 3);
}
