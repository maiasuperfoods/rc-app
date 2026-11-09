import type { NextRequest } from "next/server";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; the same header lets a coach trigger a job by hand. */
export function cronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}
