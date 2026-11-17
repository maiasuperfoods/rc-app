import { getContext } from "@/lib/data";
import { getStudentPartners } from "@/lib/referrals";
import { Crumbs, KbTitle } from "@/components/kb/bits";
import { PartnerList } from "./partner-list";

export const metadata = { title: "Partners · Renaissance Commerce" };
export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const ctx = await getContext();
  const { partners, requests } = await getStudentPartners(ctx.tenant?.id ?? null);
  const canRequest = Boolean(ctx.tenant) && ctx.canEdit;
  return (
    <div className="max-w-5xl">
      <Crumbs items={[{ label: "Resources", href: "/resources" }, { label: "Partners" }]} />
      <KbTitle title="Partners" sub="The vendors we use and trust. Request access and we will set you up with the partner, then your link or code appears here." />
      <div className="hairline mb-8" />
      {partners.length === 0 ? <div className="card p-6 text-dim">No partners are listed yet.</div> : <PartnerList partners={partners} requests={requests} canRequest={canRequest} />}
      {!canRequest && partners.length > 0 && <p className="text-xs text-mute mt-6">You are viewing this as staff. Only a brand&apos;s own team can request access.</p>}
    </div>
  );
}
