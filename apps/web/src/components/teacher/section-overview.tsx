import { formatLevel, type SectionMetrics } from "@edukemonos/curriculum";
import { Download } from "lucide-react";
import Link from "next/link";
import type { PanelSource } from "@/lib/teacher";
import type { StoredSummary } from "@/lib/teacher-summary";
import { ActivityBars, BarList, MasteryBar, StatTiles } from "./charts";
import { Findings } from "./findings";
import { Heatmap } from "./heatmap";
import { pct, relativeDay } from "./scale";

function Panel({ id, title, hint, children, className }: { id?: string; title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-t` : undefined} className={`min-w-0 scroll-mt-6 space-y-4 rounded-[22px] border bg-card p-5 sm:p-6 ${className ?? ""}`}>
      <div className="space-y-1">
        <h2 id={id ? `${id}-t` : undefined} className="font-heading text-2xl font-bold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function SectionOverview({ source, metrics, subjectId, summary }: {
  source: PanelSource;
  metrics: SectionMetrics;
  subjectId: string;
  summary: StoredSummary | null;
}) {
  const { base } = source;
  const o = metrics.overview;
  const support = metrics.students.filter((s) => s.support.length).sort((a, b) => b.support.length - a.support.length || (a.mastery ?? 1) - (b.mastery ?? 1));
  const topics = metrics.units.filter((u) => u.tutorSessions > 0).sort((a, b) => b.tutorSessions - a.tutorSessions).slice(0, 6);
  const writingTotal = metrics.writing.reduce((a, w) => a + w.count, 0);

  return (
    <div className="space-y-6">
      <StatTiles items={[
        { label: "Estudiantes en la sección", value: String(o.students) },
        { label: "Activos esta semana", value: `${o.active}`, hint: o.students ? `${pct(o.active / o.students)} de la sección` : undefined },
        { label: "Ejercicios esta semana", value: String(o.attempts7), hint: o.accuracy7 !== null ? `${pct(o.accuracy7)} de aciertos` : undefined },
        { label: "Dominio promedio", value: pct(o.mastery), hint: "Estimado con las respuestas a ejercicios" },
      ]} />

      <Panel id="resumen" title="¿Qué está pasando en la sección?" hint="Hallazgos calculados con los datos de la sección. Cada uno explica cómo se calculó.">
        <Findings target={source.demo ? "demo" : source.section.id} findings={metrics.findings} initial={summary} />
      </Panel>

      <Panel id="apoyo" title="Estudiantes que podrían necesitar apoyo"
        hint="Dominio promedio menor a 50 % o sin actividad en la última semana. Es una señal para conversar, no una etiqueta.">
        {support.length === 0 ? (
          <p className="text-sm text-muted-foreground">Por ahora nadie cumple esas condiciones.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {support.map((s) => (
              <li key={s.id}>
                <Link href={`${base}/estudiante/${s.id}`} className="flex h-full flex-col gap-1.5 rounded-[16px] border p-3.5 transition hover:border-violeta">
                  <span className="font-medium">{s.name}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {s.support.map((r) => <span key={r} className="rounded-full bg-[#FBF1D9] px-2 py-0.5 text-xs text-[#6B4A00]">{r}</span>)}
                  </span>
                  <span className="text-xs text-muted-foreground">Última actividad: {relativeDay(s.lastActive, source.data.now).toLowerCase()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel id="mapa" title="Mapa de calor por tema" hint="Dominio estimado de cada estudiante en cada tema de la materia. Pasa el cursor por una celda para ver el detalle.">
        <nav aria-label="Materia" className="flex flex-wrap gap-2">
          {metrics.subjects.map((s) => (
            <Link key={s.subjectId} href={`${base}?materia=${s.subjectId}#mapa`} aria-current={s.subjectId === subjectId ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${s.subjectId === subjectId ? "bg-tinta text-papel" : "bg-secondary hover:bg-muted"}`}>
              {s.subjectName}
            </Link>
          ))}
        </nav>
        <Heatmap metrics={metrics} subjectId={subjectId} base={base} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Actividad" hint="Últimas 4 semanas.">
          <ActivityBars activity={metrics.activity} />
        </Panel>
        <Panel title="Diagnóstico" hint="Nivel promedio del último diagnóstico de cada estudiante (3 es lo esperado en el grado).">
          <ul className="space-y-3">
            {metrics.diagnostics.map((g) => (
              <li key={g.subjectId} className="flex items-baseline justify-between gap-3 rounded-[16px] bg-secondary p-4">
                <span className="font-medium">{g.subjectName}</span>
                <span className="text-right">
                  <span className="font-heading text-2xl font-bold">{g.level === null ? "—" : formatLevel(g.level)}</span>
                  <span className="block text-xs text-muted-foreground">{g.count} de {o.students} lo hicieron</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Errores de escritura (Español)" hint="Conteo por tipo en las tareas de escritura. Los textos no se guardan.">
          <BarList unit="" empty="Todavía no hay tareas de escritura revisadas."
            rows={metrics.writing.map((w) => ({ key: w.category, label: w.label, value: w.count, note: `${w.students} est.` }))} />
          {writingTotal > 0 && <p className="text-xs text-muted-foreground">{writingTotal} errores en total.</p>}
        </Panel>
        <Panel title="Temas que más consultan con Kemo" hint="Solo el tema de cada conversación; el panel nunca muestra lo que escriben.">
          <BarList empty="Todavía nadie ha usado el tutor."
            rows={topics.map((u) => ({ key: u.unit.id, label: u.unit.title, value: u.tutorSessions, note: u.unit.subjectName }))} />
        </Panel>
      </div>

      <Panel id="estudiantes" title="Todos los estudiantes" hint="Toca un nombre para ver su detalle.">
        <div className="flex justify-end">
          <a href={`${base}/csv`} className="inline-flex h-10 items-center gap-2 rounded-[12px] border px-4 text-sm font-medium transition hover:bg-secondary">
            <Download aria-hidden className="size-4" /> Descargar CSV
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Estudiante</th>
                <th className="py-2 pr-3 font-medium">Última actividad</th>
                <th className="py-2 pr-3 font-medium">Ejercicios (7 días)</th>
                <th className="py-2 pr-3 font-medium">Aciertos</th>
                <th className="py-2 pr-3 font-medium">Dominio</th>
                {metrics.subjects.map((s) => <th key={s.subjectId} className="py-2 pr-3 font-medium">Diagnóstico {s.subjectName}</th>)}
                <th className="py-2 font-medium">Con Kemo</th>
              </tr>
            </thead>
            <tbody>
              {[...metrics.students].sort((a, b) => a.name.localeCompare(b.name, "es")).map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-3">
                    <Link href={`${base}/estudiante/${s.id}`} className="font-medium hover:text-violeta hover:underline">{s.name}</Link>
                    {s.support.length > 0 && <span className="ml-2 rounded-full bg-[#FBF1D9] px-2 py-0.5 text-xs text-[#6B4A00]">apoyo</span>}
                  </td>
                  <td className="py-2.5 pr-3">{relativeDay(s.lastActive, source.data.now)}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{s.attempts7}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{pct(s.accuracy)}</td>
                  <td className="py-2.5 pr-3"><MasteryBar value={s.mastery} /></td>
                  {metrics.subjects.map((sub) => {
                    const level = s.bySubject[sub.subjectId]?.level ?? null;
                    return <td key={sub.subjectId} className="py-2.5 pr-3 font-mono text-xs">{level === null ? "—" : formatLevel(level)}</td>;
                  })}
                  <td className="py-2.5 font-mono text-xs">{s.tutorSessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
