import type { BrandBook, Flag, Tenant, WbrMetrics } from "@/lib/types";

/**
 * WBR commentary through the Anthropic API when ANTHROPIC_API_KEY is set,
 * otherwise the deterministic template. The prompt only ever receives this
 * tenant's own numbers and Brand Book.
 */
export async function generateCommentary(args: { tenant: Tenant; brandBook: BrandBook; metrics: WbrMetrics; previous: WbrMetrics; allowableNcpa: number | null; flags: Flag[]; fallback: string }): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || process.env.DEMO_MODE === "true") return args.fallback;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
        max_tokens: 700,
        system:
          "You write the Monday weekly business review for a direct-to-consumer brand run by a non-technical founder in a coaching program. Use the program's vocabulary: NCPA (new customer acquisition cost), allowable NCPA, contribution margin, the 85% rule, stage (Grind/Validation/Acceleration/Expansion), one ad / one avatar / one offer. Plain language, no jargon, no bullet points, four short paragraphs max. Only use numbers that appear in the facts. End with one concrete decision for this week.",
        messages: [
          {
            role: "user",
            content: `FACTS (the only numbers you may use):\n${args.fallback}\n\nBRAND CONTEXT:\nStage: ${args.tenant.stage}\nMechanism: ${args.brandBook.mechanism.slice(0, 400)}\nAvatars: ${args.brandBook.avatars.map((a) => a.name).join(", ") || "none yet"}\nWinning angles: ${args.brandBook.angles.filter((a) => a.status === "winner").map((a) => a.name).join(", ") || "none yet"}\n\nWrite the review.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return args.fallback;
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = json.content?.find((c) => c.type === "text")?.text;
    return text?.trim() || args.fallback;
  } catch {
    return args.fallback;
  }
}
