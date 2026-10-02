import { adminClient } from "@/lib/supabase/admin";
import { RETENTION_DAYS_CHAT } from "@/lib/tutor-server";

/**
 * Daily retention job (Vercel Cron, see vercel.json): deletes tutor transcripts older than
 * RETENTION_DAYS_CHAT and stale quota counters. Vercel sends `Authorization: Bearer $CRON_SECRET`;
 * without that secret configured the job refuses to run.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { data, error } = await adminClient().rpc("purge_expired_tutor_messages", { p_days: RETENTION_DAYS_CHAT });
  if (error) {
    console.error("purge failed:", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true, deleted: data, retentionDays: RETENTION_DAYS_CHAT });
}
