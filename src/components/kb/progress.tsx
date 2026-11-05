"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { setLessonComplete } from "@/app/(app)/knowledge-base/actions";

/**
 * Lesson completion. Live mode starts from the server's list and saves through a server action;
 * demo mode keeps it in this browser only.
 */
const KEY = "rc_kb_done";
type Ctx = { done: Set<string>; toggle: (id: string, value?: boolean) => void; pending: boolean };
const ProgressCtx = createContext<Ctx>({ done: new Set(), toggle: () => {}, pending: false });

function readLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function KbProgressProvider({ initial, demo, children }: { initial: string[]; demo: boolean; children: ReactNode }) {
  const [done, setDone] = useState(() => new Set(initial));
  const [pending, start] = useTransition();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser storage after mount
    if (demo) setDone(new Set(readLocal()));
  }, [demo]);

  const toggle = useCallback(
    (id: string, value?: boolean) => {
      setDone((prev) => {
        const next = new Set(prev);
        const v = value ?? !next.has(id);
        if (v) next.add(id);
        else next.delete(id);
        if (demo) {
          try {
            localStorage.setItem(KEY, JSON.stringify([...next]));
          } catch {}
        } else {
          start(() => setLessonComplete(id, v));
        }
        return next;
      });
    },
    [demo],
  );

  const value = useMemo(() => ({ done, toggle, pending }), [done, toggle, pending]);
  return <ProgressCtx.Provider value={value}>{children}</ProgressCtx.Provider>;
}

export const useKbProgress = () => useContext(ProgressCtx);

/** Small completion dot used in lesson lists and the sidebar tree. */
export function DoneDot({ id, size = 14 }: { id: string; size?: number }) {
  const { done } = useKbProgress();
  const on = done.has(id);
  return (
    <span
      aria-label={on ? "Completed" : "Not completed"}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border transition-colors ${on ? "bg-gold border-gold text-[#141210]" : "border-line-strong text-transparent"}`}
      style={{ width: size, height: size }}
    >
      <Check size={size - 5} strokeWidth={3} />
    </span>
  );
}

/** Count of completed lessons among the given ids. */
export function DoneCount({ ids, className = "" }: { ids: string[]; className?: string }) {
  const { done } = useKbProgress();
  const n = ids.filter((i) => done.has(i)).length;
  if (n === 0) return null;
  return (
    <span className={className}>
      {n}/{ids.length} done
    </span>
  );
}

export function CompleteButton({ id, nextHref }: { id: string; nextHref?: string }) {
  const { done, toggle, pending } = useKbProgress();
  const router = useRouter();
  const on = done.has(id);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        toggle(id, !on);
        if (!on && nextHref) router.push(nextHref);
      }}
      className={`btn ${on ? "btn-ghost" : "btn-primary"}`}
    >
      <Check size={15} strokeWidth={2.25} />
      {on ? "Completed" : nextHref ? "Mark complete & continue" : "Mark complete"}
    </button>
  );
}
