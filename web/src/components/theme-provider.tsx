"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export default function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem
      disableTransitionOnChange storageKey="unloading-tracker-theme">
      {children}
    </NextThemesProvider>
  );
}
