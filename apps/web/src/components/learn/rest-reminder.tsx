"use client";

import { useEffect, useState } from "react";
import { logRestReminder } from "@/app/(app)/estudiar/actions";
import { Kemo } from "@/components/brand/logo";
import { action } from "@/components/ui/action";
import { brand } from "@/lib/brand";
import { ACTIVITY_EVENT, type ActivitySession, markReminded, shouldRemind } from "@/lib/activity";

/** One friendly card after an hour of continuous activity. Never blocks; the progress is saved. */
export function RestReminder() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onActivity = (e: Event) => {
      const s = (e as CustomEvent<ActivitySession>).detail;
      if (!shouldRemind(s)) return;
      markReminded(s);
      setOpen(true);
      void logRestReminder(Math.round((s.last - s.start) / 60_000));
    };
    window.addEventListener(ACTIVITY_EVENT, onActivity);
    return () => window.removeEventListener(ACTIVITY_EVENT, onActivity);
  }, []);
  if (!open) return null;
  return (
    <div role="status" className="fixed inset-x-4 print:hidden bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-[22px] border bg-card p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <Kemo size={44} mood="happy" background={brand.lima} />
        <div>
          <p className="font-heading text-lg font-bold">Llevas un buen rato estudiando</p>
          <p className="mt-1 text-sm">Un descanso corto ayuda a recordar mejor. Tu progreso queda guardado.</p>
        </div>
      </div>
      <button type="button" onClick={() => setOpen(false)} className={`${action({ size: "md" })} mt-3`}>
        Entendido
      </button>
    </div>
  );
}
