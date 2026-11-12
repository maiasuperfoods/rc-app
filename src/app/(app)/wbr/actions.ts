"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/data";
import type { WbrItem, WbrItemType, WbrState } from "@/lib/types";

/** Read, change and write back the brand's review state. Only someone who can edit the brand may. */
async function mutate(fn: (s: WbrState) => void) {
  const ctx = await getContext({ requireTenant: true });
  if (!ctx.canEdit) throw new Error("Coaches can view this review but not change it.");
  const id = ctx.tenant!.id;
  const state = await ctx.db.wbrState(id);
  fn(state);
  await ctx.db.saveWbrState(id, state);
  revalidatePath("/wbr");
}

const clean = (s: string, max = 400) => String(s ?? "").trim().slice(0, max);

export async function setWbrTarget(kpi: string, value: number | null) {
  await mutate((s) => {
    if (value == null || !Number.isFinite(value)) delete s.targets[kpi];
    else s.targets[kpi] = value;
  });
}

export async function setWbrOwner(group: string, name: string) {
  await mutate((s) => {
    const v = clean(name, 80);
    if (v) s.owners[group] = v;
    else delete s.owners[group];
  });
}

export async function setWbrNote(week: string, kpi: string, text: string) {
  await mutate((s) => {
    const v = clean(text);
    s.notes[week] = s.notes[week] ?? {};
    if (v) s.notes[week][kpi] = v;
    else delete s.notes[week][kpi];
    // Keep a quarter of history; older lines have done their job.
    for (const w of Object.keys(s.notes).sort().slice(0, -13)) delete s.notes[w];
  });
}

export async function addWbrItem(input: { type: WbrItemType; title: string; owner: string; due: string | null; note: string; week: string }) {
  const title = clean(input.title, 200);
  if (!title) return;
  await mutate((s) => {
    s.items.push({ id: crypto.randomUUID(), type: input.type, title, owner: clean(input.owner, 80), due: input.due || null, status: "open", note: clean(input.note), week: input.week, createdAt: new Date().toISOString(), closedAt: null });
  });
}

export async function updateWbrItem(id: string, patch: Partial<Pick<WbrItem, "title" | "owner" | "due" | "status" | "note" | "type">>) {
  await mutate((s) => {
    const it = s.items.find((x) => x.id === id);
    if (!it) return;
    if (patch.title != null) it.title = clean(patch.title, 200) || it.title;
    if (patch.owner != null) it.owner = clean(patch.owner, 80);
    if (patch.note != null) it.note = clean(patch.note);
    if (patch.due !== undefined) it.due = patch.due || null;
    if (patch.type) it.type = patch.type;
    if (patch.status) {
      it.status = patch.status;
      it.closedAt = patch.status === "open" ? null : new Date().toISOString();
    }
  });
}

export async function deleteWbrItem(id: string) {
  await mutate((s) => {
    s.items = s.items.filter((x) => x.id !== id);
  });
}
