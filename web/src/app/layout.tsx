import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import ThemeProvider from "@/components/theme-provider";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const plexCondensed = IBM_Plex_Sans_Condensed({ variable: "--font-plex-cond", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Unloading Tracker | EFL · 3PL", template: "%s | Unloading Tracker" },
  description: "EFL · 3PL unloading tracker for invoice progress, AX/D365 processing and ASN updates.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable} h-full`}>
      <body className="min-h-full bg-background font-sans text-foreground antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
