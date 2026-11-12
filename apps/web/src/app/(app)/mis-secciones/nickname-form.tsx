"use client";

import { useActionState } from "react";
import { chooseNickname, type NicknameState } from "@/app/(app)/estudiar/actions";

export function NicknameForm({ options }: { options: string[] }) {
  const [state, action, pending] = useActionState<NicknameState, FormData>(chooseNickname, {});
  if (!options.length) return <p className="text-sm text-muted-foreground">No pudimos cargar los apodos. Recarga la página.</p>;
  return (
    <form action={action} className="space-y-3">
      <fieldset disabled={pending} className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Apodos disponibles</legend>
        {options.map((o) => (
          <label key={o} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] border p-3 has-[:checked]:border-violeta has-[:checked]:bg-secondary">
            <input type="radio" name="nickname" value={o} required className="size-4" />
            <span className="font-medium">{o}</span>
          </label>
        ))}
      </fieldset>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">
          {pending ? "Guardando…" : "Usar este apodo"}
        </button>
        <a href="/mis-secciones?otros=1" className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2">Ver otros apodos</a>
      </div>
    </form>
  );
}
