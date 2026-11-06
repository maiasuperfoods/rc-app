import { Lock } from "lucide-react";
import { adminConfigured, getPresale, getPresaleList, isResourcesAdmin, resHref } from "@/lib/resources";
import { Crumbs, KbTitle } from "@/components/kb/bits";
import { AdminBar } from "@/components/resources/admin-bar";
import { PresaleAdmin } from "@/components/resources/presale-admin";

export const metadata = { title: "Pre-Sales Vault admin · Resources" };
// Scraping + AI analysis can take a while; server actions on this page inherit this limit.
export const maxDuration = 120;

export default async function PresaleAdminPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const isAdmin = await isResourcesAdmin();
  const crumbs = <Crumbs items={[{ label: "Resources", href: resHref.hub }, { label: "Pre-Sales Vault", href: resHref.presale }, { label: "Admin" }]} />;

  if (!isAdmin) {
    return (
      <div className="max-w-xl">
        {crumbs}
        <div className="card p-8 text-center">
          <Lock size={28} className="mx-auto text-mute mb-3" />
          <h1 className="display text-2xl">Admin access</h1>
          <p className="text-dim text-sm mt-2 mb-5">{adminConfigured() ? "Unlock with the admin password to add and manage vault entries." : "Admin isn't set up on this deployment yet."}</p>
          <div className="flex justify-center"><AdminBar isAdmin={false} configured={adminConfigured()} /></div>
        </div>
      </div>
    );
  }

  const [items, editing] = await Promise.all([getPresaleList(true), edit ? getPresale(edit, true) : Promise.resolve(null)]);
  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        {crumbs}
        <AdminBar isAdmin configured />
      </div>
      <KbTitle title="Pre-Sales Vault admin" sub={`${items.filter((i) => i.status === "published").length} published · ${items.filter((i) => i.status === "draft").length} drafts`} />
      <PresaleAdmin items={items} editing={editing} ai={Boolean(process.env.ANTHROPIC_API_KEY)} firecrawl={Boolean(process.env.FIRECRAWL_API_KEY)} />
    </div>
  );
}
