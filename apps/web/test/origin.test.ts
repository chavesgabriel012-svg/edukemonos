import { describe, expect, it } from "vitest";
import { clientIp, requestOrigin } from "../src/lib/origin";

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("requestOrigin", () => {
  it("uses http for localhost and https elsewhere", () => {
    expect(requestOrigin(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(requestOrigin(new Headers({ host: "eduka.example" }))).toBe("https://eduka.example");
  });
});
