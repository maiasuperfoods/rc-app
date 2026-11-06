import { Marked } from "marked";
import formats from "@/content/video-ads/video-ad-formats";
import hiring from "@/content/video-ads/hiring-video-editors";

/** Resources → Video Ads: long-form guides, written in Markdown and rendered here. */
export interface VideoAdGuide {
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  updated: string;
  md: string;
}

export const VIDEO_AD_GUIDES: VideoAdGuide[] = [
  {
    slug: "formats",
    title: "Video Ad Formats: The 11 Formats We Run",
    kicker: "Playbook",
    summary: "Yappers, authority, AI song and drama, AI UGC, animation, comedy, 3 Reasons Why, founder, mash-ups and VO + B-roll: how each is built, why it converts, where it sits in the funnel and what kills it. Plus how to choose and chain formats, and reference ads.",
    updated: "2 Nov 2026",
    md: formats,
  },
  {
    slug: "hiring-editors",
    title: "Hiring Video Editors on OnlineJobs.ph",
    kicker: "Team",
    summary: "Which plan to buy, how to define the role and pay, a job post that filters, headhunting, screening, the paid test edit and scorecard, the offer, onboarding and keeping good editors.",
    updated: "4 Nov 2026",
    md: hiring,
  },
];

export const getGuide = (slug: string) => VIDEO_AD_GUIDES.find((g) => g.slug === slug) ?? null;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Renders a guide to HTML and returns its section list for the on-page contents. */
export function renderGuide(md: string) {
  const toc: { id: string; text: string }[] = [];
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = slugify(text);
        if (depth === 2) toc.push({ id, text: text.replace(/<[^>]+>/g, "") });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const ext = /^https?:\/\//.test(href);
        return `<a href="${href}"${title ? ` title="${title}"` : ""}${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
      },
      table(token) {
        // Let wide tables scroll inside the column instead of overflowing the page.
        const head = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join("");
        const rows = token.rows.map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join("")}</tr>`).join("");
        return `<div class="kb-table"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
  const html = marked.parse(md, { async: false }) as string;
  return { html, toc };
}

export const videoAdsHref = {
  hub: "/resources/video-ads",
  guide: (slug: string) => `/resources/video-ads/${slug}`,
};
