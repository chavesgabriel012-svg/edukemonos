"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { repairStreak } from "@/app/(app)/estudiar/actions";
import { action } from "@/components/ui/action";

export function RepairButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await repairStreak();
            if (!r.ok) return setError(r.error);
            router.refresh();
          })
        }
        className={action({ size: "md" })}
      >
        {pending ? "Usando…" : "Usar mi comodín"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
