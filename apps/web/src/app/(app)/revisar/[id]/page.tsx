import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatSkills, pagesToLoad, publishBlockers, STATUS_LABEL, type SkillRow, type UnitRow } from "@/lib/review";
import { requireReviewer } from "@/lib/staff";
import { saveUnit, setStatus } from "../actions";
import { NotReviewer } from "../forbidden";

export const metadata: Metadata = { title: "Revisar unidad" };

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";

export default async function ReviewUnitPage({ params, searchParams }: PageProps<"/revisar/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user, allowed } = await requireReviewer(`/revisar/${id}`);
  if (!allowed) return <NotReviewer email={user.email} />;

  const { data: unit } = await supabase.from("curriculum_units").select("*").eq("id", id).maybeSingle<UnitRow>();
  if (!unit) notFound();
  const [{ data: skills }, { data: source }, { data: history }] = await Promise.all([
    supabase.from("skills").select("id, code, name, sort_order, source_page").eq("unit_id", id).order("sort_order").returns<SkillRow[]>(),
    supabase.from("curriculum_sources").select("title, version, url").eq("id", unit.source_id).single(),
    supabase.from("review_log").select("action, created_at, actor_id").eq("entity_type", "unit").eq("entity_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const skillRows = skills ?? [];
  const pageNumbers = pagesToLoad(unit, skillRows.map((s) => s.source_page ?? unit.source_page));
  const { data: pageRows } = await supabase
    .from("curriculum_pages")
    .select("page, text")
    .eq("source_id", unit.source_id)
    .in("page", pageNumbers)
    .order("page");

  const issues = unit.extraction_meta.issues ?? [];
  const blockers = publishBlockers(unit, skillRows.length);
  const editable = unit.status !== "published";
  const notice = typeof query.aviso === "string" ? query.aviso : null;
  const pdfLink = (page: number) => `${source?.url ?? "#"}#page=${page}`;

  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <Link href={`/revisar?materia=${unit.subject_id}&grado=${unit.grade_id}`} className="text-sm underline underline-offset-2">
          ← Volver a la lista
        </Link>
        <h1 className="text-2xl font-bold">{unit.title}</h1>
        <p className="text-sm text-muted-foreground">
          {unit.area ?? "Sin área"} · {unit.grade_id}.º · Estado: <strong>{STATUS_LABEL[unit.status]}</strong>
          {unit.extraction_meta.model ? ` · Extraída con IA (${unit.extraction_meta.model})` : ""}
        </p>
        <Link href={`/revisar/${unit.id}/contenido`} className="inline-block text-sm font-medium underline underline-offset-2">
          Material de estudio e ítems de práctica →
        </Link>
      </header>

      {notice && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{notice}</p>}
      {query.guardado === "1" && !notice && <p role="status" className="rounded-lg border p-3 text-sm">Cambios guardados y verificados de nuevo.</p>}

      {issues.length > 0 && (
        <section aria-labelledby="issues" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <h2 id="issues" className="font-semibold">Por verificar ({issues.length})</h2>
          <p className="text-sm">
            Estos textos no aparecen tal cual en la página citada. Corrígelos copiando el texto exacto del programa, o elimínalos.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {issues.map((i, k) => (
              <li key={k}><strong>{i.problem}:</strong> “{i.value}”</li>
            ))}
          </ul>
        </section>
      )}

      {unit.subject_id === "matematicas" && (
        <p className="text-sm text-muted-foreground">
          Nota: en el texto extraído de Matemáticas se pierden exponentes y algunos signos. Compara con el PDF antes de aprobar.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={saveUnit.bind(null, unit.id)} className="space-y-4">
          <fieldset disabled={!editable} className="space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Título</span>
              <input name="title" defaultValue={unit.title} required className={field} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-sm font-medium">Área</span>
                <input name="area" defaultValue={unit.area ?? ""} className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Trimestre (opcional)</span>
                <select name="term" defaultValue={unit.term ?? ""} className={field}>
                  <option value="">Sin asignar</option>
                  <option value="1">Primero</option>
                  <option value="2">Segundo</option>
                  <option value="3">Tercero</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Habilidades (una por línea: código | texto | página)</span>
              <textarea name="skills" rows={6} defaultValue={formatSkills(skillRows, unit.source_page)} className={field} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Contenidos (uno por línea)</span>
              <textarea name="contents" rows={4} defaultValue={unit.contents.join("\n")} className={field} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">Resultados de aprendizaje (uno por línea)</span>
              <textarea name="learning_outcomes" rows={3} defaultValue={unit.learning_outcomes.join("\n")} className={field} />
            </label>
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <label className="block space-y-1">
                <span className="text-sm font-medium">Extracto textual de la fuente (máx. 400 caracteres)</span>
                <textarea name="source_excerpt" rows={3} maxLength={400} defaultValue={unit.source_excerpt} required className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Página</span>
                <input name="source_page" type="number" min={1} defaultValue={unit.source_page} required className={field} />
              </label>
            </div>
            <button type="submit" className="rounded-md border px-4 py-2 text-sm font-medium">
              Guardar y verificar
            </button>
          </fieldset>
        </form>

        <aside aria-label="Texto fuente" className="space-y-3">
          <p className="text-sm">
            <strong>{source?.title}</strong> ({source?.version}).{" "}
            <a href={pdfLink(unit.source_page)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              Abrir el PDF oficial en la página {unit.source_page}
            </a>
          </p>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto rounded-lg border bg-muted/30 p-3">
            {(pageRows ?? []).map((p: { page: number; text: string }) => (
              <section key={p.page}>
                <h3 className="sticky top-0 bg-muted/90 py-1 text-xs font-semibold">Página {p.page}</h3>
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed">{p.text}</pre>
              </section>
            ))}
            {(pageRows ?? []).length === 0 && <p className="text-sm text-muted-foreground">No hay texto guardado para estas páginas.</p>}
          </div>
        </aside>
      </div>

      <section aria-label="Estado" className="flex flex-wrap items-center gap-2 border-t pt-4">
        <form action={setStatus.bind(null, unit.id, "reviewed")}>
          <button disabled={unit.status === "reviewed"} className="rounded-md border px-4 py-2 text-sm">Marcar como revisada</button>
        </form>
        <form action={setStatus.bind(null, unit.id, "published")}>
          <button disabled={unit.status === "published"} title={blockers.join("; ") || undefined}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            Publicar para estudiantes
          </button>
        </form>
        <form action={setStatus.bind(null, unit.id, "rejected")}>
          <button disabled={unit.status === "rejected"} className="rounded-md border border-destructive/40 px-4 py-2 text-sm text-destructive">Rechazar</button>
        </form>
        {unit.status !== "draft" && (
          <form action={setStatus.bind(null, unit.id, "draft")}>
            <button className="rounded-md px-4 py-2 text-sm underline underline-offset-2">Volver a borrador</button>
          </form>
        )}
        {blockers.length > 0 && <p className="text-xs text-muted-foreground">Para publicar: {blockers.join("; ")}.</p>}
      </section>

      {(history ?? []).length > 0 && (
        <section aria-labelledby="history" className="space-y-1 text-sm">
          <h2 id="history" className="font-semibold">Historial de revisión</h2>
          <ul className="text-muted-foreground">
            {(history ?? []).map((h: { action: string; created_at: string; actor_id: string }, k: number) => (
              <li key={k}>
                {new Date(h.created_at).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })} · {h.action}
                {h.actor_id === user.id ? " (tú)" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
