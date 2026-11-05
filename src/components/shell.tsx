import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { TenantSwitcher } from "./tenant-switcher";
import type { AppContext } from "@/lib/data";

export function Shell({ ctx, children }: { ctx: AppContext; children: ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-line bg-elev md:sticky md:top-0 md:h-screen flex flex-col">
        <div className="px-5 py-5 border-b border-line">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-8 w-8" />
            <div className="leading-tight">
              <div className="text-[0.95rem] font-serif text-cream">
                Ren<span className="text-gold italic">ai</span>ssance
              </div>
              <div className="text-[0.6rem] tracking-[0.2em] text-dim uppercase">Commerce</div>
            </div>
          </Link>
        </div>
        <div className="px-3 py-3 border-b border-line">
          <TenantSwitcher tenants={ctx.tenants} activeId={ctx.tenant?.id ?? null} />
        </div>
        <nav className="px-3 py-3 flex-1 overflow-y-auto">
          <NavLinks isCoach={ctx.isCoach} hasTenant={Boolean(ctx.tenant)} />
        </nav>
        <div className="px-5 py-4 border-t border-line text-xs text-mute">
          <div className="truncate text-dim">{ctx.user.name}</div>
          <div className="truncate">{ctx.user.email}</div>
          {ctx.demo ? (
            <div className="mt-2 pill pill-gold">Demo data</div>
          ) : (
            <form action="/auth/signout" method="post" className="mt-2">
              <button className="text-dim hover:text-ink">Sign out</button>
            </form>
          )}
        </div>
      </aside>
      <main className="px-5 py-6 md:px-10 md:py-8 max-w-[1400px] w-full min-w-0">{children}</main>
    </div>
  );
}
