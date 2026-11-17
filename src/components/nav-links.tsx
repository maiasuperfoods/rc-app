"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Boxes, Calculator, CalendarCheck, Handshake, Home, LineChart, Map, Phone, Plug, Sparkles, Users, KeyRound, BadgeDollarSign } from "lucide-react";

const studentLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/coaching", label: "Coaching", icon: Handshake },
  { href: "/brand-book", label: "Brand Book", icon: BookOpen },
  { href: "/unit-economics", label: "Unit Economics", icon: Calculator },
  { href: "/wbr", label: "Weekly Review", icon: CalendarCheck },
  { href: "/forecast", label: "Forecast", icon: LineChart },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/creative", label: "Creative", icon: Sparkles },
  { href: "/integrations", label: "Connections", icon: Plug },
];

export function NavLinks({ isCoach, isVa = false, hasTenant, pendingReferrals = 0 }: { isCoach: boolean; isVa?: boolean; hasTenant: boolean; pendingReferrals?: number }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <div className="space-y-0.5">
      {hasTenant &&
        studentLinks.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link ${active(l.href) ? "active" : ""}`}>
            <l.icon size={16} strokeWidth={1.75} />
            {l.label}
          </Link>
        ))}
      {isCoach && (
        <>
          <div className="label px-3 pt-4 pb-1">Coaching</div>
          <Link href="/admin" className={`nav-link ${active("/admin") && !active("/admin/access") && !active("/admin/calls") && !active("/admin/referrals") ? "active" : ""}`}>
            <Users size={16} strokeWidth={1.75} />
            All students
          </Link>
          <Link href="/admin/calls" className={`nav-link ${active("/admin/calls") ? "active" : ""}`}>
            <Phone size={16} strokeWidth={1.75} />
            Calls
          </Link>
          <Link href="/admin/access" className={`nav-link ${active("/admin/access") ? "active" : ""}`}>
            <KeyRound size={16} strokeWidth={1.75} />
            Students &amp; access
          </Link>
        </>
      )}
      {(isCoach || isVa) && (
        <>
          {!isCoach && <div className="label px-3 pt-4 pb-1">Partners</div>}
          <Link href="/admin/referrals" className={`nav-link ${active("/admin/referrals") ? "active" : ""}`}>
            <BadgeDollarSign size={16} strokeWidth={1.75} />
            Referrals
            {pendingReferrals > 0 && <span className="ml-auto pill pill-gold tabular-nums">{pendingReferrals}</span>}
          </Link>
        </>
      )}
    </div>
  );
}
