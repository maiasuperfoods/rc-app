"use client";

import { Logo } from "@/components/logo";

/**
 * Anything that throws while rendering lands here instead of a blank page. The message stays
 * generic on purpose — an error from the database or an integration can carry details that don't
 * belong in front of a merchant. This is a client boundary, so it builds its own frame rather than
 * using AuthFrame, which is an async server component.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen grid place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <Logo className="h-9 w-9" />
          <div className="wordmark text-cream text-lg">Ren<span className="text-gold italic">ai</span>ssance <span className="text-dim text-xs tracking-[0.2em] uppercase">Commerce</span></div>
        </div>
        <div className="card p-6">
          <h1 className="display text-2xl mb-2">Something went wrong</h1>
          <p className="text-sm text-dim mb-6">That page didn&apos;t load. Trying again usually sorts it; if it keeps happening, tell your coach what you were doing.</p>
          <button onClick={reset} className="btn btn-primary w-full justify-center">Try again</button>
          {/* A full page load on purpose: client-side navigation out of a broken tree can carry the broken state with it. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="btn btn-secondary w-full justify-center mt-2">Back to the dashboard</a>
        </div>
      </div>
    </div>
  );
}
