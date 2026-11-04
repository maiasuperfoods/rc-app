import type { DailySupportMetrics } from "@/lib/types";
import { plainError, type Connector, type CommslayerSync } from "./types";

/**
 * Commslayer's API follows the Chatwoot shape: api_access_token header,
 * /api/v1/accounts/{accountId}/reports?metric=...&type=account&since=&until=
 * (unix seconds), and /conversations with label filters for refund and
 * chargeback counts. Ticket bodies are never stored — only counts and reasons.
 */
const BASE = process.env.COMMSLAYER_API_URL ?? "https://app.commslayer.com";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function get(creds: { apiKey: string; accountId: string }, path: string, params: Record<string, string>) {
  const u = new URL(`${BASE}/api/v1/accounts/${creds.accountId}${path}`);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const res = await fetch(u, { headers: { api_access_token: creds.apiKey } });
  if (!res.ok) throw new Error(`commslayer ${res.status}`);
  return res.json();
}

const unix = (iso: string) => String(Math.floor(new Date(iso).getTime() / 1000));

export const commslayer: Connector<CommslayerSync> = {
  async test(creds) {
    try {
      await get({ apiKey: creds.apiKey!, accountId: creds.externalId! }, "/labels", {});
    } catch (e) {
      throw plainError("Commslayer", e);
    }
  },

  async pull(tenantId, creds, from, to) {
    const c = { apiKey: creds.apiKey!, accountId: creds.externalId! };
    try {
      const since = unix(from);
      const until = unix(`${to}T23:59:59Z`);
      const [count, frt, labels] = await Promise.all([
        get(c, "/reports", { metric: "conversations_count", type: "account", since, until }),
        get(c, "/reports", { metric: "avg_first_response_time", type: "account", since, until }),
        get(c, "/reports", { metric: "conversations_count", type: "label", since, until, group_by: "day" }).catch(() => []),
      ]);
      const byDay = new Map<string, DailySupportMetrics>();
      const dayOf = (ts: number | string) => new Date(Number(ts) * 1000).toISOString().slice(0, 10);
      for (const r of count ?? []) {
        const date = dayOf(r.timestamp);
        byDay.set(date, { tenantId, date, tickets: Number(r.value ?? 0), firstResponseMinutes: 0, refundRequests: 0, chargebackAlerts: 0, topReasons: [] });
      }
      for (const r of frt ?? []) {
        const row = byDay.get(dayOf(r.timestamp));
        if (row) row.firstResponseMinutes = Number(r.value ?? 0) / 60;
      }
      // Label reports: refund / chargeback labels configured by the student (names matched loosely)
      for (const r of Array.isArray(labels) ? labels : []) {
        const row = byDay.get(dayOf(r.timestamp));
        if (!row) continue;
        const name = String(r.label ?? r.name ?? "").toLowerCase();
        const v = Number(r.value ?? 0);
        if (/refund/.test(name)) row.refundRequests += v;
        if (/chargeback|dispute/.test(name)) row.chargebackAlerts += v;
        if (v) row.topReasons.push({ reason: r.label ?? r.name, count: v });
      }
      return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
    } catch (e) {
      throw plainError("Commslayer", e);
    }
  },
};
