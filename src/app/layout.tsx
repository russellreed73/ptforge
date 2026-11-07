import type { Metadata, Viewport } from "next";
// Fonts are served from our own site (no Google Fonts request).
import "@fontsource/bebas-neue/400.css";
import "@fontsource/barlow/300.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/400.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";
import { DEFAULT_THEME } from "@/lib/themes";

export const metadata: Metadata = {
  title: { default: "PTForge", template: "%s · PTForge" },
  description: "Client, program and progress management for personal trainers and coaches.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme={DEFAULT_THEME} className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
