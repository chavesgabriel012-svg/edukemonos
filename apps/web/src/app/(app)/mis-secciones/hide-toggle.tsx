"use client";

import { useState, useTransition } from "react";
import { setLeaderboardHidden } from "@/app/(app)/estudiar/actions";
import { action } from "@/components/ui/action";

export function HideToggle({ hidden }: { hidden: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await setLeaderboardHidden(!hidden);
          if (!r.ok) setError(r.error);
        })}
        className={action({ variant: "soft", size: "md" })}
      >
        {pending ? "Guardando…" : hidden ? "Volver a aparecer en la tabla" : "No aparecer en la tabla"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
