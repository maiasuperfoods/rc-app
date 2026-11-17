"use server";

import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/data";
import type { RoadmapStart, RoadmapState } from "@/lib/types";
import { ROADMAP, STARTS } from "@/lib/roadmap";

async function mutate(fn: (s: RoadmapState) => void) {
  const ctx = await getContext({ requireTenant: true });
  if (!ctx.canEdit) throw new Error("Coaches can view a student's roadmap but not change it.");
  const id = ctx.tenant!.id;
  const state = await ctx.db.roadmapState(id);
  fn(state);
  await ctx.db.saveRoadmapState(id, state);
  revalidatePath("/roadmap");
  revalidatePath("/");
}

const STEP_IDS = new Set(ROADMAP.flatMap((p) => p.steps.map((s) => s.id)));
const PHASE_IDS = new Set(ROADMAP.map((p) => p.id));

export async function setRoadmapStart(start: RoadmapStart) {
  if (!STARTS.some((s) => s.id === start)) return;
  await mutate((s) => {
    s.start = start;
    s.reopened = {}; // a new starting point resets which skipped phases were opened
  });
}

export async function setStepDone(stepId: string, done: boolean) {
  if (!STEP_IDS.has(stepId)) return;
  await mutate((s) => {
    if (done) { s.done[stepId] = new Date().toISOString(); delete s.skipped[stepId]; }
    else delete s.done[stepId];
  });
}

export async function setStepSkipped(stepId: string, skipped: boolean) {
  if (!STEP_IDS.has(stepId)) return;
  await mutate((s) => {
    if (skipped) s.skipped[stepId] = true;
    else delete s.skipped[stepId];
  });
}

/** Skip a whole phase, or bring back one that was skipped — by hand or by the starting point. */
export async function setPhaseSkipped(phaseId: string, skipped: boolean) {
  if (!PHASE_IDS.has(phaseId)) return;
  await mutate((s) => {
    if (skipped) { s.skipped[phaseId] = true; delete s.reopened[phaseId]; }
    else { delete s.skipped[phaseId]; s.reopened[phaseId] = true; }
  });
}
