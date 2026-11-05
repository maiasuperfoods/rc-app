import { getContext } from "@/lib/data";
import { Shell } from "@/components/shell";
import { getTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [ctx, theme] = await Promise.all([getContext(), getTheme()]);
  return <Shell ctx={ctx} theme={theme}>{children}</Shell>;
}
