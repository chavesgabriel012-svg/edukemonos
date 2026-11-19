import "server-only";
import { adminClient } from "@/lib/supabase/admin";

export type InviteResult = { email: string; sent: boolean; existing?: true; error?: string };

const ALREADY_EXISTS_MESSAGE = /already (been )?(registered|exists)/i;

/**
 * Sends each new person a Supabase invite e-mail that lands on /auth/confirm (token_hash flow),
 * where the pending invitation is claimed. People who already have an account get no e-mail:
 * they are reported as `existing` and join the school the next time they sign in, because
 * /auth/confirm runs claim_my_invites. Only the e-mail and the name go to Supabase Auth, never
 * to the AI. The caller must have checked that the user is an admin.
 */
export async function sendInvites(people: { email: string; name: string }[], origin: string): Promise<InviteResult[]> {
  const redirectTo = `${origin}/auth/confirm?next=/docente`;
  const admin = adminClient();
  const results: InviteResult[] = [];
  for (const { email, name } of people) {
    const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: name } });
    if (!error) {
      results.push({ email, sent: true });
    } else if ((error as { code?: string }).code === "email_exists" || ALREADY_EXISTS_MESSAGE.test(error.message)) {
      results.push({ email, sent: false, existing: true });
    } else {
      results.push({ email, sent: false, error: error.message });
    }
  }
  return results;
}
