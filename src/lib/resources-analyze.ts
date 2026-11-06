/**
 * Pre-Sales Vault quick upload: URL → scraped text (+ screenshot) → AI breakdown → draft row.
 * Ported from the original vault's analyze-advertorial function.
 * Needs ANTHROPIC_API_KEY. FIRECRAWL_API_KEY is optional: with it we get clean markdown and its
 * screenshot; without it we fetch the page as text and capture the screenshot with thum.io.
 */

const LANGUAGE_RULES = `
LANGUAGE & TONE RULES (VERY IMPORTANT — follow these strictly):
- Write like you're explaining things to a smart friend over coffee. Super casual. Almost conversational.
- Use simple, everyday words. If a 15-year-old wouldn't understand a word, don't use it.
- NO fancy vocabulary. NO academic-sounding sentences. NO "leverages", "utilizes", "establishes", "positions", "elevates", "cultivates", "validates", "mechanism", "paradigm", "inherent", "trajectory" etc.
- Instead of "This establishes credibility through the authority of a medical professional" → say "They use a doctor to make it feel legit and trustworthy."
- Instead of "validates the reader's pain" → say "makes the reader feel seen — like 'yeah, I've been through that too'"
- Instead of "creates urgency through scarcity framing" → say "makes you feel like you gotta act now or you'll miss out"
- Instead of "bypasses skepticism" → say "gets past your BS detector"
- Short sentences. Punchy. Like texting but smarter.
- You CAN use proper names for frameworks/techniques (like "The Doctor's Discovery Narrative") — those are fine. But the EXPLANATION of what they are and why they work must be dead simple.
- Think: "How would I explain this to my friend who knows nothing about marketing but is curious?"
`;

const MASTER_PROMPT = `You are an expert direct response copywriter and marketing psychologist. Your task is to analyze the following advertorial text and deconstruct it for a beginner-friendly educational app. Your analysis must be deep, insightful, and focus on the underlying belief engineering and copywriting frameworks, not just surface-level psychological levers.

${LANGUAGE_RULES}

Return a JSON object with this structure:

{
  "brandName": "string",
  "productName": "string",
  "niche": "string",
  "advertorialStyle": "string (one of: Personal Story, Exposé, Listicle, Hybrid. If Hybrid, specify the blend, e.g. 'Hybrid (Personal Story + Exposé)')",
  "headline": "string",
  "description": "string (1-2 sentences: what this brand does and how they use advertorials)",
  "targetAvatar": "string (who the target audience is)",
  "corePrice": "string (the main offer price if shown, else 'N/A')",
  "deepBreakdown": {
    "coreBeliefShift": "string (one sentence starting 'This advertorial shifts the reader from believing...' and ending 'to believing...')",
    "readersJourney": [{ "step": 1, "title": "string", "explanation": "string (what's happening in the reader's mind at this stage, super casual)" }],
    "frameworksAndMicroTechniques": [{ "type": "Framework | Micro-Technique", "name": "string", "explanation": "string (what it is and why it works, super casual)" }]
  },
  "sectionBreakdown": {
    "headline": "string (headline technique)",
    "lead": "string (lead / hook extension)",
    "body": "string (body / belief shift)",
    "bridge": "string (how the product is introduced)",
    "socialProof": "string (social proof elements)",
    "cta": "string (the offer and CTA)"
  }
}

Guidance:
• Core Belief Shift: what the reader believed before vs after. Simple and real.
• Reader's Journey (belief engineering sequence), e.g. making the reader feel seen; making mainstream solutions look bad; dropping a "new discovery"; making the product the obvious answer; removing all risk.
• Frameworks & Micro-Techniques: name the specific tricks and story structures (e.g. the "Doctor's Discovery" narrative, "Kitchen-Table Founder" story, "Contrarian Exposé", "Invisible Threat" listicle, "Personal Sacrifice" price anchor, historical origin story, jargon simplification, "Worse Than Nothing" frame).

Return ONLY valid JSON. No markdown, no code fences, no text outside the JSON. All explanations in simple, casual English.

Advertorial text:`;

const TRACKING = ["utm_", "fbclid", "gclid", "tw_", "hpcid", "pub", "hit", "c1", "c2", "c3", "subid", "click_id", "affidef", "affId", "sub1", "oid", "_ef_"];
function cleanUrl(raw: string) {
  try {
    const u = new URL(raw);
    [...u.searchParams.keys()].forEach((k) => {
      if (TRACKING.some((p) => k.startsWith(p) || k === p) || k.includes("{{")) u.searchParams.delete(k);
    });
    return u.toString();
  } catch {
    return raw;
  }
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

async function scrape(url: string): Promise<{ text: string; screenshot: string | null }> {
  const fc = process.env.FIRECRAWL_API_KEY;
  if (fc) {
    const attempt = async (target: string) => {
      const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${fc}`, "content-type": "application/json" },
        body: JSON.stringify({ url: target, formats: ["markdown", "screenshot@fullPage"], onlyMainContent: true, waitFor: 5000, timeout: 60000 }),
        signal: AbortSignal.timeout(75000),
      });
      const j = await r.json().catch(() => ({}));
      return r.ok && j.success ? j : null;
    };
    const cleaned = cleanUrl(url);
    const j = (await attempt(url)) ?? (cleaned !== url ? await attempt(cleaned) : null);
    if (j) return { text: j.data?.markdown ?? j.markdown ?? "", screenshot: j.data?.screenshot ?? j.screenshot ?? null };
  }
  const r = await fetch(cleanUrl(url), {
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Couldn't open that page (status ${r.status}). Check the link is public.`);
  return { text: htmlToText(await r.text()), screenshot: null };
}

interface AiOut {
  brandName?: string; productName?: string; niche?: string; advertorialStyle?: string; headline?: string; description?: string; targetAvatar?: string; corePrice?: string;
  deepBreakdown?: { coreBeliefShift?: string; readersJourney?: { title: string; explanation: string }[]; frameworksAndMicroTechniques?: { type: string; name: string; explanation: string }[] };
  sectionBreakdown?: Record<string, string>;
}

async function analyze(text: string): Promise<AiOut> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI isn't connected yet — add ANTHROPIC_API_KEY to the Vercel project.");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: `${MASTER_PROMPT}\n\n${text.slice(0, 120_000)}` }],
    }),
    signal: AbortSignal.timeout(100_000),
  });
  if (r.status === 429) throw new Error("The AI is rate-limited right now. Try again in a minute.");
  if (!r.ok) throw new Error(`AI analysis failed (${r.status}).`);
  const j = (await r.json()) as { content?: { type: string; text?: string }[] };
  const raw = j.content?.find((c) => c.type === "text")?.text ?? "";
  const body = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("The AI returned something unreadable. Try again.");
  }
}

/** Runs the whole pipeline and returns the draft row plus screenshot (URL or base64) for the resources API. */
export async function analyzeAdvertorial(input: string) {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const { text, screenshot } = await scrape(url);
  if (!text || text.length < 100) throw new Error("Couldn't pull enough text from that page.");
  const a = await analyze(text);

  const style = a.advertorialStyle ?? "Personal Story";
  const isHybrid = style.startsWith("Hybrid");
  const normalized = isHybrid ? "Hybrid" : ["Personal Story", "Exposé", "Listicle"].includes(style) ? style : style.toLowerCase().startsWith("expos") ? "Exposé" : "Personal Story";
  const slug = `${(a.brandName ?? "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;

  const data = {
    slug,
    brand_name: a.brandName || "Unknown Brand",
    product_name: a.productName || "Unknown Product",
    niche: a.niche || "General",
    style: normalized,
    hybrid_blend: isHybrid ? (style.match(/\((.+)\)/)?.[1] ?? null) : null,
    live_url: url,
    headline: a.headline ?? "",
    description: a.description ?? "",
    target_avatar: a.targetAvatar ?? "",
    core_price: a.corePrice || "N/A",
    format: "Text + Images",
    traffic_flow: "Ad → Advertorial → Sales Page → Checkout",
    section_breakdown: a.sectionBreakdown ?? {},
    deep_copywriting_breakdown: {
      coreBeliefShift: a.deepBreakdown?.coreBeliefShift ?? "",
      readerJourney: (a.deepBreakdown?.readersJourney ?? []).map((s) => ({ title: s.title, description: s.explanation })),
      deepDive: (a.deepBreakdown?.frameworksAndMicroTechniques ?? []).map((i) => ({ type: /framework/i.test(i.type) ? "framework" : "micro-technique", name: i.name, description: i.explanation })),
    },
    source_url: url,
  };
  // Without Firecrawl, capture the full page with thum.io (free, no key); the resources API downloads and stores it.
  const fallbackShot = `https://image.thum.io/get/width/1280/crop/9000/fullpage/noanimate/wait/5/${cleanUrl(url)}`;
  const shot = screenshot ? (screenshot.startsWith("http") ? { screenshot_url: screenshot } : { screenshot_base64: screenshot }) : { screenshot_url: fallbackShot };
  return { data, ...shot };
}
