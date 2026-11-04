import type { AdDailyInsight, CohortRow, DailyBusinessMetrics, DailySupportMetrics, InventoryPosition, Product, Sku } from "@/lib/types";

/** Decrypted credentials, only ever held in memory inside a worker. */
export interface Credentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  externalId?: string; // shop domain, ad account id, account id
  expiresAt?: string;
}

export interface ShopifySync {
  products: Product[];
  skus: Sku[];
  daily: DailyBusinessMetrics[]; // revenue, orders, refunds, cogs from Shopify (fallback for Triple Whale)
  inventory: InventoryPosition[];
  cohorts: CohortRow[]; // computed from orders when Lifetimely is absent
}

export interface Connector<T> {
  /** Validate credentials with a cheap read. Throws a plain-language Error on failure. */
  test(creds: Credentials): Promise<void>;
  /** Pull everything for [from, to] inclusive (ISO dates). Must be idempotent: the worker upserts by key. */
  pull(tenantId: string, creds: Credentials, from: string, to: string): Promise<T>;
}

export type MetaSync = AdDailyInsight[];
export type TripleWhaleSync = DailyBusinessMetrics[];
export type LifetimelySync = CohortRow[];
export type CommslayerSync = DailySupportMetrics[];

/** Wraps a provider error into something a founder can read. The raw message goes to logs only. */
export function plainError(provider: string, err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  console.error(`[${provider}]`, raw); // server logs only, never shown
  if (/401|403|unauthor|invalid.*(token|key)|expired/i.test(raw)) return new Error(`Your ${provider} connection has expired. Reconnect to resume syncing.`);
  if (/429|throttl|rate limit/i.test(raw)) return new Error(`${provider} asked us to slow down. We'll retry automatically within the hour.`);
  return new Error(`We couldn't reach ${provider} on the last sync. We'll keep retrying; if this persists, reconnect.`);
}
