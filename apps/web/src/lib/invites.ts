import "server-only";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type InviteResult = { email: string; sent: boolean; error?: string };

const ALREADY_EXISTS = /already (been )?(registered|exists)|email_exists/i;

/**
 * Sends each person an e-mail that lands on /auth/confirm, where the pending invitation is claimed.
 * New users get a Supabase invite; people who already have an account get a sign-in link instead
 * (never creating a user). Only the e-mail and the name go to Supabase Auth, never to the AI.
 * The caller must have checked that the user is an admin.
 */
export async function sendInvites(people: { email: string; name: string }[], origin: string): Promise<InviteResult[]> {
  const redirectTo = `${origin}/auth/confirm?next=/docente`;
  const admin = adminClient();
  const results: InviteResult[] = [];
  for (const { email, name } of people) {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: name } });
    if (!error) {
      results.push({ email, sent: true });
      continue;
    }
    if (!ALREADY_EXISTS.test(`${error.message} ${(error as { code?: string }).code ?? ""}`)) {
      results.push({ email, sent: false, error: error.message });
      continue;
    }
    const supabase = await createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    });
    results.push(otpError ? { email, sent: false, error: otpError.message } : { email, sent: true });
  }
  return results;
}
