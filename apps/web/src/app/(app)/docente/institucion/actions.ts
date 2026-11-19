"use server";

import { parseInviteList } from "@edukemonos/curriculum";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { sendInvites } from "@/lib/invites";
import { requestOrigin } from "@/lib/origin";
import { requireStaff } from "@/lib/staff";

/**
 * Actions of the school's coordination (also used by the Eduka console). Each one calls its RPC,
 * which decides who may act, revalidates the page and answers `{ error?: string }` in Spanish.
 * Nothing here sends names or e-mails to the AI.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBJECT = /^[a-z_]{2,40}$/;
const GRADES = [7, 8, 9];

export type ActionResult = { error?: string };
export type ParsedList = ReturnType<typeof parseInviteList>;
export interface InviteState {
  error?: string;
  /** The text that was previewed or sent, to keep it in the box. */
  list?: string;
  preview?: ParsedList;
  sent?: number;
  failed?: { email: string; error: string }[];
  /** People who already had an account: no e-mail was sent, they join on their next sign-in. */
  existing?: string[];
  skipped?: { email: string; reason: "already_member" | "already_invited" }[];
}

/** The coordination page and the Eduka console show the same data, so both are refreshed. */
function refresh(institutionId: string) {
  revalidatePath(`/docente/institucion/${institutionId}`);
  revalidatePath(`/admin/colegios/${institutionId}`);
}
function refreshAll() {
  revalidatePath("/docente/institucion/[id]", "page");
  revalidatePath("/admin/colegios/[id]", "page");
}

const INVALID = { error: "Algo no es válido. Recargue la página e intente de nuevo." };

/** Turns a database error into a Spanish message, without leaking SQL text. */
function explain(error: { code?: string; message: string }, fallback: string): ActionResult {
  const m = error.message;
  if (error.code === "42501") return { error: "Solo la coordinación del colegio puede hacer esto. El equipo Eduka no actúa en nombre del colegio." };
  if (m.includes("last coordinator")) return { error: "El colegio necesita al menos una persona en coordinación." };
  if (m.includes("replacement must be")) return { error: "El reemplazo debe ser otra persona activa del colegio." };
  if (m.includes("new teacher is not a member")) return { error: "Esa persona no es parte del colegio." };
  if (m.includes("invite already accepted")) return { error: "Esa invitación ya fue aceptada. Quite a la persona del colegio si es necesario." };
  if (error.code === "22023") return { error: "Revise los correos y el rol de cada persona." };
  if (error.code === "P0002") return { error: "No encontramos eso. Recargue la página e intente de nuevo." };
  console.error("school action failed:", error.code, m);
  return { error: fallback };
}

async function rpc(institutionId: string, name: string, args: Record<string, unknown>, fallback: string): Promise<ActionResult> {
  if (!UUID.test(institutionId)) return INVALID;
  const { supabase } = await requireStaff(`/docente/institucion/${institutionId}`);
  const { error } = await supabase.rpc(name, args);
  if (error) return explain(error, fallback);
  refresh(institutionId);
  return {};
}

// --- Program -----------------------------------------------------------------

function offering(institutionId: string, grade: number, subject: string) {
  return GRADES.includes(grade) && SUBJECT.test(subject) ? { p_institution: institutionId, p_grade: grade, p_subject: subject } : null;
}

export async function approveOffering(institutionId: string, grade: number, subject: string): Promise<ActionResult> {
  const args = offering(institutionId, grade, subject);
  return args ? rpc(institutionId, "approve_offering", args, "No se pudo aprobar la materia. Intente de nuevo.") : INVALID;
}

export async function withdrawOffering(institutionId: string, grade: number, subject: string): Promise<ActionResult> {
  const args = offering(institutionId, grade, subject);
  return args ? rpc(institutionId, "withdraw_offering", args, "No se pudo retirar la materia. Intente de nuevo.") : INVALID;
}

export async function markUnitsSeen(institutionId: string, grade: number, subject: string): Promise<ActionResult> {
  const args = offering(institutionId, grade, subject);
  return args ? rpc(institutionId, "mark_units_seen", args, "No se pudo guardar. Intente de nuevo.") : INVALID;
}

export async function setUnitHidden(institutionId: string, unitId: string, hidden: boolean): Promise<ActionResult> {
  if (!UUID.test(unitId)) return INVALID;
  return rpc(institutionId, "set_unit_hidden", { p_institution: institutionId, p_unit: unitId, p_hidden: hidden }, "No se pudo cambiar el tema. Intente de nuevo.");
}

// --- People ------------------------------------------------------------------

/** Without `confirm` previews the pasted list; with it creates the invitations and e-mails them. */
export async function invitePeople(institutionId: string, _prev: InviteState | null, form: FormData): Promise<InviteState> {
  if (!UUID.test(institutionId)) return INVALID;
  const { supabase } = await requireStaff(`/docente/institucion/${institutionId}`);
  const list = String(form.get("list") ?? "").slice(0, 20_000);
  const parsed = parseInviteList(list);
  if (!form.get("confirm")) {
    if (list.trim() === "") return { error: "Pegue la lista de personas: correo, nombre y, si quiere, el rol." };
    return { preview: parsed, list };
  }
  if (parsed.people.length === 0) return { error: "No hay personas válidas para invitar.", preview: parsed, list };

  const { data, error } = await supabase.rpc("create_invites", { p_institution: institutionId, p_people: parsed.people });
  if (error) return { ...explain(error, "No se pudieron crear las invitaciones. Intente de nuevo."), preview: parsed, list };
  const created = ((data as { created?: { id: string; email: string }[] } | null)?.created ?? []).map((c) => c.email.toLowerCase());
  const skipped = (data as { skipped?: InviteState["skipped"] } | null)?.skipped ?? [];

  const toSend = parsed.people.filter((p) => created.includes(p.email.toLowerCase())).map((p) => ({ email: p.email, name: p.name }));
  const results = toSend.length ? await sendInvites(toSend, requestOrigin(await headers())) : [];
  refresh(institutionId);
  return {
    sent: results.filter((r) => r.sent).length,
    existing: results.filter((r) => r.existing).map((r) => r.email),
    failed: results.filter((r) => !r.sent && !r.existing).map((r) => ({ email: r.email, error: "No se pudo enviar el correo." })),
    skipped,
  };
}

export interface ResendResult extends ActionResult {
  notice?: string;
}

export async function resendInvite(institutionId: string, inviteId: string): Promise<ResendResult> {
  if (!UUID.test(institutionId) || !UUID.test(inviteId)) return INVALID;
  const { supabase } = await requireStaff(`/docente/institucion/${institutionId}`);
  const { data, error } = await supabase.rpc("institution_people", { p_institution: institutionId });
  if (error) return explain(error, "No se pudo reenviar la invitación.");
  const invite = (data as { invite_id: string | null; email: string; name: string; status: string }[] | null)?.find((p) => p.invite_id === inviteId);
  if (!invite || invite.status !== "invitado") return { error: "Esa invitación ya no está pendiente." };
  const [result] = await sendInvites([{ email: invite.email, name: invite.name }], requestOrigin(await headers()));
  if (result?.existing) return { notice: "Ya tiene cuenta en Eduka: verá su colegio la próxima vez que entre." };
  if (!result?.sent) return { error: "No se pudo enviar el correo. Intente de nuevo." };
  return { notice: "Invitación reenviada." };
}

export async function revokeInvite(institutionId: string, inviteId: string): Promise<ActionResult> {
  if (!UUID.test(inviteId)) return INVALID;
  return rpc(institutionId, "revoke_invite", { p_invite: inviteId }, "No se pudo revocar la invitación.");
}

export async function setMemberRole(institutionId: string, profileId: string, role: "teacher" | "admin"): Promise<ActionResult> {
  if (!UUID.test(profileId) || (role !== "teacher" && role !== "admin")) return INVALID;
  return rpc(institutionId, "set_member_role", { p_institution: institutionId, p_profile: profileId, p_role: role }, "No se pudo cambiar el rol.");
}

export async function removeMember(institutionId: string, profileId: string, replacementId: string | null): Promise<ActionResult> {
  if (!UUID.test(profileId) || (replacementId !== null && !UUID.test(replacementId))) return INVALID;
  return rpc(institutionId, "remove_institution_member", { p_institution: institutionId, p_profile: profileId, p_replacement: replacementId }, "No se pudo quitar a la persona.");
}

// --- Sections and groups -----------------------------------------------------

export async function reassignSection(sectionId: string, teacherId: string): Promise<ActionResult> {
  if (!UUID.test(sectionId) || !UUID.test(teacherId)) return INVALID;
  const { supabase } = await requireStaff("/docente");
  const { error } = await supabase.rpc("reassign_section", { p_section: sectionId, p_teacher: teacherId });
  if (error) return explain(error, "No se pudo reasignar la sección.");
  refreshAll();
  return {};
}

export interface GroupsState extends ActionResult {
  created?: number;
}

/** «7-1, 7-2, 7-3» in one grade creates one group per name in the school. */
export async function createGroups(institutionId: string, _prev: GroupsState | null, form: FormData): Promise<GroupsState> {
  if (!UUID.test(institutionId)) return INVALID;
  const grade = Number(form.get("grade"));
  if (!GRADES.includes(grade)) return { error: "Elija el año de los grupos." };
  const names = [...new Set(String(form.get("names") ?? "").split(/[,\n;]/).map((n) => n.trim()).filter(Boolean))];
  if (names.length === 0) return { error: "Escriba al menos un nombre de grupo, separados por coma (7-1, 7-2)." };
  if (names.length > 30 || names.some((n) => n.length > 40)) return { error: "Use hasta 30 grupos, con nombres de máximo 40 letras." };
  const { supabase } = await requireStaff(`/docente/institucion/${institutionId}`);
  let created = 0;
  for (const name of names) {
    const { error } = await supabase.rpc("create_group", { p_name: name, p_grade: grade, p_institution: institutionId });
    if (error) {
      refresh(institutionId);
      const base = explain(error, `No se pudo crear el grupo ${name}.`).error;
      return { error: created ? `${base} Se crearon ${created} grupos antes del error.` : base, created };
    }
    created += 1;
  }
  refresh(institutionId);
  return { created };
}
