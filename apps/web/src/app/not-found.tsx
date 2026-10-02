import Link from "next/link";
import { Kemo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-5 py-10 text-center">
      <Kemo size={120} mood="wow" background={brand.lima} />
      <p className="font-mono text-sm text-muted-foreground">Error 404</p>
      <h1 className="font-heading text-4xl leading-none font-bold">No encontramos esta página</h1>
      <p className="text-muted-foreground">Puede que el enlace esté mal escrito o que el tema ya no esté publicado.</p>
      <Link href="/"
        className="inline-flex h-[52px] items-center rounded-[14px] bg-primary px-6 font-semibold text-primary-foreground focus-visible:outline-2">
        Volver al inicio
      </Link>
    </section>
  );
}
