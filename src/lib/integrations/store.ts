import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encrypt } from "@/lib/crypto";
import type { Credentials } from "./types";
import type { IntegrationStatus } from "@/lib/types";

export type Provider = IntegrationStatus["provider"];
export const PROVIDERS: Provider[] = ["shopify", "meta", "triple_whale", "lifetimely", "commslayer"];

/** Credentials are encrypted at rest; this is the only place that reads or writes them. */
export async function saveCredentials(db: SupabaseClient, tenantId: string, provider: Provider, creds: Credentials) {
  const { error } = await db.from("integrations").upsert({
    tenant_id: tenantId,
    provider,
    connected: true,
    credentials_enc: encrypt(JSON.stringify(creds)),
    external_id: creds.externalId ?? null,
    last_error: null,
    backfill_progress: 0,
  });
  if (error) throw new Error(error.message);
}

export async function loadCredentials(db: SupabaseClient, tenantId: string, provider: Provider): Promise<Credentials | null> {
  const { data, error } = await db.from("integrations").select("credentials_enc").eq("tenant_id", tenantId).eq("provider", provider).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.credentials_enc) return null;
  return JSON.parse(decrypt(data.credentials_enc)) as Credentials;
}

export async function markSync(db: SupabaseClient, tenantId: string, provider: Provider, patch: { lastError?: string | null; backfillProgress?: number | null; synced?: boolean }) {
  const row: Record<string, unknown> = {};
  if (patch.lastError !== undefined) row.last_error = patch.lastError;
  if (patch.backfillProgress !== undefined) row.backfill_progress = patch.backfillProgress;
  if (patch.synced) row.last_sync_at = new Date().toISOString();
  await db.from("integrations").update(row).eq("tenant_id", tenantId).eq("provider", provider);
}
