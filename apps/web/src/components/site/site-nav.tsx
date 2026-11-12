"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "cn";
import { TryMenu } from "@/components/site/try-menu";

const LINKS = [
  { href: "/como-funciona", label: "Cómo funciona", match: ["/como-funciona"] },
  { href: "/ia", label: "Kemo y la IA", match: ["/ia"] },
  { href: "/familias", label: "Familias", match: ["/familias"] },
  { href: "/docentes", label: "Docentes", match: ["/docentes", "/docente"] },
  { href: "/colegios", label: "Colegios", match: ["/colegios"] },
] as const;

/** Main menu: inline on wide screens, a toggled panel on phones and tablets. */
export function SiteNav() {
  const pathname = usePathname();
  // Remember the page the menu was opened on, so it closes by itself after any navigation.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof value === "function" ? value(open) : value) ? pathname : null);

  const link = ({ href, label, match }: (typeof LINKS)[number], mobile = false) => {
    const current = match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
    return (
      <Link key={href} href={href} aria-current={current ? "page" : undefined} onClick={() => setOpen(false)}
        className={cn(
          "rounded-[10px] font-medium transition focus-visible:outline-2",
          mobile ? "block px-3 py-3 text-base hover:bg-secondary" : "px-2.5 py-2 text-sm hover:bg-secondary",
          current && "text-violeta",
        )}>
        {label}
      </Link>
    );
  };

  return (
    <nav aria-label="Menú principal" className="flex items-center gap-1">
      <div className="hidden items-center gap-0.5 lg:flex">{LINKS.map((l) => link(l))}</div>
      <TryMenu />
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="menu-movil"
        className="ml-1 inline-flex size-11 items-center justify-center rounded-[12px] hover:bg-secondary focus-visible:outline-2 lg:hidden">
        {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
      </button>
      {open && (
        <div id="menu-movil" className="absolute inset-x-0 top-full z-50 border-b bg-card px-4 pb-4 shadow-[0_12px_32px_-12px_rgba(23,19,42,0.25)] lg:hidden">
          {LINKS.map((l) => link(l, true))}
        </div>
      )}
    </nav>
  );
}
