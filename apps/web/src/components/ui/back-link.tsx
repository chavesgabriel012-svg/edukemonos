import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/** «← Temas de Matemáticas»: the way back, above a page title. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] text-sm font-medium text-muted-foreground transition hover:text-violeta focus-visible:outline-2">
      <ArrowLeft aria-hidden strokeWidth={2.5} className="size-4" />
      {children}
    </Link>
  );
}
