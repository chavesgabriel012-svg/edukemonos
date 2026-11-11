import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SHELL } from "@/components/site/page-shell";
import { SiteNav } from "@/components/site/site-nav";
import { site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
      <div className={`${SHELL} flex items-center justify-between gap-3 py-2.5`}>
        <Link href="/" aria-label={`${site.name}: inicio`} className="rounded-md focus-visible:outline-2">
          <Logo size={30} />
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
