import { cookies } from "next/headers";
import type { Theme } from "@/components/theme-toggle";

export async function getTheme(): Promise<Theme> {
  const c = (await cookies()).get("rc_theme")?.value;
  return c === "light" ? "light" : "dark";
}
