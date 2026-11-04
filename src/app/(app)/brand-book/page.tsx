import { getContext } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { BrandBookEditor } from "./editor";

export default async function BrandBookPage() {
  const ctx = await getContext({ requireTenant: true });
  const t = ctx.tenant!;
  const [book, products] = await Promise.all([ctx.db.brandBook(t.id), ctx.db.products(t.id)]);
  return (
    <>
      <PageHeader title="Brand Book" subtitle="The single source of truth every other tool reads: mechanism, avatars, angles, proof, objections and the compliance rails. Versioned on every save. Export it as markdown to hand to your own Claude Code." />
      <BrandBookEditor book={book} products={products} tenantName={t.name} />
    </>
  );
}
