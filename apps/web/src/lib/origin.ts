/**
 * The origin the visitor actually used. `request.nextUrl.origin` can differ in development
 * (127.0.0.1 vs localhost), and redirecting to another host drops the session cookie.
 */
export function requestOrigin(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
