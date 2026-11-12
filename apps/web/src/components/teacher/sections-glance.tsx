import Link from "next/link";
import { formatCode, type SectionGlance } from "@/lib/teacher";
import { pct } from "./scale";

/**
 * All of a teacher's sections at a glance, by subject: a Math teacher of 7-1 and 8-3 sees both
 * groups side by side, with who could need support in each. Same numbers as each section's panel.
 */
export function SectionsGlance({ sections, demo = false }: { sections: SectionGlance[]; demo?: boolean }) {
  const bySubject = new Map<string, SectionGlance[]>();
  for (const s of sections) {
    const key = s.subjectName ?? "Todas las materias";
    bySubject.set(key, [...(bySubject.get(key) ?? []), s]);
  }
  // Each student once, even if they are in several of the teacher's subjects (7-1 Math and 7-1 Spanish).
  const students = new Set(sections.flatMap((s) => s.studentIds)).size;
  const support = new Set(sections.flatMap((s) => s.supportIds)).size;
  return (
    <div className="space-y-6">
      {sections.length > 1 && (
        <p className="text-sm text-muted-foreground">
          {sections.length} secciones · {students} {students === 1 ? "estudiante" : "estudiantes"} en total
          {support ? ` · ${support} podrían necesitar apoyo` : ""}.
        </p>
      )}
      {[...bySubject].map(([subject, list]) => (
        <section key={subject} aria-label={subject} className="space-y-3">
          <h2 className="font-heading text-2xl font-bold">{subject}</h2>
          <ul className="grid gap-3 lg:grid-cols-2">
            {list.map((s) => {
              const n = s.snapshot;
              return (
                <li key={s.id} className="flex h-full flex-col gap-3 rounded-[22px] border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{s.gradeId}.º AÑO{s.subjectName ? " · GRUPO" : ""}</p>
                      <p className="font-heading text-3xl leading-none font-bold">{s.label}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-xs font-semibold tracking-wider">{formatCode(s.joinCode)}</span>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Estudiantes</dt>
                      <dd className="font-heading text-xl font-bold">{n.students}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Activos (7 días)</dt>
                      <dd className="font-heading text-xl font-bold">{n.active}{n.activeShare !== null && <span className="ml-1 text-xs font-normal text-muted-foreground">{pct(n.activeShare)}</span>}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Dominio</dt>
                      <dd className="font-heading text-xl font-bold">{pct(n.mastery)}</dd>
                    </div>
                  </dl>
                  {s.goal && !s.goal.paused && (
                    <p className="text-sm">Meta de la semana: <strong>{s.goal.progress} de {s.goal.target}</strong> habilidades</p>
                  )}
                  {n.support.length > 0 ? (
                    <div className="space-y-1.5 rounded-[16px] bg-[#FBF1D9] p-3 text-sm text-[#4A3300]">
                      <p className="font-medium">Podrían necesitar apoyo ({n.support.length})</p>
                      <ul className="space-y-1">
                        {n.support.slice(0, 3).map((st) => (
                          <li key={st.id}>
                            {demo ? <span className="font-medium">{st.name}</span> : (
                              <Link href={`${s.href}/estudiante/${st.id}`} className="font-medium underline underline-offset-2">{st.name}</Link>
                            )}
                            {": "}{st.reasons.join(" y ")}
                          </li>
                        ))}
                      </ul>
                      {n.support.length > 3 && <Link href={`${s.href}#apoyo`} className="inline-block font-medium underline underline-offset-2">Ver {n.support.length - 3} más</Link>}
                    </div>
                  ) : n.students > 0 ? (
                    <p className="text-sm text-muted-foreground">Por ahora nadie parece necesitar apoyo.</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Todavía no hay estudiantes: compártales el código del grupo.</p>
                  )}
                  <Link href={s.href} className="mt-auto inline-flex min-h-11 items-center self-start rounded-md border px-4 py-2 text-sm font-medium transition hover:border-violeta">
                    Abrir el panel
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
