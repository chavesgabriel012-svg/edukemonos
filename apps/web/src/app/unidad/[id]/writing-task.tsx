"use client";

import { useActionState } from "react";
import { Markdown } from "@/components/learn/markdown";
import { writingFeedback, type WritingState } from "@/app/estudiar/actions";

/** Write an answer and get AI feedback. The text is not stored; only error counts are. */
export function WritingTask({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState<WritingState, FormData>(writingFeedback, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="item_id" value={itemId} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">Tu texto</span>
        <textarea name="text" rows={6} maxLength={4000} required className="w-full rounded-md border bg-background px-3 py-2" />
        <span className="text-xs text-muted-foreground">No escribas datos personales. Tu texto no se guarda: solo se cuentan los tipos de error para tu docente.</span>
      </label>
      <button disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {pending ? "Revisando…" : "Pedir retroalimentación"}
      </button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.feedback && (
        <div role="status" className="rounded-lg bg-muted/50 p-3">
          <p className="mb-1 text-xs text-muted-foreground">Retroalimentación generada con IA · puede equivocarse</p>
          <Markdown>{state.feedback}</Markdown>
        </div>
      )}
    </form>
  );
}
