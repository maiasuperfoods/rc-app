import { Logo } from "@/components/logo";
import { getTheme } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";

/** Centered card used by sign-in and set-password. */
export async function AuthFrame({ children }: { children: React.ReactNode }) {
  const theme = await getTheme();
  return (
    <div className="min-h-screen grid place-items-center px-5 relative">
      <div className="absolute top-4 right-4"><ThemeToggle initial={theme} compact /></div>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <Logo className="h-9 w-9" />
          <div className="wordmark text-cream text-lg">Ren<span className="text-gold italic">ai</span>ssance <span className="text-dim text-xs tracking-[0.2em] uppercase">Commerce</span></div>
        </div>
        <div className="card p-6">{children}</div>
        <p className="text-center text-xs text-mute mt-6">app.renaissancecommerce.com</p>
      </div>
    </div>
  );
}
