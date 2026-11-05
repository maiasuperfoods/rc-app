import type { AdDailyInsight } from "@/lib/types";
import { plainError, type Connector, type Credentials, type MetaSync } from "./types";

const GRAPH = "https://graph.facebook.com/v21.0";
export const META_SCOPES = "ads_read";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function metaAuthUrl(state: string, redirectUri: string) {
  const u = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  u.searchParams.set("client_id", process.env.META_APP_ID!);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", META_SCOPES);
  return u.toString();
}

/** Short-lived code → long-lived (60 day) user token. */
export async function metaExchangeCode(code: string, redirectUri: string): Promise<{ token: string; expiresAt: string }> {
  const q = new URLSearchParams({ client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, redirect_uri: redirectUri, code });
  const short = await (await fetch(`${GRAPH}/oauth/access_token?${q}`)).json();
  if (!short.access_token) throw new Error("meta oauth: no token");
  const q2 = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, fb_exchange_token: short.access_token });
  const long = await (await fetch(`${GRAPH}/oauth/access_token?${q2}`)).json();
  const token = long.access_token ?? short.access_token;
  const expiresAt = new Date(Date.now() + (long.expires_in ?? 5184000) * 1000).toISOString();
  return { token, expiresAt };
}

export async function metaListAdAccounts(token: string): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${GRAPH}/me/adaccounts?fields=id,name,account_status&limit=100&access_token=${token}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return (json.data ?? []).filter((a: any) => a.account_status === 1).map((a: any) => ({ id: a.id, name: a.name }));
}

const FIELDS = ["ad_id", "ad_name", "adset_id", "adset_name", "campaign_id", "campaign_name", "spend", "impressions", "clicks", "inline_link_clicks", "actions", "action_values", "video_play_actions", "video_thruplay_watched_actions"].join(",");

export const meta: Connector<MetaSync> = {
  async test(creds) {
    try {
      const res = await fetch(`${GRAPH}/${creds.externalId}?fields=name&access_token=${creds.accessToken}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
    } catch (e) {
      throw plainError("Meta", e);
    }
  },

  /** Daily ad-level insights. Stored as snapshots; history is never re-read live. */
  async pull(tenantId, creds, from, to) {
    try {
      const out: AdDailyInsight[] = [];
      const launched = new Map<string, string>();
      let url: string | null = `${GRAPH}/${creds.externalId}/insights?level=ad&time_increment=1&fields=${FIELDS}&time_range=${encodeURIComponent(JSON.stringify({ since: from, until: to }))}&limit=500&access_token=${creds.accessToken}`;
      while (url) {
        const res: Response = await fetch(url);
        const json: any = await res.json();
        if (json.error) throw new Error(json.error.message);
        for (const r of json.data ?? []) {
          const act = (name: string) => Number((r.actions ?? []).find((a: any) => a.action_type === name)?.value ?? 0);
          const actVal = (name: string) => Number((r.action_values ?? []).find((a: any) => a.action_type === name)?.value ?? 0);
          const impressions = Number(r.impressions ?? 0);
          const plays3s = Number((r.video_play_actions ?? [])[0]?.value ?? 0);
          const thru = Number((r.video_thruplay_watched_actions ?? [])[0]?.value ?? 0);
          if (!launched.has(r.ad_id) || r.date_start < launched.get(r.ad_id)!) launched.set(r.ad_id, r.date_start);
          out.push({
            tenantId,
            date: r.date_start,
            adId: r.ad_id,
            adName: r.ad_name,
            adSetId: r.adset_id,
            adSetName: r.adset_name ?? "",
            campaignId: r.campaign_id,
            campaignName: r.campaign_name ?? "",
            status: "ACTIVE", // refreshed by the ad-status pass in the worker
            format: plays3s > 0 ? "Video" : "Static",
            thumbnailUrl: null,
            spend: Number(r.spend ?? 0),
            impressions,
            clicks: Number(r.clicks ?? 0),
            linkClicks: Number(r.inline_link_clicks ?? 0),
            metaPurchases: act("purchase") || act("omni_purchase"),
            metaRevenue: actVal("purchase") || actVal("omni_purchase"),
            // Triple Whale pixel fills these in a second pass (see worker); Meta cannot tell new from returning.
            twPurchases: 0, twRevenue: 0, ncPurchases: 0, ncRevenue: 0,
            plays3s: plays3s || null,
            thruplays: thru || null,
            newVisitors: null, uniqueVisitors: null,
            launchedAt: r.date_start,
          });
        }
        url = json.paging?.next ?? null;
      }
      // Launch date = earliest day seen for the ad in this window (the worker keeps the min across windows).
      for (const row of out) row.launchedAt = launched.get(row.adId) ?? row.date;
      return out;
    } catch (e) {
      throw plainError("Meta", e);
    }
  },
};

export const metaTest = (creds: Credentials) => meta.test(creds);
