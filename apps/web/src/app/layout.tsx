import type { Metadata, Viewport } from "next";
import { Geist_Mono, League_Spartan, Outfit } from "next/font/google";
import { SiteFooter } from "@/components/site/site-footer";
import { RestReminder } from "@/components/learn/rest-reminder";
import { SiteHeader } from "@/components/site/site-header";
import { brand } from "@/lib/brand";
import { site } from "@/lib/site";
import "./globals.css";

/** Titles, logo and social pieces. */
const leagueSpartan = League_Spartan({
  variable: "--font-league-spartan",
  subsets: ["latin"],
});

/** Interface and reading. */
const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

/** Data: progress, counts, labels. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: `${site.name}: ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
};

export const viewport: Viewport = {
  themeColor: brand.violeta,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CR"
      className={`${leagueSpartan.variable} ${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-[10px] focus:bg-card focus:p-3 focus:font-medium"
        >
          Saltar al contenido
        </a>
        <SiteHeader />
        {/* Pages choose their own width: the landing is full-bleed, the rest sit in app/(app)/layout.tsx. */}
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <RestReminder />
      </body>
    </html>
  );
}
