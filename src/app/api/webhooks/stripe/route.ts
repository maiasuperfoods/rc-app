import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Entitlements come from the existing Private Circle billing. On cancel the
 * tenant is marked inactive; data is purged by the retention job after 90 days.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  if (!secret || !verify(raw, sig, secret)) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  const event = JSON.parse(raw) as { type: string; data: { object: { customer?: string; metadata?: Record<string, string>; status?: string } } };
  const db = supabaseAdmin();
  const email = event.data.object.metadata?.email;
  if (!email) return NextResponse.json({ ok: true });
  if (event.type === "customer.subscription.deleted" || (event.type === "customer.subscription.updated" && event.data.object.status === "canceled")) {
    await db.from("tenant_access").upsert({ email, active: false, cancelled_at: new Date().toISOString() });
  } else if (event.type === "customer.subscription.created" || event.type === "checkout.session.completed") {
    await db.from("tenant_access").upsert({ email, active: true, tier: event.data.object.metadata?.tier ?? "ic", cancelled_at: null });
  }
  return NextResponse.json({ ok: true });
}

function verify(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  if (!parts.t || !parts.v1) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${payload}`).digest("hex");
  return expected.length === parts.v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
