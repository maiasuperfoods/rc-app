import { getContext } from "@/lib/data";
import { Shell } from "@/components/shell";
import { getTheme } from "@/lib/theme";
import { pendingReferralCount } from "@/lib/referrals";
import { getKbProgress, getKbTree, isKbStandalone, navTree } from "@/lib/kb";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [ctx, theme, kb, kbDone] = await Promise.all([getContext(), getTheme(), getKbTree(), getKbProgress()]);
  const pendingReferrals = ctx.isCoach || ctx.isVa ? await pendingReferralCount().catch(() => 0) : 0;
  return (
    <Shell ctx={ctx} theme={theme} pendingReferrals={pendingReferrals} kb={navTree(kb)} kbDone={kbDone} standalone={isKbStandalone()}>
      {children}
    </Shell>
  );
}
