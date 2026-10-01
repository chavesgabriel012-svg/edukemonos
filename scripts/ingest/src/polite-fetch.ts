/**
 * Polite HTTP client for official sources (SPEC §4.7): identifies itself, waits between
 * requests to the same host, and refuses paths disallowed by robots.txt.
 */
export const USER_AGENT = "EdukemonosIngestBot/0.1 (educational, non-commercial; +https://github.com/chavesgabriel012-svg/edukemonos)";

export interface RobotsRules {
  disallow: string[];
  allow: string[];
}

/** Parses the `User-agent: *` group of a robots.txt (enough for the MEP files). */
export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { disallow: [], allow: [] };
  let inStarGroup = false;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      inStarGroup = lastWasAgent ? inStarGroup || value === "*" : value === "*";
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!inStarGroup || !value) continue;
    if (key === "disallow") rules.disallow.push(value);
    if (key === "allow") rules.allow.push(value);
  }
  return rules;
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Longest matching rule wins; Allow wins ties (Google's documented behaviour). */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  let best: { length: number; allow: boolean } | null = null;
  for (const [list, allow] of [[rules.disallow, false], [rules.allow, true]] as const) {
    for (const pattern of list) {
      if (patternToRegExp(pattern).test(path)) {
        if (!best || pattern.length > best.length || (pattern.length === best.length && allow)) {
          best = { length: pattern.length, allow };
        }
      }
    }
  }
  return best?.allow ?? true;
}

export class PoliteFetcher {
  private robots = new Map<string, RobotsRules>();
  private lastRequest = new Map<string, number>();

  constructor(private readonly delayMs = 2500) {}

  private async wait(host: string) {
    const last = this.lastRequest.get(host) ?? 0;
    const remaining = last + this.delayMs - Date.now();
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    this.lastRequest.set(host, Date.now());
  }

  private async rulesFor(url: URL): Promise<RobotsRules> {
    const cached = this.robots.get(url.host);
    if (cached) return cached;
    await this.wait(url.host);
    const res = await fetch(`${url.origin}/robots.txt`, { headers: { "user-agent": USER_AGENT } });
    const rules = res.ok ? parseRobots(await res.text()) : { disallow: [], allow: [] };
    this.robots.set(url.host, rules);
    return rules;
  }

  /** Throws `RobotsBlockedError` when robots.txt disallows the path. */
  async fetch(input: string, init: RequestInit = {}): Promise<Response> {
    const url = new URL(input);
    const rules = await this.rulesFor(url);
    if (!isAllowed(rules, url.pathname + url.search)) throw new RobotsBlockedError(input);
    await this.wait(url.host);
    return fetch(url, { ...init, headers: { ...init.headers, "user-agent": USER_AGENT } });
  }
}

export class RobotsBlockedError extends Error {
  override name = "RobotsBlockedError";
  constructor(readonly url: string) {
    super(`robots.txt disallows ${url}`);
  }
}
