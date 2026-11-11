import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SHELL } from "@/components/site/page-shell";
import { brand } from "@/lib/brand";
import { site } from "@/lib/site";

const COLUMNS = [
  {
    title: "Estudiar",
    links: [
      { href: "/estudiar", label: "Elegir mi año" },
      { href: "/unirme", label: "Unirme a mi sección" },
      { href: "/como-funciona", label: "¿Cómo funciona?" },
    ],
  },
  {
    title: "Familias y colegios",
    links: [
      { href: "/#familias", label: "Para familias" },
      { href: "/#colegios", label: "Para colegios" },
      { href: "/docente", label: "Panel docente" },
      { href: "/docente/demo", label: "Ver la demostración" },
    ],
  },
  {
    title: "Confianza",
    links: [
      { href: "/ia", label: "Kemo y la IA" },
      { href: "/privacidad", label: "Aviso de privacidad" },
      { href: "/#aliados", label: "Aliados e inversionistas" },
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
            Estudia a tu ritmo, de 7.º a 9.º, con los programas del MEP y un tutor que te guía sin darte la respuesta.
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
        <div className={`${SHELL} space-y-2 py-5 text-sm text-papel/75`}>
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
