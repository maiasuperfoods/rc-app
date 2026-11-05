import { getContext } from "@/lib/data";
import { Shell } from "@/components/shell";
import { getTheme } from "@/lib/theme";
import { getKbProgress, getKbTree, navTree } from "@/lib/kb";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [ctx, theme, kb, kbDone] = await Promise.all([getContext(), getTheme(), getKbTree(), getKbProgress()]);
  return (
    <Shell ctx={ctx} theme={theme} kb={navTree(kb)} kbDone={kbDone}>
      {children}
    </Shell>
  );
}
