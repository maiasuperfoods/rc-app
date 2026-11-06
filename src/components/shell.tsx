import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { TenantSwitcher } from "./tenant-switcher";
import { ThemeToggle, type Theme } from "./theme-toggle";
import type { AppContext } from "@/lib/data";
import type { KbNavTree as KbNavTreeData } from "@/lib/kb";
import { KbNavTree } from "./kb/nav-tree";
import { KbProgressProvider } from "./kb/progress";
import { ResourcesNav } from "./resources/nav";

export function Shell({ ctx, theme = "dark", kb, kbDone = [], standalone = false, children }: { ctx: AppContext; theme?: Theme; kb?: KbNavTreeData; kbDone?: string[]; standalone?: boolean; children: ReactNode }) {
  return (
    <KbProgressProvider initial={kbDone} demo={ctx.demo}>
    <div className="min-h-screen md:grid md:grid-cols-[264px_1fr]">
      <aside className="border-b md:border-b-0 md:border-r border-line bg-elev md:sticky md:top-0 md:h-screen flex flex-col">
        <div className="px-5 py-5 border-b border-line">
          <Link href={standalone ? "/knowledge-base" : "/"} className="flex items-center gap-3">
            <Logo className="h-8 w-8" />
            <div className="leading-tight">
              <div className="text-[0.95rem] font-serif text-cream">
                Ren<span className="text-gold italic">ai</span>ssance
              </div>
              <div className="text-[0.6rem] tracking-[0.2em] text-dim uppercase">{standalone ? "Knowledge Base" : "Commerce"}</div>
            </div>
          </Link>
        </div>
        {!standalone && (
          <div className="px-3 py-3 border-b border-line">
            <TenantSwitcher tenants={ctx.tenants} activeId={ctx.tenant?.id ?? null} />
          </div>
        )}
        <nav className="px-3 py-3 flex-1 overflow-y-auto">
          {!standalone && <NavLinks isCoach={ctx.isCoach} hasTenant={Boolean(ctx.tenant)} />}
          {kb && kb.length > 0 && (
            <>
              <div className={`label px-3 pb-1 ${standalone ? "pt-1" : "pt-4"}`}>Learn</div>
              <KbNavTree tree={kb} alwaysOpen={standalone} />
            </>
          )}
          <div className="label px-3 pt-4 pb-1">Resources</div>
          <ResourcesNav />
        </nav>
        <div className="px-3 pt-3">
          <ThemeToggle initial={theme} />
        </div>
        {!(standalone && ctx.demo) && (
        <div className="px-5 py-4 border-t border-line mt-3 text-xs text-mute">
          <div className="truncate text-dim">{ctx.user.name}</div>
          <div className="truncate">{ctx.user.email}</div>
          {ctx.demo ? (
            <div className="mt-2 pill pill-gold">Demo data</div>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              <Link href="/auth/set-password" className="text-dim hover:text-ink">Change password</Link>
              <form action="/auth/signout" method="post">
                <button className="text-dim hover:text-ink">Sign out</button>
              </form>
            </div>
          )}
        </div>
        )}
        {standalone && ctx.demo && <div className="pb-4" />}
      </aside>
      <main className="px-5 py-6 md:px-10 md:py-8 max-w-[1400px] w-full min-w-0">
        {!ctx.demo && ctx.isCoach && ctx.tenant && !ctx.canEdit && !standalone && (
          <div className="mb-5 rounded-md border border-gold/30 bg-gold-dim px-4 py-2.5 text-sm text-gold-soft">
            Viewing <span className="font-medium">{ctx.tenant.name}</span> as a coach: read-only. Numbers come from the student&apos;s own data and connections.
          </div>
        )}
        {children}
      </main>
    </div>
    </KbProgressProvider>
  );
}
