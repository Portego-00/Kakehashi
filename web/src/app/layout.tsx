import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const bodyFont = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist" });
const monoFont = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-geist-mono" });

// Keep Jitai fonts self-hosted and load them only when selected or previewed.
const zenKurenaido = localFont({ src: "../../../assets/fonts/ZenKurenaido-Regular.ttf", variable: "--font-jitai-zen", display: "swap", preload: false, adjustFontFallback: false });
const yujiSyuku = localFont({ src: "../../../assets/fonts/YujiSyuku-Regular.ttf", variable: "--font-jitai-yuji", display: "swap", preload: false, adjustFontFallback: false });
const reggaeOne = localFont({ src: "../../../assets/fonts/ReggaeOne-Regular.ttf", variable: "--font-jitai-reggae", display: "swap", preload: false, adjustFontFallback: false });

export const metadata: Metadata = {
  title: { default: "Kakehashi", template: "%s · Kakehashi" },
  description: "A focused WaniKani study workspace for the web.",
  applicationName: "Kakehashi",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#111216" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${monoFont.variable} ${zenKurenaido.variable} ${yujiSyuku.variable} ${reggaeOne.variable}`} suppressHydrationWarning>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
