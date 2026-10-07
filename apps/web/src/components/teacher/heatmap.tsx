import type { SectionMetrics } from "@edukemonos/curriculum";
import Link from "next/link";
import { Tip } from "./charts";
import { MASTERY_BINS, masteryColor, NO_DATA_STYLE, pct } from "./scale";

/**
 * Students × units of one subject, colored by estimated mastery. Columns are numbered (T1, T2…)
 * and named in the list below, so long unit titles do not crowd the grid.
 */
export function Heatmap({ metrics, subjectId, base }: { metrics: SectionMetrics; subjectId: string; base: string }) {
  const units = metrics.units.filter((u) => u.unit.subjectId === subjectId);
  const students = [...metrics.students].sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (!units.length) return <p className="text-sm text-muted-foreground">Esta materia todavía no tiene temas publicados para el grado.</p>;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-[18px] border bg-card p-3">
        <table className="border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-card pr-2 text-left font-medium text-muted-foreground">Estudiante</th>
              {units.map((u, i) => (
                <th key={u.unit.id} scope="col" title={u.unit.title} className="w-8 min-w-8 font-mono font-medium text-muted-foreground">
                  T{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s, row) => (
              <tr key={s.id}>
                <th scope="row" className="sticky left-0 z-10 max-w-40 truncate bg-card pr-2 text-left font-normal">
                  <Link href={`${base}/estudiante/${s.id}`} className="hover:text-violeta hover:underline">{s.name}</Link>
                </th>
                {units.map((u, i) => {
                  const v = metrics.heat.get(s.id)?.get(u.unit.id) ?? null;
                  const text = `${s.name} · T${i + 1} ${u.unit.title}: ${v === null ? "sin datos" : `dominio ${pct(v)}`}`;
                  return (
                    <td key={u.unit.id} className="p-0">
                      <div tabIndex={0} aria-label={text}
                        className="group relative h-7 w-8 rounded-[4px] outline-offset-1 focus-visible:outline-2 focus-visible:outline-tinta"
                        style={v === null ? NO_DATA_STYLE : { backgroundColor: masteryColor(v) }}>
                        {/* The grid scrolls, so the first rows open their tooltip downwards to stay visible. */}
                        <Tip className={row < 2 ? "top-full bottom-auto mt-2 mb-0" : undefined}>{text}</Tip>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" aria-label="Leyenda: dominio estimado">
        <span className="font-medium">Dominio estimado:</span>
        {MASTERY_BINS.map((b) => (
          <span key={b.label} className="flex items-center gap-1.5">
            <span className="size-3.5 rounded-[4px]" style={{ backgroundColor: b.color }} />
            {b.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-[4px] border" style={NO_DATA_STYLE} />
          sin datos
        </span>
      </div>

      <ol className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {units.map((u, i) => (
          <li key={u.unit.id} className="flex min-w-0 items-baseline gap-2">
            <span className="w-7 shrink-0 font-mono text-xs text-muted-foreground">T{i + 1}</span>
            <Link href={`/unidad/${u.unit.id}`} className="min-w-0 flex-1 truncate hover:underline">{u.unit.title}</Link>
            <span className="shrink-0 font-mono text-xs" title={`${u.studentsWithData} estudiantes con datos`}>
              {u.mastery === null ? "—" : pct(u.mastery)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
