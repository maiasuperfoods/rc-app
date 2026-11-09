"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { claimShopifyInstall, dismissShopifyInstall } from "./pending-actions";

export function PendingBanner({ shop, brand }: { shop: string; brand: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card border-gold/40 p-4 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <Store size={16} className="text-gold shrink-0" />
        <div className="flex-1 min-w-0 text-sm">
          <b className="text-ink font-medium">{shop} is waiting to be linked.</b>{" "}
          <span className="text-dim">You installed the app in Shopify. Link it to {brand} and your orders, products and inventory start loading.</span>
          {error && <div className="text-xs text-bad mt-1">{error}</div>}
        </div>
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => start(async () => { const r = await claimShopifyInstall(shop); if (!r.ok) setError(r.error ?? "Failed"); else router.refresh(); })}>
          {pending ? "Linking…" : `Link to ${brand}`}
        </button>
        <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => start(async () => { await dismissShopifyInstall(); router.refresh(); })}>Not now</button>
      </div>
    </div>
  );
}
