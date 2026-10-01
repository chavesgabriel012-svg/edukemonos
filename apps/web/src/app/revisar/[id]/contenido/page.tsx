import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  contentCounts,
  contentLabel,
  currentMaterials,
  type ItemRow,
  itemCheckSummary,
  MATERIAL_LABEL,
  type MaterialRow,
  READING_LABEL,
} from "@/lib/content-review";
import { requireReviewer } from "@/lib/staff";
import { NotReviewer } from "../../forbidden";
import { approveAllChecked, type ContentAction, saveMaterial, setContentStatus } from "./actions";

export const metadata: Metadata = { title: "Revisar material e ítems" };

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";

function StatusButtons({ unitId, table, id, status }: { unitId: string; table: "materials" | "items"; id: string; status: string }) {
  const button = (action: ContentAction, label: string, cls: string, disabled = false) => (
    <form action={setContentStatus.bind(null, unitId, table, id, action)}>
      <button disabled={disabled} className={`rounded-md px-3 py-1.5 text-xs disabled:opacity-50 ${cls}`}>{label}</button>
    </form>
  );
  return (
    <div className="flex flex-wrap gap-2">
      {button("approve", "Aprobar y publicar", "bg-primary font-medium text-primary-foreground")}
      {button("reject", "Rechazar", "border border-destructive/40 text-destructive", status === "rejected")}
      {status !== "draft" && button("draft", "Volver a borrador", "underline underline-offset-2")}
    </div>
  );
}

export default async function ReviewContentPage({ params }: PageProps<"/revisar/[id]/contenido">) {
  const { id } = await params;
  const { supabase, user, allowed } = await requireReviewer(`/revisar/${id}/contenido`);
  if (!allowed) return <NotReviewer email={user.email} />;

  const { data: unit } = await supabase
    .from("curriculum_units")
    .select("id, title, area, grade_id, subject_id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; title: string; area: string | null; grade_id: number; subject_id: string; status: string }>();
  if (!unit) notFound();

  const [{ data: materialRows }, { data: itemData, error: itemsError }, { data: skills }] = await Promise.all([
    supabase.from("materials").select("*").eq("unit_id", id).order("created_at", { ascending: false }).returns<MaterialRow[]>(),
    // Answer keys come through review_items(), which checks the reviewer role itself.
    supabase.rpc("review_items", { p_unit_id: id }),
    supabase.from("skills").select("id, name").eq("unit_id", id).order("sort_order"),
  ]);
  const itemRows = (itemData ?? []) as ItemRow[];
  const materials = currentMaterials(materialRows ?? []);
  const items = itemRows.filter((i) => i.status !== "rejected");
  const rejected = itemRows.length - items.length;
  const skillName = new Map((skills ?? []).map((s: { id: string; name: string }) => [s.id, s.name]));
  const counts = contentCounts(materialRows ?? [], itemRows ?? []);

  return (
    <article id="top" className="space-y-8">
      <header className="space-y-1">
        <Link href={`/revisar/${id}`} className="text-sm underline underline-offset-2">← Volver a la unidad</Link>
        <h1 className="text-2xl font-bold">Material e ítems · {unit.title}</h1>
        <p className="text-sm text-muted-foreground">
          {unit.area ?? "Sin área"} · {unit.grade_id}.º · Material: {counts.materialsPublished} publicados, {counts.materialsDraft} en borrador ·
          Ítems: {counts.itemsPublished} publicados, {counts.itemsVerified} verificados, {counts.itemsDraft} en borrador
          {rejected ? ` · ${rejected} rechazados (ocultos)` : ""}
        </p>
      </header>

      {unit.status !== "published" && (
        <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          La unidad no está publicada: los estudiantes no verán este contenido aunque lo publiques.
        </p>
      )}
      {itemsError && <p role="alert" className="text-destructive">No se pudieron cargar los ítems: {itemsError.message}</p>}

      {materials.length === 0 && itemRows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no hay contenido generado. Se genera con <code>pnpm content generate --subject {unit.subject_id} --grade {unit.grade_id} --yes</code>.
        </p>
      ) : (
        <form action={approveAllChecked.bind(null, id)} className="rounded-lg border p-4">
          <p className="mb-2 text-sm">
            Aprueba de una vez el material sin errores de la revisión automática y los ítems verificados. Lo que no pasó las
            verificaciones se queda como está.
          </p>
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Aprobar todo lo verificado</button>
        </form>
      )}

      <section aria-labelledby="materiales" className="space-y-4">
        <h2 id="materiales" className="text-xl font-semibold">Material de estudio</h2>
        {materials.map((m) => {
          const problems = m.verification.problems ?? [];
          return (
            <div key={m.id} id={m.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{MATERIAL_LABEL[m.kind]}</h3>
                <span className="rounded bg-muted px-2 py-0.5 text-xs">{contentLabel(m)}</span>
              </div>
              {problems.length > 0 && (
                <ul className="list-disc space-y-1 rounded-md bg-amber-50 p-3 pl-6 text-sm text-amber-950">
                  {problems.map((p, k) => (
                    <li key={k}><strong>{p.severity === "error" ? "Error" : "Sugerencia"}:</strong> {p.explanation} {p.quote && <em>(“{p.quote}”)</em>}</li>
                  ))}
                </ul>
              )}
              <form action={saveMaterial.bind(null, id, m.id)} className="space-y-2">
                <textarea name="content" rows={Math.min(24, Math.max(6, m.content.split("\n").length + 1))} defaultValue={m.content}
                  aria-label={`Texto de ${MATERIAL_LABEL[m.kind]}`} className={`${field} font-mono text-xs leading-relaxed`} />
                <button className="rounded-md border px-3 py-1.5 text-xs">Guardar cambios (cuenta como revisado)</button>
              </form>
              <StatusButtons unitId={id} table="materials" id={m.id} status={m.status} />
            </div>
          );
        })}
      </section>

      <section aria-labelledby="items" className="space-y-4">
        <h2 id="items" className="text-xl font-semibold">Ítems de práctica</h2>
        <p className="text-sm text-muted-foreground">
          Solo los ítems verificados entran al diagnóstico. Un ítem aprobado sin verificar sirve para practicar, pero no para el diagnóstico.
        </p>
        {items.map((it, n) => (
          <div key={it.id} id={it.id} className={`space-y-3 rounded-lg border p-4 ${it.verified || it.kind === "open_writing" ? "" : "border-amber-300"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold">
                Ítem {n + 1} · {it.kind === "open_writing" ? "Escritura abierta" : "Selección única"} · dificultad {it.difficulty}
                {it.reading_level ? ` · lectura ${READING_LABEL[it.reading_level].toLowerCase()}` : ""}
              </span>
              <span className="rounded bg-muted px-2 py-0.5">{contentLabel(it)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Habilidad: {it.skill_ids.map((s) => skillName.get(s) ?? "—").join("; ") || "—"}</p>
            <pre className="whitespace-pre-wrap font-sans text-sm">{it.stem}</pre>
            {it.options && (
              <ol className="space-y-1 text-sm">
                {it.options.map((o, k) => (
                  <li key={k} className={k === it.correct_index ? "font-semibold text-primary" : ""}>
                    {k === it.correct_index ? "✓ " : "· "}{o}
                    {k !== it.correct_index && it.distractor_explanations?.[k] && (
                      <span className="block pl-4 text-xs font-normal text-muted-foreground">{it.distractor_explanations[k]}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {it.explanation && (
              <details className="text-sm">
                <summary className="cursor-pointer">{it.kind === "open_writing" ? "Criterios de retroalimentación" : "Explicación"}</summary>
                <pre className="mt-1 whitespace-pre-wrap font-sans">{it.explanation}</pre>
              </details>
            )}
            <p className={`text-xs ${it.verified ? "text-muted-foreground" : "text-amber-900"}`}>{itemCheckSummary(it)}</p>
            <StatusButtons unitId={id} table="items" id={it.id} status={it.status} />
          </div>
        ))}
      </section>
    </article>
  );
}
