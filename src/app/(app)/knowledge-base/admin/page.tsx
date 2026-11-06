import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getKbTree, kbHref } from "@/lib/kb";
import { isKbAdmin } from "@/lib/kb-admin";
import { adminConfigured } from "@/lib/resources";
import { AdminBar } from "@/components/resources/admin-bar";
import { KbEmpty, KbTitle } from "@/components/kb/bits";
import { CourseEditor } from "@/components/kb/course-editor";

export const metadata = { title: "Edit course · Knowledge Base" };

export default async function CourseAdminPage() {
  const admin = await isKbAdmin();
  if (!admin) {
    return (
      <div className="max-w-xl">
        <KbTitle title="Edit the course" sub="Unlock admin to add, rename, reorder and delete categories, chapters and lessons." />
        <div className="card p-5 flex items-center justify-between gap-4">
          <p className="text-sm text-dim">Use the admin password (the same one as the vaults).</p>
          <AdminBar isAdmin={false} configured={adminConfigured()} />
        </div>
      </div>
    );
  }
  const t = await getKbTree(true);
  if (!t.configured) return <KbEmpty />;
  return (
    <>
      <Link href={kbHref.home} className="inline-flex items-center gap-1.5 text-xs text-mute hover:text-ink mb-4"><ArrowLeft size={13} /> Back to the course</Link>
      <KbTitle title="Edit the course" sub="Categories, chapters and lessons. Open a category to edit its chapters; use Edit on a lesson for its text and video. Changes show on both sites within a minute.">
        <div className="mt-3"><AdminBar isAdmin configured={adminConfigured()} /></div>
      </KbTitle>
      <CourseEditor tree={t} />
    </>
  );
}
