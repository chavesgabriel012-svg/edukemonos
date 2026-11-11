"use client";

import { useActionState } from "react";
import { Markdown } from "@/components/learn/markdown";
import { writingFeedback, type WritingState } from "@/app/(app)/estudiar/actions";
import { action as actionClass } from "@/components/ui/action";
import { textarea } from "@/components/ui/styles";

/** Write an answer and get AI feedback. The text is not stored; only error counts are. */
export function WritingTask({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState<WritingState, FormData>(writingFeedback, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="item_id" value={itemId} />
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Tu texto</span>
        <textarea name="text" rows={7} maxLength={4000} required className={textarea} />
        <span className="block text-xs text-muted-foreground">No escribas datos personales. Tu texto no se guarda: solo se cuentan los tipos de error para tu docente.</span>
      </label>
      <button disabled={pending} className={actionClass({ size: "md" })}>
        {pending ? "Revisando…" : "Pedir retroalimentación"}
      </button>
      {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state.feedback && (
        <div role="status" className="rounded-[16px] bg-background p-4">
          <p className="mb-1 font-mono text-xs text-muted-foreground uppercase">Retroalimentación generada con IA · puede equivocarse</p>
          <Markdown>{state.feedback}</Markdown>
        </div>
      )}
    </form>
  );
}
