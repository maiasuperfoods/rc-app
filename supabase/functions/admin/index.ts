import { createClient } from "npm:@supabase/supabase-js@2";

// Account administration for the RC student app. The only place student accounts, brands and memberships are created.
// Coaches and admins are NOT accounts here: they live in os_members in the admin project and are verified through
// its `os-auth` function (URL + token in app_secrets, service-role only). A coach who signs in gets a shadow auth user
// in this project (random password, never used directly) so RLS and sessions work the same way as for students.
//
// POST JSON {action, ...}. Every action except `os-login` requires the caller's access token (Authorization: Bearer)
// and that the caller is a coach (row in app_roles).
//   os-login       {email, password}               verify against os_members; returns a one-time token_hash to open a session
//   invite         {email, tenantId?, brandName?}   student -> brand (new or existing). Returns token_hash for a set-password link
//   invite-coach   {email, name?}                   creates an os_members row with a temporary password (must change on first login)
//   coach-password {password}                       caller sets their own os_members password
//   coach-reset    {id}                             new temporary password for a coach
//   remove-coach   {id}                             removes a coach from os_members (and their shadow user here)
//   reset          {email}                          student: token_hash for a set-password link
//   list           {}                               brands with members, coaches (from os_members) and pending invites
//   remove         {tenantId, userId}               removes a student from a brand
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (msg: string, status = 400) => json({ error: msg }, status);
const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const randomPassword = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return [...crypto.getRandomValues(new Uint8Array(14))].map((x) => a[x % a.length]).join("");
};

async function os<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data } = await sb.from("app_secrets").select("key,value").in("key", ["OS_AUTH_URL", "OS_AUTH_TOKEN"]);
  const cfg = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  if (!cfg.OS_AUTH_URL || !cfg.OS_AUTH_TOKEN) throw new Error("Coach sign-in is not configured.");
  const r = await fetch(cfg.OS_AUTH_URL, { method: "POST", headers: { "content-type": "application/json", "x-os-token": cfg.OS_AUTH_TOKEN }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw Object.assign(new Error(j.error ?? `os-auth ${r.status}`), { status: r.status });
  return j;
}

async function userByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function caller(req: Request) {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await sb.auth.getUser(token);
  if (!data.user) return null;
  const { data: role } = await sb.from("app_roles").select("role").eq("user_id", data.user.id).maybeSingle();
  return { user: data.user, isCoach: Boolean(role), role: role?.role as string | undefined };
}

async function linkFor(email: string, kind: "invite" | "recovery" | "magiclink") {
  const { data, error } = await sb.auth.admin.generateLink({ type: kind, email });
  if (error) throw error;
  return { user: data.user, token_hash: data.properties.hashed_token, type: data.properties.verification_type ?? kind };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("method", 405);
  let body: any;
  try { body = await req.json(); } catch { return fail("bad json"); }
  try {
    if (body.action === "os-login") {
      const email = normEmail(body.email);
      const password = String(body.password ?? "");
      let m: { id: string; email: string; name: string; role: string; must_change: boolean };
      try {
        m = await os({ action: "login", email, password });
      } catch (e) {
        return fail((e as Error).message, (e as any).status === 401 ? 401 : 500);
      }
      // Shadow user: exists only so the coach has a session under RLS. Its password is random and rotated on every login.
      const existing = await userByEmail(email);
      const shadowPassword = randomPassword() + randomPassword();
      const user = existing
        ? (await sb.auth.admin.updateUserById(existing.id, { password: shadowPassword, email_confirm: true, user_metadata: { name: m.name || existing.user_metadata?.name || "" } })).data.user
        : (await sb.auth.admin.createUser({ email, password: shadowPassword, email_confirm: true, user_metadata: { name: m.name || "" } })).data.user;
      if (!user) return fail("Could not open a session.", 500);
      await sb.from("app_roles").upsert({ user_id: user.id, role: m.role === "admin" ? "admin" : "coach" });
      const link = await linkFor(email, "magiclink");
      return json({ ok: true, token_hash: link.token_hash, type: link.type, must_change: m.must_change });
    }

    const me = await caller(req);
    if (!me) return fail("Not signed in.", 401);
    if (!me.isCoach) return fail("Coach access required.", 403);

    if (body.action === "invite") {
      const email = normEmail(body.email);
      if (!validEmail(email)) return fail("Enter a valid email.");
      let tenantId: string | null = body.tenantId ?? null;
      if (!tenantId) {
        const name = String(body.brandName ?? "").trim();
        if (!name) return fail("Enter the brand name.");
        const { data: t, error } = await sb.from("tenants").insert({ name }).select("id").single();
        if (error) throw error;
        tenantId = t.id;
      }
      const existing = await userByEmail(email);
      const link = await linkFor(email, existing ? "recovery" : "invite");
      const userId = link.user?.id ?? existing?.id;
      if (!userId) return fail("Could not create the account.", 500);
      const { error } = await sb.from("tenant_members").upsert({ tenant_id: tenantId, user_id: userId, role: "student" });
      if (error) throw error;
      await sb.from("invites").insert({ email, tenant_id: tenantId, role: "student", invited_by: me.user.id });
      return json({ ok: true, tenantId, existing: Boolean(existing), token_hash: link.token_hash, type: link.type });
    }

    if (body.action === "invite-coach") {
      const email = normEmail(body.email);
      if (!validEmail(email)) return fail("Enter a valid email.");
      const password = randomPassword();
      const r = await os<{ id: string }>({ action: "create", email, name: body.name ?? "", role: "member", password });
      await sb.from("invites").insert({ email, tenant_id: null, role: "coach", invited_by: me.user.id });
      return json({ ok: true, id: r.id, email, password });
    }

    if (body.action === "coach-password") {
      const password = String(body.password ?? "");
      await os({ action: "set-password", email: me.user.email, password, must_change: false });
      return json({ ok: true });
    }

    if (body.action === "coach-reset") {
      const password = randomPassword();
      await os({ action: "set-password", id: String(body.id ?? ""), password, must_change: true });
      return json({ ok: true, password });
    }

    if (body.action === "remove-coach") {
      if (me.role !== "admin") return fail("Only an admin can remove coaches.", 403);
      const { members } = await os<{ members: { id: string; email: string }[] }>({ action: "list" });
      const target = members.find((x) => x.id === body.id);
      if (!target) return fail("No such coach.", 404);
      if (target.email === me.user.email?.toLowerCase()) return fail("You can't remove yourself.", 409);
      await os({ action: "remove", id: target.id });
      const shadow = await userByEmail(target.email);
      if (shadow) {
        await sb.from("app_roles").delete().eq("user_id", shadow.id);
        await sb.auth.admin.deleteUser(shadow.id);
      }
      return json({ ok: true });
    }

    if (body.action === "reset") {
      const email = normEmail(body.email);
      const existing = await userByEmail(email);
      if (!existing) return fail("No account with that email.", 404);
      const link = await linkFor(email, "recovery");
      return json({ ok: true, token_hash: link.token_hash, type: link.type });
    }

    if (body.action === "list") {
      const [{ data: tenants }, { data: members }, { data: invites }, coaches] = await Promise.all([
        sb.from("tenants").select("id,name,stage,active,created_at").order("created_at"),
        sb.from("tenant_members").select("tenant_id,user_id,role,created_at"),
        sb.from("invites").select("email,tenant_id,role,created_at").order("created_at", { ascending: false }).limit(200),
        os<{ members: { id: string; email: string; name: string; role: string; must_change: boolean; last_seen: string | null }[] }>({ action: "list" }).then((r) => r.members).catch(() => []),
      ]);
      const ids = new Set((members ?? []).map((m) => m.user_id));
      const users = new Map<string, { email: string; last_sign_in_at: string | null; name: string }>();
      for (let page = 1; page <= 20 && users.size < ids.size; page++) {
        const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
        for (const u of data?.users ?? []) if (ids.has(u.id)) users.set(u.id, { email: u.email ?? "", last_sign_in_at: u.last_sign_in_at ?? null, name: (u.user_metadata?.name as string) ?? "" });
        if ((data?.users ?? []).length < 200) break;
      }
      return json({
        brands: (tenants ?? []).map((t) => ({ ...t, students: (members ?? []).filter((m) => m.tenant_id === t.id).map((m) => ({ user_id: m.user_id, ...users.get(m.user_id) })) })),
        coaches: coaches.map((c) => ({ id: c.id, email: c.email, name: c.name, role: c.role === "admin" ? "admin" : "coach", must_change: c.must_change, last_sign_in_at: c.last_seen })),
        invites: invites ?? [],
        me: { email: me.user.email?.toLowerCase() ?? "", role: me.role ?? "coach" },
      });
    }

    if (body.action === "remove") {
      const { error } = await sb.from("tenant_members").delete().eq("tenant_id", body.tenantId).eq("user_id", body.userId);
      if (error) throw error;
      return json({ ok: true });
    }

    return fail("unknown action");
  } catch (e) {
    return fail(String((e as any)?.message ?? e), 500);
  }
});
