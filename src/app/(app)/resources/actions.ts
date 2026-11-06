"use server";

import { cookies } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { ADMIN_COOKIE, adminCookieValue, isResourcesAdmin, resourcesPost, resHref } from "@/lib/resources";
import { analyzeAdvertorial } from "@/lib/resources-analyze";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function guard() {
  if (!(await isResourcesAdmin())) throw new Error("Admin access required. Unlock the admin panel first.");
}
function refresh() {
  updateTag("resources");
  revalidatePath(resHref.hub, "layout");
}
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    await guard();
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

// ---- session ----

export async function unlockResourcesAdmin(password: string): Promise<Result> {
  const expected = await adminCookieValue();
  if (!expected) return { ok: false, error: "Admin isn't set up yet (RESOURCES_ADMIN_PASSWORD is missing)." };
  if (password !== process.env.RESOURCES_ADMIN_PASSWORD) return { ok: false, error: "Incorrect password." };
  (await cookies()).set(ADMIN_COOKIE, expected, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 12 });
  revalidatePath(resHref.hub, "layout");
  return { ok: true };
}

export async function lockResourcesAdmin() {
  (await cookies()).delete(ADMIN_COOKIE);
  revalidatePath(resHref.hub, "layout");
}

// ---- pre-sales vault ----

export async function analyzeAndSaveDraft(url: string) {
  return run(async () => {
    const out = await analyzeAdvertorial(url);
    return resourcesPost<{ id: string; slug: string; brand_name: string }>({ action: "presale-insert", ...out });
  });
}

export async function updatePresale(id: string, patch: Record<string, unknown>) {
  return run(() => resourcesPost({ action: "presale-update", id, patch }));
}

export async function setPresaleStatus(id: string, status: "draft" | "published", patch?: Record<string, unknown>) {
  return run(() => resourcesPost({ action: "presale-update", id, patch: { ...(patch ?? {}), status } }));
}

export async function deletePresale(id: string) {
  return run(() => resourcesPost({ action: "presale-delete", id }));
}

export async function presaleUploadUrl(brandId: string, filename: string) {
  return run(() => resourcesPost<{ path: string; signedUrl: string }>({ action: "shot-upload-url", brand_id: brandId, filename }));
}
export async function presaleRegisterShot(brandId: string, path: string) {
  return run(() => resourcesPost({ action: "shot-register", brand_id: brandId, path }));
}
export async function presaleShotFromUrl(brandId: string, url: string) {
  return run(() => resourcesPost({ action: "shot-from-url", brand_id: brandId, url }));
}
export async function presaleDeleteShot(id: string) {
  return run(() => resourcesPost({ action: "shot-delete", id }));
}

// ---- post-purchase vault ----

export async function ppuUploadUrl(brandId: string, step: number, mediaType: "video" | "screenshot", filename: string) {
  return run(() => resourcesPost<{ path: string; signedUrl: string }>({ action: "ppu-upload-url", brand_id: brandId, step, media_type: mediaType, filename }));
}
export async function ppuRegisterMedia(brandId: string, step: number, mediaType: "video" | "screenshot", path: string) {
  return run(() => resourcesPost({ action: "ppu-register", brand_id: brandId, step, media_type: mediaType, path }));
}
export async function ppuDeleteMedia(id: string) {
  return run(() => resourcesPost({ action: "ppu-media-delete", id }));
}
