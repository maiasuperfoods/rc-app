import Link from "next/link";
import { ArrowRight, FileText, Play } from "lucide-react";
import { adminConfigured, getPpuList, isResourcesAdmin, resHref } from "@/lib/resources";
import { Crumbs } from "@/components/kb/bits";
import { AdminBar } from "@/components/resources/admin-bar";

export const metadata = { title: "Post-Purchase Vault · Resources" };

export default async function PostPurchaseVault() {
  const [list, isAdmin] = await Promise.all([getPpuList(), isResourcesAdmin()]);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Crumbs items={[{ label: "Resources", href: resHref.hub }, { label: "Post-Purchase Vault" }]} />
        <AdminBar isAdmin={isAdmin} configured={adminConfigured()} />
      </div>

      <h1 className="display text-4xl leading-10 md:text-5xl md:leading-none">
        The <span className="italic text-gold">Post-Purchase</span> Vault
      </h1>
      <p className="text-dim mt-2 max-w-2xl">Study how successful e-commerce brands use post-purchase upsell videos to raise order value and scale more aggressively. Funnels, offers, videos, screenshots, full scripts and the psychological levers behind each one.</p>
      <div className="hairline mt-7 mb-7" />

      <div className="label mb-4">The collection · {list.length} brands</div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((b) => (
          <Link key={b.id} href={resHref.ppuBrand(b.id)} className="group card p-5 flex flex-col transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-gold/40">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="pill pill-gold">{b.niche}</span>
              <span className="pill pill-mute">{b.text_only ? <><FileText size={11} /> Text</> : <><Play size={11} /> Video</>}</span>
            </div>
            <h2 className="title text-xl leading-7 group-hover:text-gold-soft transition-colors">{b.brand_name}</h2>
            <p className="text-sm text-dim mt-0.5">{b.core_product}</p>
            {b.brand_context?.upsellStrategy && <p className="text-sm text-ink/80 mt-4 leading-snug">{b.brand_context.upsellStrategy}</p>}
            <div className="mt-auto pt-5 flex items-center justify-between">
              <span className="label !text-gold">{b.upsell_count} upsell{b.upsell_count === 1 ? "" : "s"}</span>
              <ArrowRight size={16} className="text-mute group-hover:text-gold group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
