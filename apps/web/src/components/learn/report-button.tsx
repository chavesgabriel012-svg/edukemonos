"use client";

import { useActionState } from "react";
import { reportError, type ReportState } from "@/app/estudiar/actions";

/** "Reportar un error" on every material, exercise and (later) tutor answer. */
export function ReportButton({ targetType, targetId }: { targetType: "unit" | "material" | "item" | "tutor_message"; targetId: string }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(reportError, {});
  if (state.sent) return <p role="status" className="text-xs text-muted-foreground">Gracias, recibimos tu reporte.</p>;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground underline underline-offset-2">Reportar un error</summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="target_type" value={targetType} />
        <input type="hidden" name="target_id" value={targetId} />
        <label className="block space-y-1">
          <span>¿Qué está mal? (no escribas datos personales)</span>
          <textarea name="comment" rows={3} maxLength={2000} required className="w-full rounded-md border bg-background px-2 py-1 text-sm" />
        </label>
        {state.error && <p role="alert" className="text-destructive">{state.error}</p>}
        <button disabled={pending} className="rounded-md border px-3 py-1.5 disabled:opacity-50">
          {pending ? "Enviando…" : "Enviar reporte"}
        </button>
      </form>
    </details>
  );
}
