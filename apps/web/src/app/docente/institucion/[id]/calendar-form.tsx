"use client";

import { suggestPeriods } from "@edukemonos/curriculum";
import { useActionState, useState } from "react";
import { saveInstitutionCalendar, type SettingsState } from "@/app/docente/actions";

type Row = { startsOn: string; endsOn: string; label: string };
const input = "w-full rounded-md border bg-background px-3 py-2 text-base";

/**
 * School calendar of an institution: classes, breaks and the periods of the streak repair
 * (2 semesters, 3 trimesters or custom). One repair per period for each student.
 */
export function CalendarForm({ institutionId, initial }: {
  institutionId: string;
  initial: { classesStart: string; classesEnd: string; breaks: Row[]; periods: Row[] };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveInstitutionCalendar.bind(null, institutionId), {});
  const [start, setStart] = useState(initial.classesStart);
  const [end, setEnd] = useState(initial.classesEnd);
  const [breaks, setBreaks] = useState<Row[]>(initial.breaks);
  const [periods, setPeriods] = useState<Row[]>(initial.periods);

  const preset = (n: number) => setPeriods(suggestPeriods({ classesStart: start, classesEnd: end, breaks }, n));
  const update = (list: Row[], set: (r: Row[]) => void, k: number, field: keyof Row, value: string) =>
    set(list.map((r, i) => (i === k ? { ...r, [field]: value } : r)));

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="font-medium">Inicio de clases</span>
          <input type="date" name="classes_start" required value={start} onChange={(e) => setStart(e.target.value)} className={input} />
        </label>
        <label className="space-y-1">
          <span className="font-medium">Fin de clases</span>
          <input type="date" name="classes_end" required value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
        </label>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-medium">Vacaciones dentro del año</legend>
        <p className="text-sm text-muted-foreground">Una semana sin ningún día de clases pausa las rachas: ni suma ni las rompe.</p>
        {breaks.map((b, k) => (
          <div key={k} className="grid gap-2 rounded-[14px] border p-3 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end">
            <label className="space-y-1 text-sm">Desde<input type="date" name="break_starts_on" value={b.startsOn} onChange={(e) => update(breaks, setBreaks, k, "startsOn", e.target.value)} className={input} /></label>
            <label className="space-y-1 text-sm">Hasta<input type="date" name="break_ends_on" value={b.endsOn} onChange={(e) => update(breaks, setBreaks, k, "endsOn", e.target.value)} className={input} /></label>
            <label className="space-y-1 text-sm">Nombre<input name="break_label" value={b.label} maxLength={60} onChange={(e) => update(breaks, setBreaks, k, "label", e.target.value)} className={input} /></label>
            <button type="button" onClick={() => setBreaks(breaks.filter((_, i) => i !== k))} className="min-h-11 rounded-md border px-3 text-sm">Quitar</button>
          </div>
        ))}
        {breaks.length < 8 && (
          <button type="button" onClick={() => setBreaks([...breaks, { startsOn: "", endsOn: "", label: "Vacaciones" }])} className="min-h-11 rounded-md border px-3 text-sm font-medium">
            Agregar vacaciones
          </button>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-medium">Periodos</legend>
        <p className="text-sm text-muted-foreground">Cada estudiante tiene un comodín por periodo para reparar una semana de su racha.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => preset(2)} className="min-h-11 rounded-md border px-3 text-sm font-medium">2 semestres</button>
          <button type="button" onClick={() => preset(3)} className="min-h-11 rounded-md border px-3 text-sm font-medium">3 trimestres</button>
        </div>
        {periods.map((p, k) => (
          <div key={k} className="grid gap-2 rounded-[14px] border p-3 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end">
            <label className="space-y-1 text-sm">Desde<input type="date" name="period_starts_on" value={p.startsOn} onChange={(e) => update(periods, setPeriods, k, "startsOn", e.target.value)} className={input} /></label>
            <label className="space-y-1 text-sm">Hasta<input type="date" name="period_ends_on" value={p.endsOn} onChange={(e) => update(periods, setPeriods, k, "endsOn", e.target.value)} className={input} /></label>
            <label className="space-y-1 text-sm">Nombre<input name="period_label" value={p.label} maxLength={60} onChange={(e) => update(periods, setPeriods, k, "label", e.target.value)} className={input} /></label>
            {periods.length > 1 && (
              <button type="button" onClick={() => setPeriods(periods.filter((_, i) => i !== k))} className="min-h-11 rounded-md border px-3 text-sm">Quitar</button>
            )}
          </div>
        ))}
        {periods.length < 4 && (
          <button type="button" onClick={() => setPeriods([...periods, { startsOn: "", endsOn: "", label: `Periodo ${periods.length + 1}` }])} className="min-h-11 rounded-md border px-3 text-sm font-medium">
            Agregar periodo
          </button>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Guardando…" : "Guardar calendario"}
        </button>
        {state.saved && <span role="status" className="text-sm">Calendario guardado. Ya lo usan las secciones de la institución.</span>}
        {state.error && <span role="alert" className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
