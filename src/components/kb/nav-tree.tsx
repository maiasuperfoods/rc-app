"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import type { KbNavTree } from "@/lib/kb";
import { DoneDot } from "./progress";

const href = {
  home: "/knowledge-base",
  category: (c: string) => `/knowledge-base/${c}`,
  chapter: (c: string, ch: string) => `/knowledge-base/${c}/${ch}`,
  lesson: (l: string) => `/knowledge-base/lesson/${l}`,
};

/** Smooth open/close using the grid-rows trick, so nested heights animate without measuring. */
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`} aria-hidden={!open}>
      <div className="overflow-hidden min-h-0">{children}</div>
    </div>
  );
}

function Chevron({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      className="shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-md text-mute hover:text-ink hover:bg-hover transition-colors"
    >
      <ChevronDown size={14} strokeWidth={2} className={`transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
    </button>
  );
}

/** Where the current URL sits in the course, so its branch opens automatically. */
function locate(tree: KbNavTree, path: string) {
  const parts = path.split("/").filter(Boolean); // knowledge-base, ...
  if (parts[0] !== "knowledge-base") return null;
  if (parts[1] === "lesson" && parts[2]) {
    for (const cat of tree) for (const ch of cat.chapters) if (ch.lessons.some((l) => l.id === parts[2])) return { cat: cat.id, ch: ch.id, lesson: parts[2] };
    return { cat: null, ch: null, lesson: null };
  }
  return { cat: parts[1] ?? null, ch: parts[2] ?? null, lesson: null };
}

export function KbNavTree({ tree, alwaysOpen = false }: { tree: KbNavTree; alwaysOpen?: boolean }) {
  const path = usePathname();
  const here = useMemo(() => locate(tree, path), [tree, path]);
  const inKb = here !== null;

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [rootOpen, setRootOpen] = useState(inKb || alwaysOpen);

  // Opening a page opens its branch; manual toggles elsewhere are kept.
  useEffect(() => {
    if (!here) return;
    /* eslint-disable react-hooks/set-state-in-effect -- sync tree to navigation */
    setRootOpen(true);
    setOpen((o) => ({ ...o, ...(here.cat ? { [here.cat]: true } : {}), ...(here.ch ? { [here.ch]: true } : {}) }));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [here]);

  const flip = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div>
      <div className={`nav-link !pr-1 ${inKb ? "active" : ""}`}>
        <Link href={href.home} className="flex flex-1 items-center gap-[0.65rem] min-w-0">
          <GraduationCap size={16} strokeWidth={1.75} />
          Knowledge Base
        </Link>
        <Chevron open={rootOpen} onClick={() => setRootOpen((v) => !v)} label="Knowledge Base" />
      </div>

      <Collapse open={rootOpen}>
        <ul className="mt-0.5 mb-1 ml-[1.05rem] border-l border-line pl-1.5 space-y-px">
          {tree.map((cat) => {
            const catOpen = Boolean(open[cat.id]);
            const catActive = here?.cat === cat.id && !here.ch && !here.lesson;
            return (
              <li key={cat.id}>
                <div className={`flex items-center gap-1 rounded-md pr-1 ${catActive ? "bg-gold-dim" : "hover:bg-hover"}`}>
                  <Chevron open={catOpen} onClick={() => flip(cat.id)} label={cat.title} />
                  <Link href={href.category(cat.id)} className={`flex-1 py-1.5 text-[0.82rem] leading-snug ${catActive ? "text-gold-soft" : here?.cat === cat.id ? "text-ink" : "text-dim hover:text-ink"}`}>
                    {cat.title}
                  </Link>
                </div>

                <Collapse open={catOpen}>
                  <ul className="ml-3 border-l border-line pl-1.5 py-0.5 space-y-px">
                    {cat.chapters.map((ch) => {
                      const chOpen = Boolean(open[ch.id]);
                      const chActive = here?.ch === ch.id && !here.lesson;
                      return (
                        <li key={ch.id}>
                          <div className={`flex items-start gap-1 rounded-md pr-1 ${chActive ? "bg-gold-dim" : "hover:bg-hover"}`}>
                            <Chevron open={chOpen} onClick={() => flip(ch.id)} label={ch.title} />
                            <Link href={href.chapter(cat.id, ch.id)} className={`flex-1 py-1 text-[0.8rem] leading-snug ${chActive ? "text-gold-soft" : here?.ch === ch.id ? "text-ink" : "text-dim hover:text-ink"}`}>
                              {ch.icon && <span className="mr-1.5">{ch.icon}</span>}
                              {ch.title}
                            </Link>
                          </div>

                          <Collapse open={chOpen}>
                            <ul className="ml-3 border-l border-line pl-1 py-0.5 space-y-px">
                              {ch.lessons.map((l) => {
                                const active = here?.lesson === l.id;
                                return (
                                  <li key={l.id}>
                                    <Link
                                      href={href.lesson(l.id)}
                                      className={`flex items-start gap-2 rounded-md px-2 py-1 text-[0.76rem] leading-snug transition-colors ${active ? "bg-gold-dim text-gold-soft" : "text-mute hover:text-ink hover:bg-hover"}`}
                                    >
                                      <span className="mt-[2px]">
                                        <DoneDot id={l.id} size={12} />
                                      </span>
                                      <span>{l.title}</span>
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </Collapse>
                        </li>
                      );
                    })}
                  </ul>
                </Collapse>
              </li>
            );
          })}
        </ul>
      </Collapse>
    </div>
  );
}
