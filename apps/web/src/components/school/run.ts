"use client";

import { useState, useTransition } from "react";

/** Runs a server action from a button and keeps its Spanish error or notice. */
export function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  function run(fn: () => Promise<{ error?: string; notice?: string }>) {
    start(async () => {
      const r = await fn();
      setError(r.error);
      setNotice(r.notice);
    });
  }
  return { pending, error, notice, run };
}
