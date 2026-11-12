"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { type CreateCodeState, createRecoveryCode, type RedeemState, redeemRecoveryCode } from "./actions";

const button = "inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50";

export function CreateCodeForm({ hasCode }: { hasCode: boolean }) {
  const [state, action, pending] = useActionState<CreateCodeState, FormData>(createRecoveryCode, {});
  const [copied, setCopied] = useState(false);
  if (state.code) {
    return (
      <div role="status" className="space-y-3 rounded-xl border-2 border-violeta p-4">
        <p className="font-medium">Este es tu código. Cópialo o anótalo en tu cuaderno: no podremos mostrártelo otra vez.</p>
        <p className="font-mono text-2xl font-bold tracking-widest break-all sm:text-3xl">{state.code}</p>
        <button
          type="button"
          className={button}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(state.code!);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "¡Copiado!" : "Copiar código"}
        </button>
        <p className="text-sm text-muted-foreground">No lo compartas: con este código cualquier persona podría ver tu progreso.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      {hasCode && (
        <p className="text-sm text-muted-foreground">
          Ya tienes un código. Si lo perdiste, crea uno nuevo: el anterior dejará de funcionar.
        </p>
      )}
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <button disabled={pending} className={button}>
        {pending ? "Creando…" : hasCode ? "Crear un código nuevo" : "Crear mi código"}
      </button>
    </form>
  );
}

export function RedeemCodeForm() {
  const [state, action, pending] = useActionState<RedeemState, FormData>(redeemRecoveryCode, {});
  if (state.done) {
    return (
      <div role="status" className="space-y-3 rounded-xl border p-4">
        <p className="font-medium">
          {state.done.alreadyHere
            ? "Ese código ya es de este dispositivo: tu progreso está aquí."
            : "¡Listo! Recuperamos tu progreso en este dispositivo."}
        </p>
        <Link href="/" className={button}>Seguir estudiando</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1">
        <span className="font-medium">Tu código de recuperación</span>
        <input
          key={state.value ?? ""}
          defaultValue={state.value}
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Ej.: K7QM-4RTX-9PZC"
          className="w-full rounded-md border bg-background px-3 py-2 font-mono text-base tracking-widest uppercase placeholder:normal-case"
        />
      </label>
      <p className="text-xs text-muted-foreground">Si en este dispositivo ya practicaste algo, se junta con tu progreso.</p>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <button disabled={pending} className={button}>{pending ? "Recuperando…" : "Recuperar mi progreso"}</button>
    </form>
  );
}
