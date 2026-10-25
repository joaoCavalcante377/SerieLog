"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { messages } from "@/lib/messages/pt-BR";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label={messages.nav.toggleTheme}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="text-muted hover:bg-surface-2 hover:text-foreground inline-flex h-11 w-11 items-center justify-center rounded-md"
    >
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden />
      <Moon className="h-5 w-5 dark:hidden" aria-hidden />
    </button>
  );
}
