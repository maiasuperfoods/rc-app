import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/data";
import { pcConfigured } from "@/lib/pc/client";
import { bundle } from "@/lib/pc/queries";
import { Card, PageHeader, Pill } from "@/components/ui";
import { DeskContent, DeskTabs, StudentHeading, type DeskTab } from "@/components/coaching/desk";
import { CoachTools } from "./tools";
import { PlatformPanel } from "./platform-panel";
import { LinkStudent } from "./link-student";

const TABS: DeskTab[] = ["overview", "progress", "calls", "actions", "intake", "files", "profile", "platform"];

export default async function BrandPage({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const ctx = await requireCoach();
  const t = await ctx.db.tenant(tenantId);
  if (!t) notFound();
  const reports = await ctx.db.wbrReports(t.id, 1);
  const b = t.pcStudentId && pcConfigured() ? await bundle(t.pcStudentId) : null;
  const tab: DeskTab = b ? (TABS.includes(sp.tab as DeskTab) ? (sp.tab as DeskTab) : "overview") : "platform";
  const base = `/admin/${t.id}`;

  return (
    <>
      <PageHeader
        title={b ? `${b.student.first_name} ${b.student.last_name}` : t.name}
        subtitle={
          <span className="flex items-center gap-2 flex-wrap">
            {b && <StudentHeading b={b} />}
            <span className="flex items-center gap-2"><Pill tone="gold">{t.name}</Pill>{t.domain && <span>{t.domain}</span>}<Pill tone="mute">{t.stage}</Pill>{!t.onboardingComplete && <Pill tone="warn">onboarding incomplete</Pill>}</span>
          </span>
        }
        actions={<CoachTools tenantId={t.id} reportId={reports[0] ? reports[0].id : null} existingAnnotation={reports[0]?.coachAnnotation ?? null} />}
      />

      {b ? (
        <>
          <DeskTabs base={base} tab={tab} b={b} extra={[{ key: "platform", label: "Platform" }]} />
          <DeskContent b={b} tab={tab}>
            <PlatformPanel ctx={ctx} t={t} />
          </DeskContent>
        </>
      ) : (
        <>
          {pcConfigured() && (
            <Card className="mb-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-dim">This brand isn&apos;t linked to a Private Circle student yet, so there are no coaching tabs here.</span>
                <LinkStudent tenantId={t.id} />
              </div>
            </Card>
          )}
          <PlatformPanel ctx={ctx} t={t} />
        </>
      )}

      <div className="mt-6 text-xs text-mute">
        <Link href="/admin" className="hover:text-ink">← All students</Link>
      </div>
    </>
  );
}
