"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, LayoutGrid, Newspaper, Repeat } from "lucide-react";

const LINKS = [
  { href: "/resources", label: "All resources", icon: LayoutGrid, exact: true },
  { href: "/resources/pre-sales", label: "Pre-Sales Vault", icon: Newspaper },
  { href: "/resources/post-purchase", label: "Post-Purchase Vault", icon: Repeat },
  { href: "/resources/video-ads", label: "Video Ads", icon: Clapperboard },
];

/** Sidebar section for Resources — its own category, alongside Learn. */
export function ResourcesNav() {
  const path = usePathname();
  return (
    <div className="space-y-0.5">
      {LINKS.map((l) => {
        const active = l.exact ? path === l.href : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`nav-link ${active ? "active" : ""}`}>
            <l.icon size={16} strokeWidth={1.75} />
            {l.label}
          </Link>
        );
      })}
    </div>
  );
}
