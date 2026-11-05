import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[0.8rem] mb-5">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5 min-w-0">
          {i > 0 && <ChevronRight size={13} className="text-mute shrink-0" />}
          {it.href ? (
            <Link href={it.href} className="text-gold hover:text-gold-soft transition-colors truncate">
              {it.label}
            </Link>
          ) : (
            <span className="text-dim truncate">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function KbTitle({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="display text-[2rem] md:text-[2.6rem] leading-[1.1]">{title}</h1>
      {sub && <p className="text-mute text-sm mt-2">{sub}</p>}
      {children}
    </div>
  );
}

export function KbEmpty() {
  return (
    <div className="card p-8 text-center max-w-xl">
      <div className="display text-xl">The course isn&apos;t connected here yet</div>
      <p className="text-dim text-sm mt-2">
        Sign in with a student account, or set <code className="formula">KB_API_URL</code> and <code className="formula">KB_API_TOKEN</code> for the demo deployment.
      </p>
    </div>
  );
}

export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
