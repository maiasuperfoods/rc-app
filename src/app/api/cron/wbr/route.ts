import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorized } from "@/lib/jobs/auth";
import { runWbr } from "@/lib/jobs/wbr";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await runWbr();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
