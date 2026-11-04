import type { CohortRow } from "@/lib/types";
import { plainError, type Connector, type LifetimelySync } from "./types";

/**
 * Lifetimely exposes its data through an MCP server rather than a documented
 * REST API. We call the server's tools over MCP streamable HTTP (JSON-RPC):
 *   get-cohorts-table, get-repurchase-rate, get-income-statement, get-upsell-effectiveness.
 * LIFETIMELY_MCP_URL is the server URL; the student's token goes in the
 * Authorization header. If the server is unreachable the worker keeps the
 * Shopify-computed cohorts, so the WBR never goes blank.
 */
const MCP_URL = process.env.LIFETIMELY_MCP_URL ?? "https://mcp.lifetimely.io/mcp";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function callTool(token: string, name: string, args: Record<string, unknown>) {
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name, arguments: args } }),
  });
  if (!res.ok) throw new Error(`lifetimely ${res.status}`);
  const text = await res.text();
  // Streamable HTTP may answer as SSE; take the last data: line.
  const line = text.split("\n").filter((l) => l.startsWith("data:")).pop();
  const json = JSON.parse(line ? line.slice(5) : text);
  if (json.error) throw new Error(json.error.message);
  const content = json.result?.content?.find((c: any) => c.type === "text")?.text;
  return content ? JSON.parse(content) : json.result;
}

export const lifetimely: Connector<LifetimelySync> = {
  async test(creds) {
    try {
      await callTool(creds.apiKey!, "get-store-info", {});
    } catch (e) {
      throw plainError("Lifetimely", e);
    }
  },

  async pull(tenantId, creds, from, to) {
    try {
      const table = await callTool(creds.apiKey!, "get-cohorts-table", { startDate: from, endDate: to, metric: "ltv", granularity: "month" });
      const rows: any[] = table?.rows ?? table?.cohorts ?? table?.data ?? [];
      const out: CohortRow[] = rows.map((r) => {
        const v = (k: string[]) => {
          for (const key of k) if (r[key] != null) return Number(r[key]);
          return 0;
        };
        const periods: number[] = Array.isArray(r.values) ? r.values.map(Number) : [];
        const at = (i: number, fallback: number) => (periods[i] != null ? periods[i] : fallback);
        return {
          tenantId,
          cohortMonth: String(r.cohort ?? r.month ?? r.date).slice(0, 7),
          customers: v(["customers", "customer_count", "size"]),
          ltv30: at(1, v(["ltv30"])),
          ltv60: at(2, v(["ltv60"])),
          ltv90: at(3, v(["ltv90"])),
          ltv180: at(6, v(["ltv180"])),
          repurchaseRate: v(["repurchase_rate", "repurchaseRate"]) || 0,
        };
      });
      return out;
    } catch (e) {
      throw plainError("Lifetimely", e);
    }
  },
};
