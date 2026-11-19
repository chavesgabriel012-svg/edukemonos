"use client";

import { useActionState, useState } from "react";
import { invitePeople, removeMember, resendInvite, revokeInvite, setMemberRole, type InviteState } from "@/app/(app)/docente/institucion/actions";
import { action } from "@/components/ui/action";
import { field, textarea } from "@/components/ui/styles";
import { useRun } from "./run";

export interface Person {
  kind: "member" | "invite";
  profile_id: string | null;
  invite_id: string | null;
  name: string;
  email: string;
  role: "teacher" | "admin";
  status: "activo" | "invitado" | "revocado";
  since: string;
}
export interface Member {
  profile_id: string;
  name: string;
  role: "teacher" | "admin";
}

const ROLE = { teacher: "Docente", admin: "Coordinación" } as const;
const STATUS = { activo: "Activo", invitado: "Invitado", revocado: "Revocado" } as const;
const REASON = { email: "correo no válido", name: "falta el nombre (máximo 80 letras)", role: "rol no reconocido (use Docente o Coordinación)" } as const;
const SKIPPED = { already_member: "ya es parte del colegio", already_invited: "ya tenía una invitación" } as const;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica" });

export function PeoplePanel({ institutionId, people, members, initialState }: { institutionId: string; people: Person[]; members: Member[]; initialState?: InviteState }) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(invitePeople.bind(null, institutionId), initialState ?? {});
  const [text, setText] = useState(initialState?.list ?? "");
  const preview = state.preview;
  // What gets sent is the text in the box, so the preview must be of that same text.
  // A textarea's value comes back from FormData with CRLF line breaks, so compare without them.
  const lines = (v: string | undefined) => v?.replace(/\r\n?/g, "\n");
  const previewed = preview !== undefined && lines(state.list) === lines(text);
  const sent = state.sent !== undefined;
  // Marks, from the list already loaded, who is in the school or already invited (the server still decides).
  const known = new Map<string, string>();
  for (const p of people) {
    if (p.status === "activo") known.set(p.email.toLowerCase(), "ya es parte del colegio");
    else if (p.status === "invitado") known.set(p.email.toLowerCase(), "ya tenía una invitación");
  }

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Personas que va a invitar</span>
          <textarea name="list" rows={5} value={text} onChange={(e) => setText(e.target.value)} className={textarea} placeholder={"ana@colegio.cr, Ana Mora\nluis@colegio.cr, Luis Rojas, Coordinación"} />
        </label>
        <p className="text-xs text-muted-foreground">Una persona por línea: correo, nombre y, si quiere, el rol (Docente o Coordinación). También puede pegar columnas desde Excel.</p>

        {preview && (
          <div className="space-y-2 rounded-[16px] border p-4 text-sm">
            <p className="font-medium">{count(preview.people.length, "persona lista", "personas listas")}</p>
            {preview.people.length > 0 && (
              <ul className="space-y-0.5 text-muted-foreground">
                {preview.people.map((p) => (
                  <li key={p.email}>
                    {p.name} · {p.email} · {ROLE[p.role]}
                    {known.get(p.email.toLowerCase()) && <span className="text-foreground"> · {known.get(p.email.toLowerCase())}</span>}
                  </li>
                ))}
              </ul>
            )}
            {preview.errors.length > 0 && (
              <ul role="alert" className="space-y-0.5 text-destructive">
                {preview.errors.map((e) => (
                  <li key={e.line}>Línea {e.line}: {REASON[e.reason]}</li>
                ))}
              </ul>
            )}
            {preview.duplicates.length > 0 && (
              <ul className="space-y-0.5 text-muted-foreground">
                {preview.duplicates.map((d) => (
                  <li key={d}>Repetido: {d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending} className={action({ variant: "soft", size: "md" })}>Revisar lista</button>
          {preview && (
            <button name="confirm" value="1" disabled={pending || !previewed || preview.people.length === 0} className={action({ size: "md" })}>Enviar invitaciones</button>
          )}
        </div>
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        {sent && (
          <div role="status" className="space-y-1 text-sm">
            <p>{count(state.sent ?? 0, "invitación enviada", "invitaciones enviadas")}.</p>
            {state.existing?.map((e) => <p key={e}>{e}: Ya tiene cuenta en Eduka: verá su colegio la próxima vez que entre.</p>)}
            {state.skipped?.map((s) => <p key={s.email}>{s.email}: {SKIPPED[s.reason]}.</p>)}
            {state.failed?.map((f) => <p key={f.email} className="text-destructive">{f.email}: {f.error}</p>)}
          </div>
        )}
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Nombre</th>
              <th className="py-2 pr-3 font-medium">Correo</th>
              <th className="py-2 pr-3 font-medium">Rol</th>
              <th className="py-2 pr-3 font-medium">Estado</th>
              <th className="py-2 pr-3 font-medium">Desde</th>
              <th className="py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {people.map((p) => (
              <tr key={p.profile_id ?? p.invite_id} className="align-top">
                <td className="py-3 pr-3">{p.name}</td>
                <td className="py-3 pr-3 break-all">{p.email}</td>
                <td className="py-3 pr-3">{ROLE[p.role]}</td>
                <td className="py-3 pr-3">{STATUS[p.status]}</td>
                <td className="tabular-nums py-3 pr-3">{day(p.since)}</td>
                <td className="py-3">
                  {p.kind === "member" && p.profile_id ? (
                    <MemberActions institutionId={institutionId} person={p} profileId={p.profile_id} members={members} />
                  ) : p.status === "invitado" && p.invite_id ? (
                    <InviteActions institutionId={institutionId} inviteId={p.invite_id} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {people.length === 0 && <p className="py-3 text-sm text-muted-foreground">Todavía no hay personas en el colegio.</p>}
      </div>
    </div>
  );
}

function InviteActions({ institutionId, inviteId }: { institutionId: string; inviteId: string }) {
  const { pending, error, notice, run } = useRun();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => run(() => resendInvite(institutionId, inviteId))} className={action({ variant: "soft", size: "sm" })}>Reenviar</button>
        <button type="button" disabled={pending} onClick={() => run(() => revokeInvite(institutionId, inviteId))} className={action({ variant: "outline", size: "sm" })}>Revocar</button>
      </div>
      {notice && <p role="status" className="text-xs">{notice}</p>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function MemberActions({ institutionId, person, profileId, members }: { institutionId: string; person: Person; profileId: string; members: Member[] }) {
  const { pending, error, run } = useRun();
  const [replacement, setReplacement] = useState("");
  const other = person.role === "admin" ? "teacher" : "admin";
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} onClick={() => run(() => setMemberRole(institutionId, profileId, other))} className={action({ variant: "soft", size: "sm" })}>
        {other === "admin" ? "Hacer coordinación" : "Hacer docente"}
      </button>
      <details className="rounded-[12px] border p-2">
        <summary className="cursor-pointer text-sm">Quitar del colegio</summary>
        <div className="mt-2 space-y-2">
          <label className="block space-y-1">
            <span className="text-xs">Sus secciones pasan a</span>
            <select name="replacement" value={replacement} onChange={(e) => setReplacement(e.target.value)} className={field}>
              <option value="">Coordinación con más tiempo en el colegio</option>
              {members.filter((m) => m.profile_id !== profileId).map((m) => (
                <option key={m.profile_id} value={m.profile_id}>{m.name}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={pending} onClick={() => run(() => removeMember(institutionId, profileId, replacement || null))} className={action({ variant: "outline", size: "sm" })}>Quitar</button>
        </div>
      </details>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

