import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getTheme } from "@/lib/theme";

// Renaissance Commerce font system: Satoshi for body and interface, Canela Light Italic for display
// headlines (Canela is registered in globals.css). Self-hosted so the build never depends on a font CDN.
const satoshi = localFont({ src: "../fonts/Satoshi-Variable.woff2", variable: "--font-satoshi", display: "swap", weight: "300 900" });
// Playfair is kept only for the typed "Renaissance Commerce" lockup, so the logo stays exactly as it was.
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme();
  return (
    <html lang="en" data-theme={theme} className={`${satoshi.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
