import { getContext } from "@/lib/data";
import { Card, PageHeader, Pill, timeAgo } from "@/components/ui";
import type { IntegrationStatus } from "@/lib/types";
import { ConnectButton } from "./connect";

const PROVIDERS: Record<IntegrationStatus["provider"], { name: string; what: string; feeds: string; auth: "oauth" | "key"; must: boolean }> = {
  shopify: { name: "Shopify", what: "Orders, products, inventory, refunds", feeds: "Unit Economics, Weekly Review, Inventory", auth: "oauth", must: true },
  meta: { name: "Meta Ads", what: "Ad-level spend, purchases, hook and hold rates", feeds: "Creative Performance", auth: "oauth", must: true },
  triple_whale: { name: "Triple Whale", what: "Blended ROAS, NCPA, new vs returning", feeds: "Weekly Review (business truth)", auth: "key", must: true },
  lifetimely: { name: "Lifetimely", what: "Cohort LTV, repurchase rate, income statement", feeds: "Weekly Review cohorts", auth: "key", must: false },
  commslayer: { name: "Commslayer", what: "Tickets, response time, refund reasons, chargeback alerts", feeds: "Weekly Review and coach flags", auth: "key", must: false },
};

export default async function IntegrationsPage() {
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const statuses = await ctx.db.integrations(t.id);
  return (
    <>
      <PageHeader title="Connections" subtitle="Connect each system once. Keys are stored encrypted and never shown again. If something stops syncing you'll see a plain-language banner here and your coach gets a heads-up." />
      <div className="grid md:grid-cols-2 gap-4">
        {statuses.map((s) => {
          const p = PROVIDERS[s.provider];
          return (
            <Card key={s.provider} title={<span className="flex items-center gap-2">{p.name}{p.must ? <Pill tone="gold">needed</Pill> : <Pill tone="mute">optional</Pill>}</span>} hint={p.what}>
              <div className="text-xs text-mute mb-3">Feeds: {p.feeds}</div>
              {s.lastError && <div className="rounded-md bg-bad-dim text-bad text-sm px-3 py-2 mb-3">{s.lastError}</div>}
              {s.backfillProgress != null && (
                <div className="mb-3">
                  <div className="text-xs text-dim mb-1">Loading your history… {Math.round(s.backfillProgress * 100)}%</div>
                  <div className="h-1.5 bg-hover rounded-full overflow-hidden"><div className="h-full bg-gold" style={{ width: `${s.backfillProgress * 100}%` }} /></div>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  {s.connected ? <Pill tone={s.lastError ? "warn" : "good"}>{s.lastError ? "Needs attention" : "Connected"}</Pill> : <Pill tone="mute">Not connected</Pill>}
                  <span className="text-xs text-mute ml-2">{s.connected ? `synced ${timeAgo(s.lastSyncAt)}` : ""}</span>
                </div>
                <ConnectButton provider={s.provider} auth={p.auth} connected={s.connected} needsReconnect={Boolean(s.lastError)} demo={ctx.demo} />
              </div>
            </Card>
          );
        })}
      </div>
      <Card title="Prefer a spreadsheet?" hint="CSV upload is the universal fallback for every connection." className="mt-4">
        <p className="text-sm text-dim">Export orders from Shopify, or your cash-flow sheet, and upload it on the Unit Economics or Inventory page. The format is the program&apos;s standard sheet; column names are matched automatically.</p>
      </Card>
    </>
  );
}
