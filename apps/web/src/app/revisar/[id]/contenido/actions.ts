"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/staff";

type Supabase = Awaited<ReturnType<typeof requireReviewer>>["supabase"];
type Table = "materials" | "items";
export type ContentAction = "approve" | "reject" | "draft";

const ENTITY: Record<Table, string> = { materials: "material", items: "item" };

async function reviewerOrThrow(unitId: string) {
  const r = await requireReviewer(`/revisar/${unitId}/contenido`);
  if (!r.allowed) throw new Error("Solo revisores o administradores pueden cambiar contenido.");
  return r;
}

async function log(supabase: Supabase, actorId: string, table: Table, id: string, action: string, diff: unknown) {
  const { error } = await supabase
    .from("review_log")
    .insert({ entity_type: ENTITY[table], entity_id: id, action, actor_id: actorId, diff });
  if (error) throw new Error(`No se pudo registrar la revisión: ${error.message}`);
}

/** What each reviewer action writes. Approving publishes and records who reviewed it. */
function patchFor(action: ContentAction, userId: string) {
  const now = new Date().toISOString();
  if (action === "approve") return { status: "published", reviewer_id: userId, reviewed_at: now };
  if (action === "reject") return { status: "rejected", reviewer_id: userId, reviewed_at: now };
  return { status: "draft", reviewer_id: null, reviewed_at: null };
}

function done(unitId: string, anchor: string) {
  revalidatePath(`/revisar/${unitId}/contenido`);
  redirect(`/revisar/${unitId}/contenido#${anchor}`);
}

export async function setContentStatus(unitId: string, table: Table, id: string, action: ContentAction) {
  const { supabase, user } = await reviewerOrThrow(unitId);
  const patch = patchFor(action, user.id);
  const { error } = await supabase.from(table).update(patch).eq("id", id).eq("unit_id", unitId);
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
  await log(supabase, user.id, table, id, action, { status: patch.status });
  done(unitId, id);
}

/** A reviewer's edit of a material. Editing is reviewing: it records the reviewer. */
export async function saveMaterial(unitId: string, id: string, form: FormData) {
  const { supabase, user } = await reviewerOrThrow(unitId);
  const content = String(form.get("content") ?? "").trim();
  if (content.length < 20) throw new Error("El material quedó vacío.");
  const { data: before } = await supabase.from("materials").select("content, verification").eq("id", id).single();
  const { error } = await supabase
    .from("materials")
    .update({
      content,
      reviewer_id: user.id,
      reviewed_at: new Date().toISOString(),
      verification: { ...(before?.verification ?? {}), edited_by_reviewer: true },
    })
    .eq("id", id)
    .eq("unit_id", unitId);
  if (error) throw new Error(`No se pudo guardar: ${error.message}`);
  await log(supabase, user.id, "materials", id, "edit", { content: { from: before?.content ?? null, to: content } });
  done(unitId, id);
}

/**
 * Approves, in one step, everything in the unit that passed the automatic checks: material the
 * independent review found no error in, and verified single-choice items.
 */
export async function approveAllChecked(unitId: string) {
  const { supabase, user } = await reviewerOrThrow(unitId);
  const patch = patchFor("approve", user.id);
  const { data: mats, error: e1 } = await supabase
    .from("materials")
    .update(patch)
    .eq("unit_id", unitId)
    .neq("status", "rejected")
    .is("reviewer_id", null)
    .eq("verification->>ok", "true")
    .select("id");
  if (e1) throw new Error(`No se pudo aprobar el material: ${e1.message}`);
  // No .select() here: the API cannot read item rows back (answer keys are hidden), so count first.
  const { data: items } = await supabase.rpc("review_items", { p_unit_id: unitId });
  const ids = ((items ?? []) as { id: string; verified: boolean; status: string; reviewer_id: string | null; kind: string }[])
    .filter((i) => i.kind === "single_choice" && i.verified && i.status !== "rejected" && !i.reviewer_id)
    .map((i) => i.id);
  if (ids.length) {
    const { error: e2 } = await supabase.from("items").update(patch).in("id", ids);
    if (e2) throw new Error(`No se pudieron aprobar los ítems: ${e2.message}`);
  }
  for (const m of mats ?? []) await log(supabase, user.id, "materials", m.id, "approve", { bulk: true });
  for (const id of ids) await log(supabase, user.id, "items", id, "approve", { bulk: true });
  done(unitId, "top");
}
