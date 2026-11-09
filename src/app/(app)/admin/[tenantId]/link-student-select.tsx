"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkTenant } from "@/app/(app)/admin/coaching-actions";

export function LinkStudentSelect({ tenantId, options }: { tenantId: string; options: { id: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <select className="input !w-auto !py-1.5" defaultValue="" disabled={pending || !options.length} onChange={(e) => { const v = e.target.value; if (!v) return; start(async () => { const r = await linkTenant(tenantId, v); if (!r.ok) setError(r.error); else router.refresh(); }); }}>
        <option value="">{options.length ? "Link to a student…" : "No unlinked students"}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      {error && <span className="text-xs text-bad">{error}</span>}
    </span>
  );
}
