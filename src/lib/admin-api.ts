import { supabaseServer } from "@/lib/supabase/server";

/**
 * Calls the `admin` edge function in the student-app Supabase project with the signed-in
 * user's access token. The function itself checks the caller is a coach before doing anything.
 */
export async function adminApi<T = Record<string, unknown>>(body: Record<string, unknown>, opts: { anonymous?: boolean } = {}): Promise<T> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin`;
  const headers: Record<string, string> = { "content-type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! };
  if (!opts.anonymous) {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getSession();
    if (!data.session) throw new Error("Not signed in.");
    headers.authorization = `Bearer ${data.session.access_token}`;
  }
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `Request failed (${r.status})`);
  return j;
}

/** The link a student opens to set their password: lands on /auth/confirm, which signs them in. */
export function setPasswordLink(origin: string, tokenHash: string, type: string) {
  const u = new URL("/auth/confirm", origin);
  u.searchParams.set("token_hash", tokenHash);
  u.searchParams.set("type", type);
  u.searchParams.set("next", "/auth/set-password");
  return u.toString();
}
