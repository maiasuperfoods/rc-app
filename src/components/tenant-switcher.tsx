"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Tenant } from "@/lib/types";
import { switchTenant } from "@/app/actions";

export function TenantSwitcher({ tenants, activeId, coach = false }: { tenants: Tenant[]; activeId: string | null; coach?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (tenants.length === 0) return <div className="text-xs text-mute px-2">{coach ? "No brands yet" : "No brand yet"}</div>;
  return (
    <select
      className="input text-sm"
      value={activeId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__new") {
          router.push(coach ? "/admin/access" : "/onboarding?new=1");
          return;
        }
        start(async () => {
          await switchTenant(v);
          router.refresh();
        });
      }}
    >
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
      <option value="__new">{coach ? "+ Add a brand" : "+ Add another brand"}</option>
    </select>
  );
}
