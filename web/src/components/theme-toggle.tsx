"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <button type="button" aria-label="Toggle light or dark theme"
      title="Toggle light or dark theme"
      onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-input bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      <Moon className="size-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-5 dark:block" aria-hidden="true" />
    </button>
  );
}
