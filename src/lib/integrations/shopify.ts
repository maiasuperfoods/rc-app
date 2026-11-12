import { createHmac, timingSafeEqual } from "node:crypto";
import type { CohortRow, DailyBusinessMetrics, InventoryPosition, Product, Sku } from "@/lib/types";
import { plainError, type Connector, type Credentials, type ShopifySync } from "./types";

// 2025-10 stopped being accessible on 16 Oct 2026. A request pinned to an unsupported version
// doesn't fail — Shopify quietly serves it from the oldest accessible version instead, so the app
// drifts onto a schema nobody chose. Keep this on a supported version and in step with
// `api_version` in shopify.app.toml.
const API_VERSION = "2026-10";
/**
 * Least-privilege scope set. Every scope here is exercised by the queries below:
 *   read_orders / read_all_orders  revenue, refunds, COGS, cohorts (history beyond 60 days)
 *   read_products / read_inventory products, variants, unit cost, on-hand quantities
 *   read_customers                order.customer { id, numberOfOrders } only — never name, email,
 *                                 phone or address. Needed to group orders into LTV cohorts and to
 *                                 tell new from returning customers. Protected customer data: Level 1.
 * read_locations is deliberately absent: inventory levels are summed without reading the location.
 */
export const SHOPIFY_SCOPE_LIST = ["read_orders", "read_all_orders", "read_products", "read_inventory", "read_customers"] as const;
export const SHOPIFY_SCOPES = SHOPIFY_SCOPE_LIST.join(",");

/* eslint-disable @typescript-eslint/no-explicit-any */

async function gql<T = any>(shop: string, token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-shopify-access-token": token },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`shopify ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) {
      const throttled = json.errors.some((e: any) => e.extensions?.code === "THROTTLED");
      if (throttled) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw new Error(json.errors.map((e: any) => e.message).join("; "));
    }
    return json.data as T;
  }
  throw new Error("shopify throttled");
}

/** A real myshopify domain, lower-cased. Returns null for anything else, so no attacker-supplied host is ever called. */
export function shopifyCleanShop(raw: string | null | undefined): string | null {
  const clean = String(raw ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(clean) ? clean : null;
}

/**
 * Verifies the `hmac` Shopify appends to install and callback URLs (all other query params,
 * sorted, joined as key=value pairs). Constant-time comparison.
 */
export function shopifyVerifyQueryHmac(params: URLSearchParams): boolean {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  const hmac = params.get("hmac");
  if (!secret || !hmac) return false;
  const message = [...params.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const digest = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(hmac, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Verifies a webhook body against the X-Shopify-Hmac-Sha256 header (base64 digest of the raw body). */
export function shopifyVerifyWebhook(rawBody: string, header: string | null): boolean {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret || !header) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(header, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** OAuth helpers used by the API routes. */
export function shopifyAuthUrl(shop: string, state: string, redirectUri: string) {
  const u = new URL(`https://${shop}/admin/oauth/authorize`);
  u.searchParams.set("client_id", process.env.SHOPIFY_CLIENT_ID!);
  u.searchParams.set("scope", SHOPIFY_SCOPES);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  return u.toString();
}
export async function shopifyExchangeCode(shop: string, code: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: process.env.SHOPIFY_CLIENT_ID, client_secret: process.env.SHOPIFY_CLIENT_SECRET, code }),
  });
  if (!res.ok) throw new Error(`shopify oauth ${res.status}`);
  return (await res.json()).access_token as string;
}

const PRODUCTS = `query($cursor: String) {
  products(first: 100, after: $cursor, query: "status:active") {
    pageInfo { hasNextPage endCursor }
    nodes { id title variants(first: 50) { nodes { id sku title inventoryItem { id unitCost { amount } inventoryLevels(first: 20) { nodes { quantities(names: ["available"]) { quantity } } } } } } }
  }
}`;

const ORDERS = `query($cursor: String, $q: String!) {
  orders(first: 250, after: $cursor, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id createdAt
      currentTotalPriceSet { shopMoney { amount } }
      totalRefundedSet { shopMoney { amount } }
      customer { id numberOfOrders }
      lineItems(first: 50) { nodes { quantity variant { id inventoryItem { unitCost { amount } } } } }
    }
  }
}`;

export const shopify: Connector<ShopifySync> = {
  async test(creds) {
    try {
      await gql(creds.externalId!, creds.accessToken!, `{ shop { name } }`);
    } catch (e) {
      throw plainError("Shopify", e);
    }
  },

  async pull(tenantId, creds, from, to) {
    const shop = creds.externalId!;
    const token = creds.accessToken!;
    try {
      // Products, variants, inventory and unit cost
      const products: Product[] = [];
      const skus: Sku[] = [];
      const inventory: InventoryPosition[] = [];
      let cursor: string | null = null;
      do {
        const d: any = await gql(shop, token, PRODUCTS, { cursor });
        for (const p of d.products.nodes) {
          products.push({ id: p.id, tenantId, title: p.title, shopifyProductId: p.id, active: true });
          for (const v of p.variants.nodes) {
            skus.push({ id: v.id, tenantId, productId: p.id, sku: v.sku || v.id.split("/").pop(), variantTitle: `${p.title}${v.title && v.title !== "Default Title" ? ` · ${v.title}` : ""}`, shopifyVariantId: v.id, landedCost: Number(v.inventoryItem?.unitCost?.amount ?? 0), unitsPerPack: 1 });
            const onHand = (v.inventoryItem?.inventoryLevels?.nodes ?? []).reduce((a: number, l: any) => a + (l.quantities?.[0]?.quantity ?? 0), 0);
            inventory.push({ skuId: v.id, onHand, inbound: [], dailyVelocity30: 0 });
          }
        }
        cursor = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
      } while (cursor);

      // Orders → daily rollup, SKU velocity, cohorts. Customer PII is never stored; only ids and counts.
      const daily = new Map<string, DailyBusinessMetrics>();
      const unitsBySku30 = new Map<string, number>();
      const cohort = new Map<string, { customers: Set<string>; revenueByCustomer: Map<string, { first: string; total: number; orders: number }> }>();
      const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString();
      cursor = null;
      do {
        const d: any = await gql(shop, token, ORDERS, { cursor, q: `created_at:>=${from} created_at:<=${to}T23:59:59Z financial_status:paid,partially_refunded,refunded` });
        for (const o of d.orders.nodes) {
          const date = o.createdAt.slice(0, 10);
          const row = daily.get(date) ?? { tenantId, date, revenue: 0, orders: 0, newCustomers: 0, returningCustomers: 0, adSpend: 0, refunds: 0, cogs: 0 };
          const amount = Number(o.currentTotalPriceSet.shopMoney.amount);
          row.revenue += amount;
          row.orders += 1;
          row.refunds += Number(o.totalRefundedSet.shopMoney.amount);
          const isNew = Number(o.customer?.numberOfOrders ?? 1) <= 1;
          if (isNew) row.newCustomers += 1;
          else row.returningCustomers += 1;
          for (const li of o.lineItems.nodes) {
            row.cogs += li.quantity * Number(li.variant?.inventoryItem?.unitCost?.amount ?? 0);
            if (o.createdAt >= cutoff30 && li.variant?.id) unitsBySku30.set(li.variant.id, (unitsBySku30.get(li.variant.id) ?? 0) + li.quantity);
          }
          daily.set(date, row);
          if (o.customer?.id) {
            const cid = o.customer.id;
            const month = date.slice(0, 7);
            // first-order month decides the cohort; subsequent orders accrue to that cohort
            let entry = [...cohort.values()].find((c) => c.revenueByCustomer.has(cid));
            if (!entry) {
              entry = cohort.get(month) ?? { customers: new Set(), revenueByCustomer: new Map() };
              cohort.set(month, entry);
              entry.customers.add(cid);
              entry.revenueByCustomer.set(cid, { first: date, total: 0, orders: 0 });
            }
            const c = entry.revenueByCustomer.get(cid)!;
            c.total += amount;
            c.orders += 1;
          }
        }
        cursor = d.orders.pageInfo.hasNextPage ? d.orders.pageInfo.endCursor : null;
      } while (cursor);

      for (const inv of inventory) inv.dailyVelocity30 = (unitsBySku30.get(inv.skuId) ?? 0) / 30;

      const cohorts: CohortRow[] = [...cohort.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([cohortMonth, c]) => {
          const vals = [...c.revenueByCustomer.values()];
          const n = vals.length || 1;
          const avg = vals.reduce((a, v) => a + v.total, 0) / n;
          return { tenantId, cohortMonth, customers: c.customers.size, ltv30: avg, ltv60: avg, ltv90: avg, ltv180: avg, repurchaseRate: vals.filter((v) => v.orders > 1).length / n };
        });

      return { products, skus, daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)), inventory, cohorts };
    } catch (e) {
      throw plainError("Shopify", e);
    }
  },
};
