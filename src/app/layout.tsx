import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted so the build never depends on Google Fonts being reachable.
const inter = localFont({ src: "../fonts/inter.woff2", variable: "--font-inter", display: "swap", weight: "100 900" });
const playfair = localFont({
  src: [
    { path: "../fonts/playfair.woff2", style: "normal", weight: "400 900" },
    { path: "../fonts/playfair-italic.woff2", style: "italic", weight: "400 900" },
  ],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Renaissance Commerce",
  description: "Your brand's numbers and creative, in the course's own language.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
