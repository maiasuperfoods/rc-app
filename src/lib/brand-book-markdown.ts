import type { BrandBook } from "@/lib/types";

/** Markdown export the student can drop into their own Claude Code project. */
export function brandBookToMarkdown(book: BrandBook, tenantName: string): string {
  const L: string[] = [];
  L.push(`# ${tenantName} — Brand Book (v${book.version})`, "", `Category: ${book.category}`, "", "## Unique mechanism", "", book.mechanism || "_not written yet_", "");
  L.push("## Avatars", "");
  for (const a of book.avatars) {
    L.push(`### ${a.name} (${a.age})`, "", a.summary, "", `**Positioning:** ${a.positioning}`, "");
    if (a.painPoints.length) L.push("Pain points:", ...a.painPoints.map((x) => `- ${x}`), "");
    if (a.desires.length) L.push("Desires:", ...a.desires.map((x) => `- ${x}`), "");
    if (a.objections.length) L.push("Objections:", ...a.objections.map((x) => `- ${x}`), "");
  }
  L.push("## Angle families", "");
  for (const an of book.angles) {
    const av = book.avatars.find((a) => a.id === an.avatarId)?.name;
    L.push(`- **${an.name}** (${an.status}${av ? `, for ${av}` : ""})`, ...an.headlines.map((h) => `  - "${h}"`));
  }
  L.push("", "## Proof inventory", "", ...book.proof.map((p) => `- [${p.type}] ${p.label} — ${p.detail}`), "");
  L.push("## Objections and answers", "", ...book.objections.map((o) => `- **${o.objection}** → ${o.answer}`), "");
  L.push("## Compliance rails (non-negotiable)", "", ...book.complianceRails.map((r) => `- ${r}`), "");
  L.push("## Ad naming convention", "", "`" + book.adNamingConvention + "`", "");
  return L.join("\n");
}

/** Flesch–Kincaid grade, used for the "6th-grade mechanism" check. */
export function readingGrade(text: string): number | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 5) return null;
  const sentences = Math.max(1, (text.match(/[.!?]+/g) ?? []).length);
  const syllables = words.reduce((a, w) => a + countSyllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}
function countSyllables(w: string) {
  const s = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return 0;
  const m = s.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, m ? m.length : 1);
}
