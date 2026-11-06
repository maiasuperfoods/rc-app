import { requireCoach } from "@/lib/data";
import { adminApi } from "@/lib/admin-api";
import { PageHeader } from "@/components/ui";
import { AccessManager, type AccessData } from "./manager";

export const metadata = { title: "Students & access · Renaissance Commerce" };

export default async function AccessPage() {
  const ctx = await requireCoach();
  let data: AccessData = { brands: [], coaches: [], invites: [] };
  let error: string | null = null;
  if (ctx.demo) error = "This page manages real student logins. It works once the app is connected to the student database.";
  else {
    try {
      data = await adminApi<AccessData>({ action: "list" });
    } catch (e) {
      error = e instanceof Error ? e.message : "Couldn't load accounts.";
    }
  }
  return (
    <>
      <PageHeader
        title="Students & access"
        subtitle="Add a brand and invite its student. They get a link to set their password, then see only their own brand. Coaches are managed from the admin database and see every brand, read-only."
      />
      {error ? <div className="card p-6 text-dim">{error}</div> : <AccessManager data={data} />}
    </>
  );
}
