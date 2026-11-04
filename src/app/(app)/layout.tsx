import { getContext } from "@/lib/data";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();
  return <Shell ctx={ctx}>{children}</Shell>;
}
