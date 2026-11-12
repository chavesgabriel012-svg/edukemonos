"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { repairStreak } from "@/app/(app)/estudiar/actions";

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
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Usando…" : "Usar mi comodín"}
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
