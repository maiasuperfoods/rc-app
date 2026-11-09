"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
import { setMyActionItem } from "./actions";

export function MyItemToggle({ id, status, canEdit }: { id: string; status: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!canEdit) return null;
  const next = status === "open" ? "done" : "open";
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className={`btn btn-ghost !py-1 !px-2 !text-xs ${status === "open" ? "text-good" : ""}`} disabled={pending} onClick={() => start(async () => { const r = await setMyActionItem(id, next); if (!r.ok) setError(r.error ?? "Failed"); else router.refresh(); })}>
        {status === "open" ? <><Check size={12} /> Mark done</> : <><RotateCcw size={12} /> Reopen</>}
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </span>
  );
}
