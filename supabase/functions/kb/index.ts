import { createClient } from "npm:@supabase/supabase-js@2";

// Knowledge Base API for server-to-server use by the RC app (both the app and the standalone course site).
// Auth: header x-kb-token whose sha256 is listed in kb_access_tokens. The app decides who may call writes.
// GET  ?view=tree           -> categories, chapters, lesson index (no content)
// GET  ?view=sign&path=...  -> short-lived link for a display image (categories/, lesson-images/)
// GET  ?view=lesson&id=...  -> one lesson with content and a signed video URL (plus its raw fields for editing)
// POST {action, ...}        -> course editing (see postAction)
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUCKET = "kb-media";
const TTL = 60 * 60 * 6;

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function sign(path: string | null) {
  if (!path) return null;
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, TTL);
  return data?.signedUrl ?? null;
}
const bad = (msg: string, status = 400) => Response.json({ error: msg }, { status });
const safeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.slice(0, max) : undefined);
const now = () => new Date().toISOString();

const TABLE = { category: "kb_categories", chapter: "kb_chapters", lesson: "kb_lessons" } as const;
const PARENT = { category: null, chapter: "category_id", lesson: "chapter_id" } as const;
type Kind = keyof typeof TABLE;
const kindOf = (v: unknown): Kind => {
  if (v === "category" || v === "chapter" || v === "lesson") return v;
  throw new Error("unknown kind");
};

async function removeFiles(paths: (string | null | undefined)[]) {
  const p = paths.filter((x): x is string => Boolean(x));
  if (p.length) await sb.storage.from(BUCKET).remove(p);
}

async function nextOrder(kind: Kind, parentId: string | null) {
  let q = sb.from(TABLE[kind]).select("order").order("order", { ascending: false }).limit(1);
  if (PARENT[kind] && parentId) q = q.eq(PARENT[kind]!, parentId);
  const { data } = await q;
  return ((data?.[0] as { order?: number } | undefined)?.order ?? -1) + 1;
}

/** Rewrite `order` 0..n-1 for the given ids, in that order (all must share the same parent). */
async function setOrder(kind: Kind, ids: string[]) {
  await Promise.all(ids.map((id, i) => sb.from(TABLE[kind]).update({ order: i, updated_at: now() }).eq("id", id)));
}

async function postAction(body: Record<string, unknown>) {
  switch (body.action) {
    case "create": {
      const kind = kindOf(body.kind);
      const parent = PARENT[kind] ? str(body.parent_id, 64) : null;
      if (PARENT[kind] && !parent) throw new Error("parent_id is required");
      const title = (str(body.title, 300) ?? "").trim() || (kind === "lesson" ? "New lesson" : kind === "chapter" ? "New chapter" : "New category");
      const row: Record<string, unknown> = { title, order: await nextOrder(kind, parent ?? null) };
      if (PARENT[kind]) row[PARENT[kind]!] = parent;
      if (kind === "chapter" && body.icon) row.icon = str(body.icon, 16);
      if (kind === "category") row.description = str(body.description, 2000) ?? "";
      if (kind === "lesson") row.content = "";
      const { data, error } = await sb.from(TABLE[kind]).insert(row).select("id").single();
      if (error) throw error;
      return data;
    }

    case "update": {
      const kind = kindOf(body.kind);
      const p = (body.patch ?? {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = { updated_at: now() };
      if (typeof p.title === "string") {
        if (!p.title.trim()) throw new Error("Title can't be empty");
        patch.title = p.title.trim().slice(0, 300);
      }
      if (kind === "category") {
        if (typeof p.description === "string") patch.description = p.description.slice(0, 2000);
        if ("image_path" in p) {
          const { data: cur } = await sb.from(TABLE.category).select("image_path").eq("id", body.id).maybeSingle();
          const next = p.image_path === null ? null : str(p.image_path, 300);
          if (next && !next.startsWith("categories/")) throw new Error("bad path");
          patch.image_path = next;
          if (next === null) patch.image_url = null;
          if (cur?.image_path && cur.image_path !== next) await removeFiles([cur.image_path]);
        }
      }
      if (kind === "chapter" && "icon" in p) patch.icon = p.icon ? str(p.icon, 16) : null;
      if (kind === "lesson") {
        if (typeof p.content === "string") patch.content = p.content.slice(0, 1_000_000);
        if ("video_url" in p || "video_path" in p) {
          const { data: cur } = await sb.from(TABLE.lesson).select("video_path").eq("id", body.id).maybeSingle();
          const path = p.video_path ? str(p.video_path, 300) : null;
          if (path && !path.startsWith("videos/")) throw new Error("bad path");
          patch.video_path = path;
          patch.video_url = path ? null : (p.video_url ? str(p.video_url, 1000) : null);
          if (cur?.video_path && cur.video_path !== path) await removeFiles([cur.video_path]);
        }
      }
      const { error } = await sb.from(TABLE[kind]).update(patch).eq("id", body.id);
      if (error) throw error;
      return { ok: true };
    }

    case "delete": {
      const kind = kindOf(body.kind);
      const id = str(body.id, 64)!;
      // collect stored files first; rows cascade
      let lessonIds: string[] = [];
      if (kind === "lesson") lessonIds = [id];
      if (kind === "chapter") lessonIds = ((await sb.from(TABLE.lesson).select("id").eq("chapter_id", id)).data ?? []).map((r) => r.id);
      if (kind === "category") {
        const chs = ((await sb.from(TABLE.chapter).select("id").eq("category_id", id)).data ?? []).map((r) => r.id);
        lessonIds = chs.length ? ((await sb.from(TABLE.lesson).select("id").in("chapter_id", chs)).data ?? []).map((r) => r.id) : [];
        const { data: c } = await sb.from(TABLE.category).select("image_path").eq("id", id).maybeSingle();
        await removeFiles([c?.image_path]);
      }
      if (lessonIds.length) {
        const { data: vids } = await sb.from(TABLE.lesson).select("video_path").in("id", lessonIds);
        await removeFiles((vids ?? []).map((v) => v.video_path));
      }
      const { error } = await sb.from(TABLE[kind]).delete().eq("id", id);
      if (error) throw error;
      return { ok: true };
    }

    case "reorder": {
      const kind = kindOf(body.kind);
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      if (!ids.length) throw new Error("ids required");
      await setOrder(kind, ids);
      return { ok: true };
    }

    case "move": {
      // move a chapter to another category, or a lesson to another chapter (goes to the end)
      const kind = kindOf(body.kind);
      if (!PARENT[kind]) throw new Error("categories can't be moved");
      const to = str(body.parent_id, 64)!;
      const { error } = await sb.from(TABLE[kind]).update({ [PARENT[kind]!]: to, order: await nextOrder(kind, to), updated_at: now() }).eq("id", body.id);
      if (error) throw error;
      return { ok: true };
    }

    case "import-url": {
      // copy an image or short clip from a public https link (e.g. an AI generator's result) into lesson-images/
      const url = str(body.url, 2000) ?? "";
      if (!/^https:\/\//.test(url)) throw new Error("https link required");
      const r = await fetch(url);
      if (!r.ok || !r.body) throw new Error(`Could not download (${r.status})`);
      const type = (r.headers.get("content-type") ?? "").split(";")[0];
      if (!/^(image|video)\//.test(type)) throw new Error("Not an image or video");
      const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm" } as Record<string, string>)[type];
      if (!ext) throw new Error(`Unsupported type ${type}`);
      const path = `lesson-images/${crypto.randomUUID()}-${safeName(str(body.name, 80) ?? "media")}.${ext}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, r.body as unknown as ReadableStream, { contentType: type, upsert: false, duplex: "half" } as never);
      if (error) throw error;
      return { path };
    }

    case "upload-url": {
      // direct-to-storage upload, so big videos never pass through the app server
      const folder = body.purpose === "video" ? "videos" : body.purpose === "category" ? "categories" : body.purpose === "lesson-image" ? "lesson-images" : null;
      if (!folder) throw new Error("unknown purpose");
      const path = `${folder}/${crypto.randomUUID()}-${safeName(str(body.filename, 200) ?? "file")}`;
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return { path, signedUrl: data.signedUrl, token: data.token };
    }
  }
  throw new Error("unknown action");
}

Deno.serve(async (req) => {
  const tok = req.headers.get("x-kb-token") ?? "";
  const { data: ok } = await sb.from("kb_access_tokens").select("label").eq("token_sha256", await sha256(tok)).maybeSingle();
  if (!ok) return new Response("forbidden", { status: 403 });
  try {
    if (req.method === "POST") return Response.json(await postAction(await req.json()));

    const u = new URL(req.url);
    const view = u.searchParams.get("view") ?? "tree";
    if (view === "sign") {
      // short-lived link for a display image only (category art, images inside lessons); never videos
      const path = u.searchParams.get("path") ?? "";
      if (path.includes("..") || !/^(categories|lesson-images)\/[\w.-]+$/.test(path)) return bad("not allowed", 403);
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 300);
      return error || !data ? bad("not found", 404) : Response.json({ url: data.signedUrl });
    }
    if (view === "lesson") {
      const id = u.searchParams.get("id") ?? "";
      const { data: l, error } = await sb.from("kb_lessons").select("id,chapter_id,title,content,video_url,video_path,order").eq("id", id).maybeSingle();
      if (error || !l) return Response.json(null, { status: 404 });
      return Response.json({ ...l, video: (await sign(l.video_path)) ?? l.video_url });
    }

    const [cats, chs, les] = await Promise.all([
      sb.from("kb_categories").select("id,title,description,image_url,image_path,order").order("order"),
      sb.from("kb_chapters").select("id,category_id,title,icon,order").order("order"),
      sb.from("kb_lessons").select("id,chapter_id,title,order,video_url,video_path").order("order"),
    ]);
    const categories = await Promise.all((cats.data ?? []).map(async (c) => ({ ...c, image: (await sign(c.image_path)) ?? c.image_url })));
    const lessons = (les.data ?? []).map(({ video_url, video_path, ...l }) => ({ ...l, has_video: Boolean(video_url || video_path) }));
    return Response.json({ categories, chapters: chs.data ?? [], lessons }, { headers: { "cache-control": "private, max-age=60" } });
  } catch (e) {
    return bad(String((e as Error)?.message ?? e), 500);
  }
});
