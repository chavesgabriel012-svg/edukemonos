"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  diff,
  pagesToLoad,
  parseUnitForm,
  publishBlockers,
  recheck,
  type SkillRow,
  type UnitRow,
  type UnitStatus,
} from "@/lib/review";
import { requireReviewer } from "@/lib/staff";

type Supabase = Awaited<ReturnType<typeof requireReviewer>>["supabase"];

/** Expected refusals go back to the page as a visible notice (thrown messages are hidden in production). */
function warn(unitId: string, message: string): never {
  redirect(`/revisar/${unitId}?aviso=${encodeURIComponent(message)}`);
}

async function reviewerOrThrow(unitId: string) {
  const r = await requireReviewer(`/revisar/${unitId}`);
  if (!r.allowed) throw new Error("Solo revisores o administradores pueden cambiar unidades.");
  return r;
}

async function loadUnit(supabase: Supabase, id: string) {
  const { data: unit, error } = await supabase.from("curriculum_units").select("*").eq("id", id).single<UnitRow>();
  if (error || !unit) throw new Error("Unidad no encontrada.");
  const { data: skills } = await supabase
    .from("skills")
    .select("id, code, name, sort_order, source_page")
    .eq("unit_id", id)
    .order("sort_order")
    .returns<SkillRow[]>();
  return { unit, skills: skills ?? [] };
}

async function log(supabase: Supabase, actorId: string, unitId: string, action: string, changes: unknown) {
  const { error } = await supabase
    .from("review_log")
    .insert({ entity_type: "unit", entity_id: unitId, action, actor_id: actorId, diff: changes });
  if (error) throw new Error(`No se pudo registrar la revisión: ${error.message}`);
}

/** Saves a reviewer's edit and re-runs the verbatim checks against the stored page texts. */
export async function saveUnit(unitId: string, form: FormData) {
  const { supabase, user } = await reviewerOrThrow(unitId);
  const { unit, skills } = await loadUnit(supabase, unitId);
  if (unit.status === "published") warn(unitId, "Una unidad publicada no se edita: devuélvela a borrador primero.");

  const edit = parseUnitForm(form);
  const wanted = pagesToLoad({ ...unit, source_page: edit.source_page }, edit.skills.map((s) => s.page));
  const { data: pageRows } = await supabase
    .from("curriculum_pages")
    .select("page, text")
    .eq("source_id", unit.source_id)
    .in("page", wanted);
  const pages = new Map((pageRows ?? []).map((r: { page: number; text: string }) => [r.page, r.text]));
  const issues = recheck(edit, pages).map(({ field, value, problem }) => ({ field, value, problem }));

  const before = {
    title: unit.title, area: unit.area, term: unit.term, contents: unit.contents,
    learning_outcomes: unit.learning_outcomes, source_page: unit.source_page, source_excerpt: unit.source_excerpt,
    skills: skills.map((s) => ({ code: s.code, text: s.name, page: s.source_page })),
  };
  const after = {
    title: edit.title, area: edit.area, term: edit.term, contents: edit.contents,
    learning_outcomes: edit.learning_outcomes, source_page: edit.source_page, source_excerpt: edit.source_excerpt,
    skills: edit.skills,
  };
  const changes = diff(before, after);

  const { error } = await supabase
    .from("curriculum_units")
    .update({
      title: edit.title,
      area: edit.area,
      term: edit.term,
      contents: edit.contents,
      learning_outcomes: edit.learning_outcomes,
      source_page: edit.source_page,
      source_excerpt: edit.source_excerpt,
      extraction_meta: { ...unit.extraction_meta, issues, edited_by_reviewer: true },
    })
    .eq("id", unitId);
  if (error) throw new Error(`No se pudo guardar: ${error.message}`);

  // Skills keep their ids where possible (later phases reference them).
  for (const [i, s] of edit.skills.entries()) {
    const existing = skills[i];
    const row = { code: s.code, name: s.text, source_page: s.page, sort_order: i };
    const { error: e } = existing
      ? await supabase.from("skills").update(row).eq("id", existing.id)
      : await supabase.from("skills").insert({ ...row, unit_id: unitId, subject_id: unit.subject_id, grade_id: unit.grade_id });
    if (e) throw new Error(`No se pudo guardar una habilidad: ${e.message}`);
  }
  const removed = skills.slice(edit.skills.length).map((s) => s.id);
  if (removed.length) await supabase.from("skills").delete().in("id", removed);

  await log(supabase, user.id, unitId, "edit", changes);
  revalidatePath(`/revisar/${unitId}`);
  redirect(`/revisar/${unitId}?guardado=1`);
}

const ACTION_FOR: Record<UnitStatus, string> = {
  draft: "back_to_draft",
  reviewed: "approve",
  published: "publish",
  rejected: "reject",
};

/** Moves a unit through draft → reviewed → published (or rejected), with publish guard rails. */
export async function setStatus(unitId: string, status: UnitStatus) {
  const { supabase, user } = await reviewerOrThrow(unitId);
  const { unit, skills } = await loadUnit(supabase, unitId);
  if (status === "published") {
    const blockers = publishBlockers(unit, skills.length);
    if (blockers.length) warn(unitId, `No se puede publicar: ${blockers.join("; ")}.`);
  }
  const reviewedFields =
    status === "reviewed" || status === "published"
      ? { reviewed_by: user.id, reviewed_at: new Date().toISOString() }
      : {};
  const { error } = await supabase.from("curriculum_units").update({ status, ...reviewedFields }).eq("id", unitId);
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
  await log(supabase, user.id, unitId, ACTION_FOR[status], { status: { from: unit.status, to: status } });
  revalidatePath("/revisar");
  revalidatePath(`/revisar/${unitId}`);
}
