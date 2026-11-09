"use client";
import Script from "next/script";
import { Logo } from "@/components/logo";

/**
 * App Bridge is loaded from Shopify's CDN so links open the top-level window instead of trying to
 * navigate the admin iframe. Without it, "Open dashboard" is blocked by the frame.
 */
export function EmbeddedFrame({ shop, appUrl, apiKey, host }: { shop: string | null; appUrl: string; apiKey: string; host: string }) {
  const open = () => {
    const url = `${appUrl}/integrations`;
    if (window.top && window.top !== window.self) window.top.location.href = url;
    else window.location.href = url;
  };
  return (
    <>
      <Script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" data-api-key={apiKey} strategy="beforeInteractive" />
      <div className="min-h-screen grid place-items-center px-5" data-host={host}>
        <div className="w-full max-w-md card p-7 text-center">
          <Logo className="h-10 w-10 mx-auto mb-4" />
          <h1 className="display text-2xl mb-2">Connected to Renaissance Commerce</h1>
          <p className="text-sm text-dim mb-6">
            {shop ? <><span className="text-ink">{shop}</span> is linked.</> : "Your store is linked."} Your orders, products and inventory sync automatically. The dashboards — unit economics, cash-flow forecast, inventory planning, weekly review and creative performance — open in a full window.
          </p>
          <button type="button" onClick={open} className="btn btn-primary w-full justify-center">Open my dashboard</button>
          <p className="text-xs text-mute mt-4">Signed in with the email your coach invited.</p>
        </div>
      </div>
    </>
  );
}
