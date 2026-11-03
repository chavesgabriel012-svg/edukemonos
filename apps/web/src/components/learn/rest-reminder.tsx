"use client";

import { useEffect, useState } from "react";
import { logRestReminder } from "@/app/estudiar/actions";
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
    <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-[22px] border bg-card p-4 shadow-xl">
      <p className="font-semibold">Llevas un buen rato estudiando</p>
      <p className="mt-1 text-sm">Un descanso corto ayuda a recordar mejor. Tu progreso queda guardado.</p>
      <button type="button" onClick={() => setOpen(false)} className="mt-3 inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground">
        Entendido
      </button>
    </div>
  );
}
