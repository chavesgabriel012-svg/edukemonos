import { computeSectionMetrics, formatLevel, WRITING_LABELS, type SectionMetrics } from "@edukemonos/curriculum";
import { BookOpenCheck, MessageCircleQuestion, PenLine, Target } from "lucide-react";
import Link from "next/link";
import type { PanelSource } from "@/lib/teacher";
import { ActivityBars, BarList, MasteryBar, StatTiles } from "./charts";
import { pct, relativeDay } from "./scale";

interface Event {
  at: string;
  icon: typeof Target;
  text: string;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-CR", { weekday: "short", day: "numeric", month: "short" });

export function StudentDetail({ source, metrics, studentId, actions }: {
  source: PanelSource;
  metrics: SectionMetrics;
  studentId: string;
  actions?: React.ReactNode;
}) {
  const d = source.data;
  const row = metrics.students.find((s) => s.id === studentId)!;
  const own = <T extends { studentId: string }>(xs: T[]) => xs.filter((x) => x.studentId === studentId);
  // Same metrics, over this student's data only.
  const mine = computeSectionMetrics({
    ...d,
    students: d.students.filter((s) => s.id === studentId),
    mastery: own(d.mastery),
    attempts: own(d.attempts),
    diagnostics: own(d.diagnostics),
    tutor: own(d.tutor),
    writing: own(d.writing),
  });
  const title = new Map(d.units.map((u) => [u.id, u.title]));

  const events: Event[] = [];
  // One line per day of practice, naming its topics.
  const days = new Map<string, { at: string; units: string[]; n: number; ok: number }>();
  for (const a of own(d.attempts)) {
    const day = a.createdAt.slice(0, 10);
    const g = days.get(day) ?? { at: a.createdAt, units: [], n: 0, ok: 0 };
    g.n++;
    if (a.isCorrect) g.ok++;
    if (a.createdAt > g.at) g.at = a.createdAt;
    if (a.unitId && !g.units.includes(a.unitId)) g.units.push(a.unitId);
    days.set(day, g);
  }
  for (const g of days.values()) {
    const names = g.units.map((u) => `«${title.get(u) ?? "un tema"}»`);
    const topics = names.length <= 2 ? names.join(" y ") : `${names.slice(0, 2).join(", ")} y ${names.length - 2} ${names.length === 3 ? "tema" : "temas"} más`;
    events.push({ at: g.at, icon: BookOpenCheck, text: `Practicó ${g.n} ${g.n === 1 ? "ejercicio" : "ejercicios"} (${g.ok} ${g.ok === 1 ? "correcto" : "correctos"})${topics ? ` de ${topics}` : ""}.` });
  }
  for (const t of own(d.tutor)) {
    events.push({ at: t.startedAt, icon: MessageCircleQuestion, text: `Consultó a Kemo sobre «${t.unitId ? title.get(t.unitId) ?? "un tema" : "un tema"}» (${Math.round(t.messageCount / 2)} preguntas).` });
  }
  const subjectName = new Map(metrics.subjects.map((s) => [s.subjectId, s.subjectName]));
  for (const g of own(d.diagnostics)) {
    events.push({ at: g.completedAt, icon: Target, text: `Hizo el diagnóstico de ${subjectName.get(g.subjectId) ?? g.subjectId}: nivel ${formatLevel(g.level)} de 5.` });
  }
  const tasks = new Map<string, Map<string, number>>();
  for (const w of own(d.writing)) {
    const m = tasks.get(w.createdAt) ?? new Map<string, number>();
    m.set(w.category, (m.get(w.category) ?? 0) + w.count);
    tasks.set(w.createdAt, m);
  }
  for (const [at, m] of tasks) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    events.push({ at, icon: PenLine, text: `Entregó una tarea de escritura: ${total} errores, sobre todo de ${(WRITING_LABELS[top[0]] ?? top[0]).toLowerCase()}.` });
  }
  events.sort((a, b) => b.at.localeCompare(a.at));

  const unitStats = metrics.units.map((u) => {
    const tries = own(d.attempts).filter((a) => a.unitId === u.unit.id && a.isCorrect !== null);
    return { u, mastery: metrics.heat.get(studentId)?.get(u.unit.id) ?? null, tries: tries.length, wrong: tries.filter((a) => !a.isCorrect).length };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-4xl leading-none font-bold">{row.name}</h1>
          <p className="text-muted-foreground">
            Última actividad: {relativeDay(row.lastActive, d.now).toLowerCase()} · Se unió el {fmtDate(d.students.find((s) => s.id === studentId)!.joinedAt)}
          </p>
          {row.support.length > 0 && (
            <p className="flex flex-wrap gap-1.5 pt-1">
              {row.support.map((r) => <span key={r} className="rounded-full bg-[#FBF1D9] px-2.5 py-0.5 text-xs text-[#6B4A00]">{r}</span>)}
            </p>
          )}
        </div>
        {actions}
      </div>

      <StatTiles items={[
        { label: "Ejercicios respondidos", value: String(row.attemptsTotal), hint: `${row.attempts7} en los últimos 7 días` },
        { label: "Aciertos", value: pct(row.accuracy) },
        { label: "Dominio promedio", value: pct(row.mastery), hint: `${row.unitsWithData} temas con datos` },
        { label: "Conversaciones con Kemo", value: String(row.tutorSessions) },
      ]} />

      <div className="grid gap-6 lg:grid-cols-2">
        {metrics.subjects.map((sub) => {
          const s = row.bySubject[sub.subjectId];
          const units = unitStats.filter((x) => x.u.unit.subjectId === sub.subjectId);
          return (
            <section key={sub.subjectId} className="min-w-0 space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-2xl font-bold">{sub.subjectName}</h2>
                <span className="text-sm text-muted-foreground">
                  Diagnóstico: <span className="font-semibold text-foreground">{s?.level == null ? "sin hacer" : `nivel ${formatLevel(s.level)} de 5`}</span>
                </span>
              </div>
              <ul className="divide-y text-sm">
                {units.map(({ u, mastery, tries, wrong }) => (
                  <li key={u.unit.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{u.unit.title}</span>
                      {tries > 0 && <span className="text-xs text-muted-foreground">{tries} intentos · {wrong} con error</span>}
                    </span>
                    <MasteryBar value={mastery} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="min-w-0 space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
          <h2 className="font-heading text-2xl font-bold">Actividad</h2>
          <ActivityBars activity={mine.activity} />
        </section>
        <section className="min-w-0 space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
          <h2 className="font-heading text-2xl font-bold">Errores de escritura por tipo</h2>
          <BarList empty="Todavía no tiene tareas de escritura revisadas."
            rows={mine.writing.map((w) => ({ key: w.category, label: w.label, value: w.count }))} />
          <p className="text-xs text-muted-foreground">Solo se guarda el conteo por tipo de error; sus textos no se guardan.</p>
        </section>
      </div>

      <section className="min-w-0 space-y-4 rounded-[22px] border bg-card p-5 sm:p-6">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl font-bold">Línea de tiempo</h2>
          <p className="text-sm text-muted-foreground">Lo más reciente primero. De Kemo solo se muestra el tema, nunca la conversación.</p>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay actividad.</p>
        ) : (
          <ol className="space-y-3">
            {events.slice(0, 20).map((e, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary"><e.icon aria-hidden className="size-4" /></span>
                <span>
                  <span className="block font-mono text-xs text-muted-foreground">{fmtDate(e.at)}</span>
                  {e.text}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-sm">
        <Link href={`${source.base}#estudiantes`} className="font-medium underline underline-offset-2">← Volver a la sección</Link>
      </p>
    </div>
  );
}
