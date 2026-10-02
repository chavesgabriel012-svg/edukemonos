"use client";

import Link from "next/link";
import { useActionState } from "react";
import { joinSection, type JoinState } from "@/app/estudiar/actions";

const field = "w-full rounded-md border bg-background px-3 py-2";

export function JoinForm() {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinSection, {});
  if (state.joined) {
    return (
      <div role="status" className="space-y-3 rounded-xl border p-5">
        <p className="text-lg font-semibold">¡Listo! Ya estás en la sección {state.joined.section_name}.</p>
        <Link href={`/estudiar/${state.joined.grade_id}`} className="inline-block rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
          Empezar a estudiar
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1">
        <span className="font-medium">Código de la sección</span>
        <input name="code" required autoComplete="off" autoCapitalize="characters" placeholder="Ej.: ABC-123" className={`${field} uppercase tracking-widest`} />
      </label>
      <label className="block space-y-1">
        <span className="font-medium">Tu nombre</span>
        <input name="name" required maxLength={60} autoComplete="name" className={field} />
        <span className="text-xs text-muted-foreground">Solo lo ve tu docente. Nunca se envía a la inteligencia artificial.</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>
          Acepto que mi docente vea mi avance en Edukemonos (ejercicios, diagnóstico y temas consultados). Leí el{" "}
          <Link href="/privacidad" className="underline underline-offset-2">aviso de privacidad</Link>.
        </span>
      </label>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <button disabled={pending} className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "Uniéndote…" : "Unirme"}
      </button>
    </form>
  );
}
