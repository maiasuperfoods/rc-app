import { NextResponse, type NextRequest } from "next/server";
import { getContext } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/server";
import { saveCredentials, type Provider } from "@/lib/integrations/store";
import { tripleWhale } from "@/lib/integrations/triple-whale";
import { lifetimely } from "@/lib/integrations/lifetimely";
import { commslayer } from "@/lib/integrations/commslayer";
import type { Credentials } from "@/lib/integrations/types";

const connectors = { triple_whale: tripleWhale, lifetimely, commslayer } as const;

/** Key-based connections: validate with a cheap read, then store encrypted. The key is never echoed back. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const ctx = await getContext({ requireTenant: true });
  if (ctx.demo) return NextResponse.json({ message: "Connections are disabled on demo data." }, { status: 400 });
  const connector = connectors[provider as keyof typeof connectors];
  if (!connector) return NextResponse.json({ message: "Unknown connection." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { key?: string; extra?: string };
  if (!body.key) return NextResponse.json({ message: "Paste the API key first." }, { status: 400 });
  const creds: Credentials = { apiKey: body.key.trim(), externalId: body.extra?.trim() || undefined };
  try {
    await connector.test(creds);
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : "That key didn't work." }, { status: 400 });
  }
  await saveCredentials(supabaseAdmin(), ctx.tenant!.id, provider as Provider, creds);
  return NextResponse.json({ ok: true });
}
