import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCoach } from "@/lib/data";
import { pcConfigured } from "@/lib/pc/client";
import { bundle } from "@/lib/pc/queries";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { DeskContent, DeskTabs, StudentHeading, type DeskTab } from "@/components/coaching/desk";
import { ProvisionButton } from "@/components/coaching/desk-client";

const TABS: DeskTab[] = ["overview", "progress", "calls", "actions", "intake", "files", "profile"];

/** A Private Circle student who doesn't have a brand in the platform yet (signed, not paid, or intake pending). */
export default async function StudentPage({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { studentId } = await params;
  const sp = await searchParams;
  await requireCoach();
  if (!pcConfigured()) redirect("/admin");
  const { data: linked } = await supabaseAdmin().from("tenants").select("id").eq("pc_student_id", studentId).maybeSingle();
  if (linked) redirect(`/admin/${linked.id}?tab=${sp.tab ?? "overview"}`);
  const b = await bundle(studentId);
  if (!b) notFound();
  const tab: DeskTab = TABS.includes(sp.tab as DeskTab) ? (sp.tab as DeskTab) : "overview";
  const ready = b.student.status === "active" && b.student.intake_status === "complete";
  return (
    <>
      <PageHeader title={`${b.student.first_name} ${b.student.last_name}`} subtitle={<StudentHeading b={b} />} actions={<ProvisionButton studentId={studentId} ready={ready} />} />
      <Card className="mb-4 border-gold/30">
        <p className="text-sm text-dim">
          {ready
            ? "Paid and intake complete: the platform brand will be created on the next hourly run, or create it now with the button above. The student gets an email with their set-password link."
            : `No platform brand yet. It is created automatically once the student has paid${b.student.status !== "active" ? " (not yet)" : ""} and completed the intake${b.student.intake_status !== "complete" ? " (not yet)" : ""}.`}
        </p>
      </Card>
      <DeskTabs base={`/admin/pc/${studentId}`} tab={tab} b={b} />
      <DeskContent b={b} tab={tab} />
      <div className="mt-6 text-xs text-mute"><Link href="/admin" className="hover:text-ink">← All students</Link></div>
    </>
  );
}
