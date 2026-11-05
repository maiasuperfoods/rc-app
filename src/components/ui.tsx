import type { ReactNode } from "react";
import Link from "next/link";

export const fmtMoney = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const fmtPct = (n: number | null | undefined, digits = 0) => (n == null || Number.isNaN(n) ? "—" : `${(n * 100).toFixed(digits)}%`);
export const fmtNum = (n: number | null | undefined, digits = 0) => (n == null || Number.isNaN(n) ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: digits }));
export const fmtX = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? "—" : `${n.toFixed(2)}×`);
export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");
export const timeAgo = (s: string | null) => {
  if (!s) return "never";
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="display text-3xl md:text-[2.1rem] leading-tight">{title}</h1>
        {subtitle && <p className="text-dim text-sm mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 items-center">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions, hint }: { title?: ReactNode; children?: ReactNode; className?: string; actions?: ReactNode; hint?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title && <h2 className="text-sm font-medium text-ink">{title}</h2>}
            {hint && <p className="text-xs text-mute mt-0.5">{hint}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, delta, tone, hint, formula, lowerIsBetter = false }: { label: string; value: ReactNode; delta?: number | null; tone?: "good" | "bad" | "warn" | "neutral"; hint?: string; formula?: string; lowerIsBetter?: boolean }) {
  const toneClass = tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink";
  const deltaGood = delta != null && (lowerIsBetter ? delta <= 0 : delta >= 0);
  return (
    <div className="card p-4" title={formula}>
      <div className="label">{label}</div>
      <div className={`text-2xl font-medium mt-1 tabular-nums ${toneClass}`}>{value}</div>
      {delta != null && Number.isFinite(delta) && (
        <div className={`text-xs mt-1 ${deltaGood ? "text-good" : "text-bad"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta * 100).toFixed(0)}% vs last week
        </div>
      )}
      {hint && <div className="text-xs text-mute mt-1">{hint}</div>}
    </div>
  );
}

export function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "info" | "gold" | "mute"; children: ReactNode }) {
  return <span className={`pill pill-${tone} shrink-0`}>{children}</span>;
}

export function Empty({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="card-elev p-10 text-center">
      <div className="display text-xl">{title}</div>
      <p className="text-dim text-sm mt-2 max-w-md mx-auto">{body}</p>
      {action && (
        <Link href={action.href} className="btn btn-primary mt-5">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Field({ label, children, hint, formula }: { label: string; children: ReactNode; hint?: string; formula?: string }) {
  return (
    <label className="block" title={formula}>
      <span className="label block mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-mute mt-1">{hint}</span>}
    </label>
  );
}

export function Hairline() {
  return <div className="hairline my-6" />;
}
