"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

/** Toasts follow the app theme (not the OS one) so their contrast always matches the page. */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "light" ? "light" : "dark"} />;
}
