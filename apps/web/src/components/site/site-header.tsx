import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SiteNav } from "@/components/site/site-nav";
import { site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="relative border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" aria-label={`${site.name}: inicio`} className="rounded-md focus-visible:outline-2">
          <Logo size={30} />
        </Link>
        <SiteNav />
      </div>
    </header>
  );
}
