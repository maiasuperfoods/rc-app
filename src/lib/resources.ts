import { cache } from "react";
import { cookies } from "next/headers";

/**
 * Knowledge Base → Resources: the Pre-Sales Vault (advertorial breakdowns) and the
 * Post-Purchase Vault (upsell funnels). Content lives in res_* tables and the private
 * `res-media` bucket; the app reads and writes it through the token-gated `resources`
 * edge function (RESOURCES_API_URL, falling back to the kb function's host, + KB_API_TOKEN).
 */

export const PRESALE_STYLES = ["Personal Story", "Exposé", "Listicle", "Hybrid"] as const;
export type PresaleStyle = (typeof PRESALE_STYLES)[number];

export interface PresaleListItem {
  id: string;
  slug: string;
  brand_name: string;
  product_name: string;
  niche: string;
  style: PresaleStyle;
  hybrid_blend: string | null;
  live_url: string;
  headline: string;
  traffic_flow: string;
  status: "draft" | "published";
  created_at: string;
  technique_count: number;
  thumbnail: string | null;
  thumbnail_path?: string | null;
}

export interface SectionBreakdown { headline?: string; lead?: string; body?: string; bridge?: string; socialProof?: string; cta?: string }
export interface DeepBreakdown {
  coreBeliefShift?: string;
  readerJourney?: { title: string; description: string }[];
  deepDive?: { type: "framework" | "micro-technique"; name: string; description: string }[];
}
export interface PresaleBrand extends Omit<PresaleListItem, "technique_count" | "thumbnail" | "thumbnail_path"> {
  description: string;
  target_avatar: string;
  core_price: string;
  format: string;
  section_breakdown: SectionBreakdown;
  deep_copywriting_breakdown: DeepBreakdown;
  source_url: string;
  screenshots: { id: string; url: string | null; path?: string | null }[];
}

export interface PpuListItem {
  id: string;
  brand_name: string;
  core_product: string;
  niche: string;
  presenter: string;
  script_style: string;
  brand_context: PpuContext;
  status: "draft" | "published";
  upsell_count: number;
  text_only: boolean;
}
export interface PpuContext { niche?: string; coreProduct?: string; coreProductPrice?: string; totalUpsells?: number; upsellStrategy?: string; format?: string; presenter?: string }
export interface PpuUpsell {
  step: number;
  title: string;
  type: string;
  key_tactics: string[];
  script: string;
  offer_structure: { product?: string; regularPrice?: string; upsellPrice?: string; discount?: string; tiers?: string; guarantee?: string };
  psych_breakdown: { scriptStructure?: unknown[]; levers?: { name: string; quote?: string; explanation: string }[]; whyItWorks?: string };
  is_text_only: boolean;
  videos: { id: string; url: string | null }[];
  screenshots: { id: string; url: string | null; path?: string | null }[];
}
export interface PpuBrand extends Omit<PpuListItem, "upsell_count" | "text_only"> {
  upsells: PpuUpsell[];
}

function apiUrl() {
  if (process.env.RESOURCES_API_URL) return process.env.RESOURCES_API_URL;
  const kb = process.env.KB_API_URL;
  return kb ? kb.replace(/\/kb$/, "/resources") : null;
}

export const resourcesConfigured = () => Boolean(apiUrl() && process.env.KB_API_TOKEN);

async function get<T>(qs: string, fresh = false): Promise<T | null> {
  const url = apiUrl();
  const token = process.env.KB_API_TOKEN;
  if (!url || !token) return null;
  const r = await fetch(`${url}?${qs}`, { headers: { "x-kb-token": token }, ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 60, tags: ["resources"] } }) });
  if (!r.ok) return null;
  return (await r.json()) as T;
}

/** Server-only admin write. Callers must check isResourcesAdmin() first. */
export async function resourcesPost<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const url = apiUrl();
  const token = process.env.KB_API_TOKEN;
  if (!url || !token) throw new Error("Resources API is not configured");
  const r = await fetch(url, { method: "POST", headers: { "x-kb-token": token, "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${r.status})`);
  return json as T;
}

export const getPresaleList = cache(async (all = false) => (await get<PresaleListItem[]>(`view=presale-list${all ? "&all=1" : ""}`, all)) ?? []);
export const getPresale = cache(async (slug: string, all = false) => get<PresaleBrand>(`view=presale&slug=${encodeURIComponent(slug)}${all ? "&all=1" : ""}`, all));
export const getPpuList = cache(async (all = false) => (await get<PpuListItem[]>(`view=ppu-list${all ? "&all=1" : ""}`, all)) ?? []);
export const getPpu = cache(async (id: string, all = false) => get<PpuBrand>(`view=ppu&id=${encodeURIComponent(id)}${all ? "&all=1" : ""}`, all));

// ---- admin session (password → signed cookie) ----

export const ADMIN_COOKIE = "rc_res_admin";

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Cookie value derived from the admin password and a server secret, so it can't be forged or reused if the password changes. */
export async function adminCookieValue() {
  const pw = process.env.RESOURCES_ADMIN_PASSWORD;
  if (!pw) return null;
  return sha256(`${pw}:${process.env.KB_API_TOKEN ?? ""}:rc-resources-admin`);
}

export const adminConfigured = () => Boolean(process.env.RESOURCES_ADMIN_PASSWORD);

export async function isResourcesAdmin() {
  const expected = await adminCookieValue();
  if (!expected) return false;
  return (await cookies()).get(ADMIN_COOKIE)?.value === expected;
}

export const resHref = {
  hub: "/resources",
  presale: "/resources/pre-sales",
  presaleStyle: (style: string) => `/resources/pre-sales?style=${encodeURIComponent(style)}`,
  presaleBrand: (slug: string) => `/resources/pre-sales/${slug}`,
  presaleAdmin: "/resources/pre-sales/admin",
  ppu: "/resources/post-purchase",
  ppuBrand: (id: string) => `/resources/post-purchase/${id}`,
};

export const styleTone: Record<string, "gold" | "bad" | "info" | "warn" | "mute"> = {
  "Personal Story": "gold",
  "Exposé": "bad",
  "Listicle": "info",
  "Hybrid": "warn",
};
