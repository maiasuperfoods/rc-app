"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, LogOut } from "lucide-react";
import { lockResourcesAdmin, unlockResourcesAdmin } from "@/app/(app)/knowledge-base/resources/actions";

/** Small admin toggle shown on resource pages: unlock with the admin password, or lock again. */
export function AdminBar({ isAdmin, configured }: { isAdmin: boolean; configured: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (isAdmin) {
    return (
      <button
        type="button"
        className="btn btn-ghost !py-1.5 !text-xs"
        onClick={() => start(async () => { await lockResourcesAdmin(); router.refresh(); })}
        disabled={pending}
      >
        <LogOut size={13} /> Exit admin
      </button>
    );
  }
  if (!configured) return null;

  return (
    <div className="relative">
      <button type="button" className="btn btn-ghost !py-1.5 !text-xs" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Lock size={13} /> Admin
      </button>
      {open && (
        <form
          className="absolute right-0 top-full mt-2 z-30 card p-4 w-72 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            start(async () => {
              const r = await unlockResourcesAdmin(pw);
              if (!r.ok) return setErr(r.error);
              setOpen(false);
              setPw("");
              router.refresh();
            });
          }}
        >
          <div className="label mb-2">Admin access</div>
          <input type="password" autoFocus className="input" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          {err && <p className="text-bad text-xs mt-2">{err}</p>}
          <button className="btn btn-primary w-full justify-center mt-3" disabled={pending || !pw}>
            <LockOpen size={14} /> {pending ? "Checking…" : "Unlock"}
          </button>
        </form>
      )}
    </div>
  );
}
