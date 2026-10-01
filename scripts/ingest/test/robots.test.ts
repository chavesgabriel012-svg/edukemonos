import { describe, expect, it } from "vitest";
import { isAllowed, parseRobots } from "../src/polite-fetch";

// Excerpt of https://www.mep.go.cr/robots.txt as fetched on 2026-10-01.
const mep = `
User-agent: *
Allow: /core/*.css$
Disallow: /core/
Disallow: /admin/
Disallow: /search/
Disallow: /index.php/*/media/oembed
`;

const other = `
User-agent: BadBot
Disallow: /

User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
`;

describe("robots.txt handling", () => {
  it("allows the program PDFs and blocks disallowed paths", () => {
    const rules = parseRobots(mep);
    expect(isAllowed(rules, "/sites/default/files/media/matematica.pdf")).toBe(true);
    expect(isAllowed(rules, "/admin/config")).toBe(false);
    expect(isAllowed(rules, "/core/misc/x.js")).toBe(false);
    expect(isAllowed(rules, "/core/theme/style.css")).toBe(true);
    expect(isAllowed(rules, "/index.php/foo/media/oembed")).toBe(false);
  });

  it("only applies the * group and lets the longest match win", () => {
    const rules = parseRobots(other);
    expect(isAllowed(rules, "/wp-content/uploads/2026/07/Practica.pdf")).toBe(true);
    expect(isAllowed(rules, "/wp-admin/options.php")).toBe(false);
    expect(isAllowed(rules, "/wp-admin/admin-ajax.php")).toBe(true);
  });
});
