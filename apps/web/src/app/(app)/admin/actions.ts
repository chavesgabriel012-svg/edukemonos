"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/staff";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBJECT = /^[a-z_]{2,40}$/;
const STATUSES = ["preparando", "activo", "pausado"];

export interface InstitutionState {
  error?: string;
}

/** Creates or updates a school (team only) and goes to its page. */
export async function saveInstitution(_prev: InstitutionState | null, form: FormData): Promise<InstitutionState> {
  const { supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  const status = String(form.get("status") ?? "preparando");
  const budgetText = String(form.get("budget") ?? "").trim().replace(",", ".");
  const budget = budgetText === "" ? null : Number(budgetText);
  if (id && !UUID.test(id)) return { error: "Algo no es válido. Recargue la página e intente de nuevo." };
  if (name.length < 2 || name.length > 160) return { error: "Escriba el nombre del colegio (entre 2 y 160 letras)." };
  if (slug && !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug)) return { error: "El nombre corto solo lleva minúsculas, números y guiones (3 a 40 caracteres)." };
  if (!STATUSES.includes(status)) return { error: "Elija un estado válido." };
  if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return { error: "El presupuesto debe ser un número de dólares, o quedar vacío." };

  const { data, error } = await supabase.rpc("admin_upsert_institution", { p_id: id || null, p_name: name, p_slug: slug, p_status: status, p_budget: budget });
  if (error) {
    if (error.code === "23505") return { error: "Ya hay un colegio con ese nombre corto." };
    if (error.code === "42501") return { error: "Solo el equipo Eduka puede hacer esto." };
    console.error("saveInstitution failed:", error.code, error.message);
    return { error: "No se pudo guardar el colegio. Intente de nuevo." };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/colegios/[id]", "page");
  redirect(`/admin/colegios/${data as string}`);
}

/** Offers (or stops offering) a subject of one grade; the school approves or withdraws it. */
export async function setOffering(institutionId: string, grade: number, subject: string, offered: boolean): Promise<{ error?: string }> {
  const { supabase } = await requireAdmin();
  if (!UUID.test(institutionId) || ![7, 8, 9].includes(grade) || !SUBJECT.test(subject)) return { error: "Algo no es válido. Recargue la página e intente de nuevo." };
  const { error } = await supabase.rpc("admin_set_offering", { p_institution: institutionId, p_grade: grade, p_subject: subject, p_offered: offered });
  if (error) {
    const m = error.message;
    if (m.includes("no published content")) return { error: "Esa materia todavía no tiene contenido publicado." };
    if (m.includes("approved offerings")) return { error: "El colegio ya la aprobó: solo la coordinación del colegio puede retirarla." };
    if (m.includes("withdrawn offerings")) return { error: "El colegio la retiró: queda en el registro." };
    console.error("setOffering failed:", error.code, m);
    return { error: "No se pudo cambiar la oferta. Intente de nuevo." };
  }
  revalidatePath(`/admin/colegios/${institutionId}`);
  return {};
}
