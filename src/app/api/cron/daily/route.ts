import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/jobs/auth";
import { runSync } from "@/lib/jobs/sync";
import { runProvisioning } from "@/lib/jobs/provision";
import { syncFireflies } from "@/lib/pc/mutations";

// One daily job (Hobby plans allow daily crons only): finish any backfill, refresh the last 7 days, provision new students.
// On Pro, vercel.json can point the hourly schedules at /api/cron/sync and /api/cron/provision instead.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const out: Record<string, unknown> = {};
  try { out.provision = await runProvisioning(); } catch (e) { out.provision = { error: (e as Error).message }; }
  try { out.calls = await syncFireflies(); } catch (e) { out.calls = { error: (e as Error).message }; }
  try { out.backfill = await runSync({ backfill: true }); } catch (e) { out.backfill = { error: (e as Error).message }; }
  try { out.sync = await runSync(); } catch (e) { out.sync = { error: (e as Error).message }; }
  return NextResponse.json({ ok: true, ...out });
}
