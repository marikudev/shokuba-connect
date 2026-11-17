import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Myanmar } from "next/font/google";
import type { ReactNode } from "react";

import { MockBadge } from "@/components/MockBadge";
import { ja } from "@/lib/i18n/ja";

import "./globals.css";

// Fonts (PRD section 6): Geist covers the Latin panels including
// Vietnamese diacritics via its vietnamese subset (latin-ext covers
// Portuguese), and Noto Sans Myanmar covers the Burmese panel.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

const notoSansMyanmar = Noto_Sans_Myanmar({
  variable: "--font-noto-myanmar",
  subsets: ["myanmar", "latin"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: ja.shokubaTitle,
  description: ja.appDescription,
};

// The props are typed explicitly instead of using the generated
// LayoutProps helper, so `npm run check` also passes on a fresh clone
// where .next/types has not been generated yet.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansMyanmar.variable} h-full antialiased`}
    >
      {/* Fixed app shell : the page itself never
          scrolls; only the card list inside the main screen scrolls. */}
      <body className="flex h-dvh flex-col overflow-hidden">
        {/* No banner lives here: the prohibition sentence sits
            above the translate button, and the gate carries it
            inside its consent box. */}
        {process.env.LLM_MODE === "mock" ? <MockBadge /> : null}
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
