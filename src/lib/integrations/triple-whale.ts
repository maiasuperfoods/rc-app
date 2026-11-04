import type { DailyBusinessMetrics } from "@/lib/types";
import { plainError, type Connector, type TripleWhaleSync } from "./types";

/**
 * Triple Whale is the business-truth source: blended spend, new vs returning,
 * NCPA. Endpoint: POST https://api.triplewhale.com/api/v2/summary-page/get-data
 * with header x-api-key, body { shopDomain, period: { start, end }, todayHour }.
 * The summary payload is a list of metric objects; we pick the ones the WBR needs
 * and fall back to the Shopify rollup for anything missing.
 */
const BASE = "https://api.triplewhale.com/api/v2";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function summary(apiKey: string, shopDomain: string, start: string, end: string) {
  const res = await fetch(`${BASE}/summary-page/get-data`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ shopDomain, period: { start, end }, todayHour: new Date().getHours() + 1 }),
  });
  if (!res.ok) throw new Error(`triple whale ${res.status}`);
  return res.json();
}

/** Find a metric by any of its known ids in the summary payload. */
function pick(payload: any, ids: string[]): number | null {
  const list: any[] = Array.isArray(payload) ? payload : payload?.data ?? payload?.metrics ?? [];
  for (const m of list) {
    const id = String(m.id ?? m.metricId ?? m.key ?? "");
    if (ids.includes(id)) return Number(m.value ?? m.current ?? m.total ?? 0);
  }
  return null;
}

export const tripleWhale: Connector<TripleWhaleSync> = {
  async test(creds) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await summary(creds.apiKey!, creds.externalId!, today, today);
    } catch (e) {
      throw plainError("Triple Whale", e);
    }
  },

  /** One summary call per day keeps the numbers exactly as the app shows them. */
  async pull(tenantId, creds, from, to) {
    try {
      const out: DailyBusinessMetrics[] = [];
      const d = new Date(from);
      const endMs = new Date(to).getTime();
      while (d.getTime() <= endMs) {
        const day = d.toISOString().slice(0, 10);
        const p = await summary(creds.apiKey!, creds.externalId!, day, day);
        const revenue = pick(p, ["sales", "totalSales", "shopifySales"]) ?? 0;
        const orders = pick(p, ["orders", "shopifyOrders"]) ?? 0;
        const newCustomers = pick(p, ["newCustomers", "newCustomerOrders", "ncOrders"]) ?? 0;
        const adSpend = pick(p, ["blendedAds", "blendedAdSpend", "adSpend", "spend"]) ?? 0;
        const refunds = pick(p, ["refunds", "totalRefunds"]) ?? 0;
        const cogs = pick(p, ["cogs", "totalCogs", "productCost"]) ?? 0;
        out.push({ tenantId, date: day, revenue, orders, newCustomers, returningCustomers: Math.max(0, orders - newCustomers), adSpend, refunds, cogs });
        d.setUTCDate(d.getUTCDate() + 1);
        await new Promise((r) => setTimeout(r, 250)); // polite pacing
      }
      return out;
    } catch (e) {
      throw plainError("Triple Whale", e);
    }
  },
};
