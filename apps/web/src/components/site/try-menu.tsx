"use client";

import { ChevronDown, ChevronRight, GraduationCap, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { action } from "@/components/ui/action";

const GROUPS = [
  {
    icon: GraduationCap,
    title: "Como estudiante",
    text: "Elige un año y recorre un tema.",
    links: [
      { href: "/estudiar/7", label: "Sétimo año" },
      { href: "/estudiar/8", label: "Octavo año" },
      { href: "/estudiar/9", label: "Noveno año" },
    ],
  },
  {
    icon: LayoutDashboard,
    title: "Como docente",
    text: "Paneles de demostración, con datos ficticios.",
    links: [
      { href: "/docente/demo", label: "Una sección" },
      { href: "/docente/demo/guia", label: "Docente guía: todas las materias" },
      { href: "/docente/demo/resumen", label: "Varias secciones, lado a lado" },
    ],
  },
] as const;

/** How long the menu waits before closing once the pointer has left it. */
const CLOSE_DELAY_MS = 150;

interface Triangle {
  left: number;
  top: number;
  width: number;
  height: number;
  /** The pointer's height inside the box; the apex is on the box's right edge. */
  apexY: number;
  /** The submenu's top and bottom inside the box; both on the box's left edge. */
  from: number;
  to: number;
}

/**
 * «Probar»: the ways to try Eduka. A button opens a list of two groups; on wide screens each group
 * opens its links in a panel to the side, on phones the links open in place. It works with mouse,
 * touch and keyboard, and closes with Escape, on leaving and after navigating.
 *
 * Going from a group to its side panel, the pointer naturally cuts the corner and crosses the
 * other group, which would switch the panel away from under it. The «safe triangle» (the
 * menu-aim technique Amazon made known) prevents that: an invisible shape from the pointer's
 * position to the two near corners of the side panel sits above the list, so while the pointer
 * travels toward the panel the other group never sees it. Moving straight up or down leaves the
 * triangle at once and switches groups as usual.
 */
export function TryMenu() {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const [active, setActive] = useState(0);
  const [triangle, setTriangle] = useState<Triangle | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closing.current) clearTimeout(closing.current);
    closing.current = null;
  };
  const show = () => {
    cancelClose();
    setOpenOn(pathname);
  };
  const hide = () => {
    cancelClose();
    setOpenOn(null);
    setTriangle(null);
    setActive(0);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpenOn(null);
      setTriangle(null);
      setActive(0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      root.current?.querySelector("button")?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => cancelClose, []);

  /** While the pointer is on the active group: the triangle from here to the side panel's near corners. */
  function aim(e: React.PointerEvent, index: number) {
    if (e.pointerType !== "mouse" || index !== active || !list.current) return;
    const side = list.current.querySelector<HTMLElement>(`[data-side="${index}"]`);
    if (!side || getComputedStyle(side).position !== "absolute") return setTriangle(null);
    const box = list.current.getBoundingClientRect();
    const s = side.getBoundingClientRect();
    const top = Math.min(s.top, e.clientY);
    const bottom = Math.max(s.bottom, e.clientY);
    setTriangle({
      left: s.right - box.left,
      top: top - box.top,
      width: e.clientX - s.right,
      height: bottom - top,
      apexY: e.clientY - top,
      from: s.top - top,
      to: s.bottom - top,
    });
  }

  return (
    <div ref={root} className="relative ml-1"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") show(); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") closing.current = setTimeout(hide, CLOSE_DELAY_MS); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) hide(); }}>
      <button type="button" aria-expanded={open} aria-controls="menu-probar" onClick={() => (open ? hide() : show())}
        className={cn(action({ variant: "lima", size: "md" }), "gap-1")}>
        Probar
        <ChevronDown aria-hidden strokeWidth={2.5} className={cn("size-4 transition", open && "rotate-180")} />
      </button>

      {/* The gap between the button and the list belongs to the menu, so crossing it does not close it. */}
      <div id="menu-probar" hidden={!open} className="absolute top-full right-0 z-50 pt-3">
        <div ref={list} className="relative w-[min(19rem,calc(100vw-2rem))] rounded-[20px] border bg-card p-2 shadow-[0_24px_48px_-20px_rgba(23,19,42,0.35)]">
          {GROUPS.map(({ icon: Icon, title, text, links }, i) => (
            <div key={title}>
              <button type="button" aria-expanded={active === i} aria-controls={`menu-probar-${i}`}
                onClick={() => setActive(i)}
                onPointerEnter={(e) => { if (e.pointerType === "mouse") { setActive(i); setTriangle(null); } }}
                onPointerMove={(e) => aim(e, i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[14px] p-3 text-left transition focus-visible:outline-2",
                  active === i ? "bg-secondary" : "hover:bg-secondary",
                )}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lima text-tinta">
                  <Icon aria-hidden strokeWidth={2.5} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-sm text-muted-foreground">{text}</span>
                </span>
                <ChevronRight aria-hidden strokeWidth={2.5} className={cn("size-4 shrink-0 text-muted-foreground transition lg:rotate-180", active === i && "rotate-90 lg:rotate-180")} />
              </button>
              {/* In place on phones; a panel to the left of the list on wide screens. */}
              <ul id={`menu-probar-${i}`} data-side={i} hidden={active !== i} onPointerEnter={() => setTriangle(null)}
                className="pb-1 pl-[3.25rem] lg:absolute lg:top-0 lg:right-full lg:mr-2 lg:w-64 lg:rounded-[20px] lg:border lg:bg-card lg:p-2 lg:shadow-[0_24px_48px_-20px_rgba(23,19,42,0.35)]">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} onClick={hide}
                      className="flex min-h-11 items-center rounded-[12px] px-3 py-2 font-medium transition hover:bg-lima focus-visible:outline-2">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {triangle && triangle.width > 0 && (
            <div aria-hidden data-safe-triangle
              style={{
                left: triangle.left,
                top: triangle.top,
                width: triangle.width,
                height: triangle.height,
                clipPath: `polygon(100% ${triangle.apexY}px, 0 ${triangle.from}px, 0 ${triangle.to}px)`,
              }}
              className="absolute z-10" />
          )}
        </div>
      </div>
    </div>
  );
}
