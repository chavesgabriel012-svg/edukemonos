import Link from "next/link";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-muted/40">
      <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{site.independenceNotice}</p>
        <p>
          {site.curriculumCredit}{" "}
          <a
            className="underline underline-offset-2"
            href="https://www.mep.go.cr/programas-estudio"
            rel="noopener noreferrer"
            target="_blank"
          >
            Ver programas en mep.go.cr
          </a>
        </p>
        <nav aria-label="Más información" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link className="underline underline-offset-2" href="/como-funciona">¿Cómo funciona?</Link>
          <Link className="underline underline-offset-2" href="/ia">Kemo y la IA</Link>
          <Link className="underline underline-offset-2" href="/privacidad">Aviso de privacidad</Link>
          <Link className="underline underline-offset-2" href="/docente">Panel docente</Link>
        </nav>
      </div>
    </footer>
  );
}
