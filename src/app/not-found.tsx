import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";

export const metadata = { title: "Page not found · Renaissance Commerce" };

export default function NotFound() {
  return (
    <AuthFrame>
      <h1 className="display text-2xl mb-2">We can&apos;t find that page</h1>
      <p className="text-sm text-dim mb-6">The link may be out of date, or the page may have moved.</p>
      <Link href="/" className="btn btn-primary w-full justify-center">Go to your dashboard</Link>
    </AuthFrame>
  );
}
