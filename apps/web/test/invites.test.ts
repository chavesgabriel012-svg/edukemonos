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

  it("reports existing users without sending any e-mail (by error code)", async () => {
    inviteUserByEmail.mockResolvedValue({ error: { code: "email_exists", message: "A user with this email address has already been registered" } });
    const result = await sendInvites(people, ORIGIN);
    expect(result).toEqual([{ email: "ana@colegio.cr", sent: false, existing: true }]);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("reports existing users by message when there is no code", async () => {
    inviteUserByEmail.mockResolvedValue({ error: { message: "User already registered" } });
    const result = await sendInvites(people, ORIGIN);
    expect(result).toEqual([{ email: "ana@colegio.cr", sent: false, existing: true }]);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("reports other errors with their message", async () => {
    inviteUserByEmail.mockResolvedValue({ error: { message: "rate limit exceeded" } });
    const result = await sendInvites(people, ORIGIN);
    expect(result).toEqual([{ email: "ana@colegio.cr", sent: false, error: "rate limit exceeded" }]);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });
});
