/* eslint-disable @next/next/no-img-element */
export function Logo({ className = "" }: { className?: string }) {
  return <img src="/rc-mark.png" alt="Renaissance Commerce" className={className} />;
}
export function Wordmark({ className = "" }: { className?: string }) {
  return <img src="/rc-wordmark.png" alt="Renaissance Commerce" className={className} />;
}
