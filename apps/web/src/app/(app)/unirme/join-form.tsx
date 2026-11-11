"use client";

import Link from "next/link";
import { useActionState } from "react";
import { joinSection, type JoinState } from "@/app/(app)/estudiar/actions";
import { action as actionClass } from "@/components/ui/action";
import { field } from "@/components/ui/styles";

export function JoinForm() {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinSection, {});
  if (state.joined) {
    return (
      <div role="status" className="space-y-4">
        <p className="font-heading text-2xl font-bold">¡Ya estás en la sección {state.joined.section_name}!</p>
        <Link href={`/estudiar/${state.joined.grade_id}`} className={actionClass()}>
          Empezar a estudiar
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5">
      <label className="block space-y-1.5">
        <span className="font-semibold">Código de la sección</span>
        <input name="code" required autoComplete="off" autoCapitalize="characters" placeholder="ABC-123" className={`${field} font-mono tracking-[0.2em] uppercase`} />
      </label>
      <label className="block space-y-1.5">
        <span className="font-semibold">Tu nombre</span>
        <input name="name" required maxLength={60} autoComplete="name" className={field} />
        <span className="block text-xs text-muted-foreground">Solo lo ve tu docente y nunca se envía a la inteligencia artificial.</span>
      </label>
      <label className="flex items-start gap-3 rounded-[14px] bg-background p-3.5 text-sm">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-violeta" />
        <span>
          Acepto que mi docente vea mi avance en Eduka (ejercicios, diagnóstico y temas consultados). Leí el{" "}
          <Link href="/privacidad" className="font-medium underline underline-offset-2">aviso de privacidad</Link>.
        </span>
      </label>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <button disabled={pending} className={`${actionClass()} w-full`}>
        {pending ? "Uniéndote…" : "Unirme"}
      </button>
    </form>
  );
}
