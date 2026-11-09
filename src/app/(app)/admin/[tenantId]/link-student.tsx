import { roster } from "@/lib/pc/queries";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LinkStudentSelect } from "./link-student-select";

/** Lets a coach attach an existing brand (demo, manual) to a Private Circle student record. */
export async function LinkStudent({ tenantId }: { tenantId: string }) {
  const [students, { data: linked }] = await Promise.all([roster(), supabaseAdmin().from("tenants").select("pc_student_id").not("pc_student_id", "is", null)]);
  const taken = new Set((linked ?? []).map((t) => t.pc_student_id as string));
  const options = students.filter((s) => !taken.has(s.id)).map((s) => ({ id: s.id, label: `${s.first_name} ${s.last_name}${s.company_name ? ` · ${s.company_name}` : ""}` }));
  return <LinkStudentSelect tenantId={tenantId} options={options} />;
}
