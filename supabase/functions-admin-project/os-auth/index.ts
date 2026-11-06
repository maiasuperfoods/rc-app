import { createClient } from "npm:@supabase/supabase-js@2";

// Coach / admin accounts for the Renaissance Commerce apps live in os_members (this project).
// This is the only way the student app touches them. Server-to-server: requires header
// x-os-token whose sha256 is listed in kb_access_tokens (label "rc-app os-auth ...").
//   login        {email, password}            -> {id, email, name, role, must_change} or 401
//   list         {}                            -> {members: [...]} (no hashes)
//   create       {email, name?, role?, password} -> {id}   (role: admin | member; must_change = true)
//   set-password {id | email, password, must_change?} -> {ok}
//   remove       {id}                          -> {ok}   (refuses the last admin)
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (msg: string, status = 400) => json({ error: msg }, status);
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("method", 405);
  const tok = req.headers.get("x-os-token") ?? "";
  const { data: ok } = await sb.from("kb_access_tokens").select("label").eq("token_sha256", await sha256(tok)).maybeSingle();
  if (!ok) return fail("forbidden", 403);
  let body: any;
  try { body = await req.json(); } catch { return fail("bad json"); }

  try {
    if (body.action === "login") {
      const email = normEmail(body.email);
      const password = String(body.password ?? "");
      if (!email || !password) return fail("Enter your email and password.", 401);
      const { data, error } = await sb.rpc("os_verify_login", { p_email: email, p_password: password });
      if (error) throw error;
      const m = data?.[0];
      if (!m) return fail("That email and password don't match.", 401);
      await sb.from("os_members").update({ last_seen: new Date().toISOString() }).eq("id", m.id);
      return json(m);
    }

    if (body.action === "list") {
      const { data, error } = await sb.from("os_members").select("id,email,name,role,must_change,created_at,last_seen").order("created_at");
      if (error) throw error;
      return json({ members: data ?? [] });
    }

    if (body.action === "create") {
      const email = normEmail(body.email);
      if (!validEmail(email)) return fail("Enter a valid email.");
      const password = String(body.password ?? "");
      if (password.length < 10) return fail("Use a password of at least 10 characters.");
      const role = body.role === "admin" ? "admin" : "member";
      const { data, error } = await sb.rpc("os_create_member", { p_email: email, p_name: String(body.name ?? "").trim(), p_role: role, p_password: password });
      if (error) throw error;
      return json({ id: data });
    }

    if (body.action === "set-password") {
      const password = String(body.password ?? "");
      if (password.length < 10) return fail("Use a password of at least 10 characters.");
      let id: string | null = body.id ?? null;
      if (!id && body.email) {
        const { data } = await sb.from("os_members").select("id").eq("email", normEmail(body.email)).maybeSingle();
        id = data?.id ?? null;
      }
      if (!id) return fail("No account with that email.", 404);
      const { error } = await sb.rpc("os_set_password", { p_id: id, p_password: password, p_must_change: Boolean(body.must_change) });
      if (error) throw error;
      return json({ ok: true, id });
    }

    if (body.action === "remove") {
      const id = String(body.id ?? "");
      const { data: target } = await sb.from("os_members").select("id,role").eq("id", id).maybeSingle();
      if (!target) return fail("No such account.", 404);
      if (target.role === "admin") {
        const { count } = await sb.from("os_members").select("id", { count: "exact", head: true }).eq("role", "admin");
        if ((count ?? 0) <= 1) return fail("You can't remove the last admin.", 409);
      }
      const { error } = await sb.from("os_members").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    return fail("unknown action");
  } catch (e) {
    return fail(String((e as any)?.message ?? e), 500);
  }
});
