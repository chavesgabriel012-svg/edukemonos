import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label={`${site.name}: inicio`} className="rounded-md focus-visible:outline-2">
          <Logo size={30} />
        </Link>
        <Link href="/unirme" className="text-sm font-medium underline underline-offset-2">
          Únete a tu sección
        </Link>
      </div>
    </header>
  );
}
