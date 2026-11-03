/**
 * Gentle rest reminder (docs/producto/gamificacion.md §4): after one hour of continuous activity
 * (practice, diagnostic, tutor), one friendly card. A pause longer than 5 minutes starts a new
 * session. Nothing is blocked and nothing is lost. Runs in the browser; only the fact that the
 * card was shown goes to `events`.
 */

export const REST_AFTER_MS = 60 * 60 * 1000;
export const NEW_SESSION_GAP_MS = 5 * 60 * 1000;

export interface ActivitySession {
  /** When the current continuous session started (ms). */
  start: number;
  /** Last activity (ms). */
  last: number;
  /** The reminder was already shown in this session. */
  reminded: boolean;
}

/** The session after one more activity at `now`. */
export function recordActivity(prev: ActivitySession | null, now: number): ActivitySession {
  if (!prev || now - prev.last > NEW_SESSION_GAP_MS || now < prev.last) return { start: now, last: now, reminded: false };
  return { ...prev, last: now };
}

/** Whether to show the reminder now (once per session). */
export function shouldRemind(s: ActivitySession): boolean {
  return !s.reminded && s.last - s.start >= REST_AFTER_MS;
}

const KEY = "eduka.activity";
export const ACTIVITY_EVENT = "eduka:activity";

/** Call on every learning action (answer, message). Safe without storage (private mode). */
export function markActivity(): void {
  if (typeof window === "undefined") return;
  let prev: ActivitySession | null = null;
  try {
    prev = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null") as ActivitySession | null;
  } catch {
    prev = null;
  }
  const next = recordActivity(prev, Date.now());
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the reminder simply works within this page.
  }
  window.dispatchEvent(new CustomEvent<ActivitySession>(ACTIVITY_EVENT, { detail: next }));
}

/** Marks the reminder as shown for the current session. */
export function markReminded(s: ActivitySession): ActivitySession {
  const next = { ...s, reminded: true };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
