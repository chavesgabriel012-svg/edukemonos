import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const inviteUserByEmail = vi.fn();
const signInWithOtp = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({ auth: { admin: { inviteUserByEmail } } }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithOtp } }) }));

import { sendInvites } from "@/lib/invites";

const ORIGIN = "https://eduka.example";
const people = [{ email: "ana@colegio.cr", name: "Ana" }];

beforeEach(() => {
  inviteUserByEmail.mockReset();
  signInWithOtp.mockReset();
});

describe("sendInvites", () => {
  it("invites by e-mail with a redirect to /auth/confirm?next=/docente", async () => {
    inviteUserByEmail.mockResolvedValue({ error: null });
    const result = await sendInvites(people, ORIGIN);
    expect(result).toEqual([{ email: "ana@colegio.cr", sent: true }]);
    const [email, options] = inviteUserByEmail.mock.calls[0];
    expect(email).toBe("ana@colegio.cr");
    expect(options.redirectTo).toBe(`${ORIGIN}/auth/confirm?next=/docente`);
    expect(options.data).toEqual({ display_name: "Ana" });
  });

  it("falls back to a sign-in link without creating users when the user already exists", async () => {
    inviteUserByEmail.mockResolvedValue({ error: { message: "User already registered" } });
    signInWithOtp.mockResolvedValue({ error: null });
    const result = await sendInvites(people, ORIGIN);
    expect(result).toEqual([{ email: "ana@colegio.cr", sent: true }]);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "ana@colegio.cr",
      options: { shouldCreateUser: false, emailRedirectTo: `${ORIGIN}/auth/confirm?next=/docente` },
    });
  });

  it("reports other errors with their message", async () => {
    inviteUserByEmail.mockResolvedValue({ error: { message: "rate limit exceeded" } });
    const result = await sendInvites(people, ORIGIN);
    expect(result).toEqual([{ email: "ana@colegio.cr", sent: false, error: "rate limit exceeded" }]);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});
