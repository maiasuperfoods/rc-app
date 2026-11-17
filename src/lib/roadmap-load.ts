import type { DataSource } from "@/lib/data/source";
import type { RoadmapStart, Tenant } from "@/lib/types";
import { getKbProgress, getKbTree } from "@/lib/kb";
import { evaluateRoadmap, type RoadmapSignals, type RoadmapView } from "@/lib/roadmap";

/**
 * Reads everything the roadmap needs for one brand and works out where it stands. Each lookup is
 * allowed to fail on its own: a Knowledge Base that cannot be reached costs the lesson links, not
 * the page.
 */
export async function loadRoadmap(db: DataSource, t: Tenant): Promise<{ view: RoadmapView; start: RoadmapStart | null; kbAvailable: boolean }> {
  const from = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [state, book, offers, upsells, products, suppliers, integrations, daily, ads, forecast, wbr, tree, progress] = await Promise.all([
    db.roadmapState(t.id),
    safe(db.brandBook(t.id), null),
    safe(db.offers(t.id), []),
    safe(db.upsells(t.id), []),
    safe(db.products(t.id), []),
    safe(db.suppliers(t.id), []),
    safe(db.integrations(t.id), []),
    safe(db.dailyMetrics(t.id, from), []),
    safe(db.adInsights(t.id, from), []),
    safe(db.forecastInputs(t.id), null),
    safe(db.wbrState(t.id), null),
    safe(getKbTree(), null),
    safe(getKbProgress(), [] as string[]),
  ]);
  const on = (p: string) => integrations.some((i) => i.provider === p && i.connected);
  const sig: RoadmapSignals = {
    lessonsDone: new Set(progress),
    mechanism: Boolean(book?.mechanism?.trim()),
    avatars: book?.avatars?.length ?? 0,
    angles: book?.angles?.length ?? 0,
    offers: offers.length,
    upsells: upsells.length,
    products: products.length,
    suppliers: suppliers.length,
    connected: { shopify: on("shopify"), tripleWhale: on("triple_whale"), lifetimely: on("lifetimely"), meta: on("meta"), commslayer: on("commslayer") },
    hasOrders: daily.some((d) => d.orders > 0),
    hasAdSpend: daily.some((d) => d.adSpend > 0),
    adsLaunched: ads.length > 0,
    forecastSaved: forecast != null,
    wbrTargets: Object.keys(wbr?.targets ?? {}).length,
    wbrItems: wbr?.items?.length ?? 0,
  };
  const titles = new Map((tree?.lessons ?? []).map((l) => [l.id, l.title]));
  return { view: evaluateRoadmap(state, sig, titles), start: state.start, kbAvailable: titles.size > 0 };
}
