/** Only same-site relative paths, to avoid open redirects after sign-in. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/revisar";
}
