import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/origin";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing URL of the e-mail magic link. Supports both Supabase flows: PKCE (`?code=`) and the
 * token-hash template (`?token_hash=&type=`).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  if (!error) {
    // The only path that accepts an invitation: links the confirmed e-mail to pending invites.
    const { error: claimError } = await supabase.rpc("claim_my_invites");
    if (claimError) console.error("claim_my_invites failed", claimError.message);
  }

  const target = error ? `/entrar?error=enlace&next=${encodeURIComponent(next)}` : next;
  return NextResponse.redirect(new URL(target, requestOrigin(request.headers)));
}
