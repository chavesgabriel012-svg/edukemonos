import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SHELL } from "@/components/site/page-shell";
import { brand } from "@/lib/brand";
import { site } from "@/lib/site";

const COLUMNS = [
  {
    title: "Probar",
    links: [
      { href: "/estudiar", label: "Como estudiante" },
      { href: "/docente/demo", label: "Panel docente de demostración" },
      { href: "/como-funciona", label: "¿Cómo funciona?" },
    ],
  },
  {
    title: "Para quién",
    links: [
      { href: "/familias", label: "Familias" },
      { href: "/docentes", label: "Docentes" },
      { href: "/colegios", label: "Colegios" },
    ],
  },
  {
    title: "Confianza",
    links: [
      { href: "/ia", label: "Kemo y la IA" },
      { href: "/privacidad", label: "Aviso de privacidad" },
    ],
  },
] as const;

const linkClass = "inline-block py-1.5 text-papel/75 underline-offset-2 transition hover:text-white hover:underline";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-tinta text-papel">
      <div className={`${SHELL} grid gap-8 py-10 md:grid-cols-[1.3fr_repeat(3,1fr)]`}>
        <div className="space-y-4">
          <Logo size={28} ink={brand.papel} />
          <p className="max-w-xs text-sm text-papel/75">
            Estudio con IA para secundaria, con los programas del MEP y un tutor que guía sin dar la respuesta. En fase de prueba.
          </p>
          {site.contactEmail && (
            <p className="text-sm">
              <a href={`mailto:${site.contactEmail}`} className="font-medium text-lima underline underline-offset-2">{site.contactEmail}</a>
            </p>
          )}
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="text-sm">
            <p className="mb-2 font-mono text-xs tracking-wide text-papel/60 uppercase">{c.title}</p>
            <ul>
              {c.links.map((l) => (
                <li key={l.href}><Link href={l.href} className={linkClass}>{l.label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className={`${SHELL} space-y-2 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-sm text-papel/75`}>
          <p className="font-medium text-papel">{site.independenceNotice}</p>
          <p>
            {site.curriculumCredit}{" "}
            <a className="underline underline-offset-2 hover:text-white" href="https://www.mep.go.cr/programas-estudio" rel="noopener noreferrer" target="_blank">
              Ver programas en mep.go.cr
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
