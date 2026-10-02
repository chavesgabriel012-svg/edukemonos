import { AIBudgetExceededError, AIRefusalError, AIUnavailableError, type ChatMessage } from "@edukemonos/ai";
import {
  allowedPhones,
  calculatorTool,
  masterySummary,
  screenStudentMessage,
  tutorMessages,
  tutorOutputStream,
  tutorSystemPrompt,
} from "@edukemonos/ai/tutor";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { consumeQuota, helpResources, serverAI, TUTOR_LIMITS, tutorUnit } from "@/lib/tutor-server";

/**
 * One tutor turn, streamed as NDJSON:
 *   {"type":"session","sessionId"} → {"type":"delta","text"}… → {"type":"done","messageId","flags"}
 *   or {"type":"error","message"}.
 * The student's name never reaches the model: only the unit, the screened message and mastery.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MATH_SUBJECTS = ["Matemáticas", "Ciencias"];

function line(obj: unknown) {
  return `${JSON.stringify(obj)}\n`;
}
function errorResponse(message: string, status = 400) {
  return new Response(line({ type: "error", message }), { status, headers: { "content-type": "application/x-ndjson" } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return errorResponse("Tu sesión expiró. Recarga la página.", 401);

  const body = (await request.json().catch(() => null)) as { unitId?: string; sessionId?: string | null; message?: string } | null;
  const unitId = body?.unitId ?? "";
  const sessionId = body?.sessionId ?? null;
  const message = (body?.message ?? "").trim();
  if (!UUID.test(unitId) || (sessionId !== null && !UUID.test(sessionId))) return errorResponse("Solicitud inválida.");
  if (!message) return errorResponse("Escribe tu pregunta.");
  if (message.length > 2_000) return errorResponse("Tu mensaje es muy largo. Intenta resumirlo.");

  const admin = adminClient();
  const found = await tutorUnit(unitId);
  if (!found) return errorResponse("Esta unidad no está disponible.", 404);

  // Session: reuse the student's own, or open one for this unit.
  let sid = sessionId;
  if (sid) {
    const { data: s } = await admin.from("tutor_sessions").select("id, student_id, unit_id, message_count").eq("id", sid).maybeSingle();
    if (!s || s.student_id !== user.id || s.unit_id !== unitId) return errorResponse("Solicitud inválida.");
    if (s.message_count >= TUTOR_LIMITS.perSession * 2) {
      return errorResponse("Llegaste al máximo de mensajes de esta conversación. Empieza una nueva para seguir.", 429);
    }
  }
  if (!(await consumeQuota(`tutor:day:${user.id}`, TUTOR_LIMITS.perDay, 86_400))) {
    return errorResponse("Por hoy ya usaste todos tus mensajes con el tutor. Mañana puedes seguir; mientras tanto, practica con los ejercicios.", 429);
  }
  if (!sid) {
    await admin.from("students").upsert({ id: user.id }, { onConflict: "id", ignoreDuplicates: true });
    const { data: created, error } = await admin
      .from("tutor_sessions")
      .insert({ student_id: user.id, unit_id: unitId, topic: found.unit.title })
      .select("id")
      .single();
    if (error || !created) return errorResponse("No se pudo abrir la conversación.", 500);
    sid = created.id as string;
  }

  const screened = screenStudentMessage(message);
  const [{ data: history }, { data: mastery }] = await Promise.all([
    admin.from("tutor_messages").select("role, content").eq("session_id", sid).in("role", ["user", "assistant"]).order("created_at").limit(40),
    admin.from("mastery").select("skill_id, score").eq("student_id", user.id).in("skill_id", found.skills.map((s) => s.id)),
  ]);
  const scores = new Map((mastery ?? []).map((m) => [m.skill_id as string, Number(m.score)]));
  const masteryText = masterySummary(found.skills.map((s) => ({ name: s.name, score: scores.get(s.id) ?? null })));
  const messages = tutorMessages((history ?? []) as ChatMessage[], screened.text, masteryText, screened.flags);

  await admin.from("tutor_messages").insert({ session_id: sid, role: "user", content: screened.text, safety_flags: screened.flags });

  const ai = serverAI();
  const tools = MATH_SUBJECTS.includes(found.unit.subject) ? [calculatorTool] : [];
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(line(obj)));
      send({ type: "session", sessionId: sid, flags: screened.flags });
      let answer = "";
      let afterTool = false;
      // Tuteo and verified phone numbers only, fixed in code before anything reaches the student.
      const filter = tutorOutputStream(allowedPhones(helpResources));
      const emit = (text: string) => {
        if (!text) return;
        answer += text;
        send({ type: "delta", text });
      };
      try {
        for await (const event of ai.streamChat(
          { role: "tutor", purpose: "tutor", actorId: user.id },
          {
            system: tutorSystemPrompt(found.unit, helpResources),
            cacheSystem: true,
            messages,
            tools,
            maxTokens: TUTOR_LIMITS.maxOutputTokens,
            signal: request.signal,
          },
        )) {
          if (event.type === "text") {
            // Text after a calculator round starts a new paragraph instead of gluing onto the previous one.
            const delta = afterTool && answer && !answer.endsWith("\n") ? `\n\n${event.delta}` : event.delta;
            afterTool = false;
            emit(filter.push(delta));
          } else if (event.type === "tool_result") {
            emit(filter.flush());
            afterTool = true;
          }
        }
        emit(filter.flush());
        const { data: saved } = await admin
          .from("tutor_messages")
          .insert({ session_id: sid, role: "assistant", content: answer, safety_flags: screened.flags })
          .select("id")
          .single();
        const { data: s } = await admin.from("tutor_sessions").select("message_count").eq("id", sid).single();
        await admin.from("tutor_sessions").update({ message_count: (s?.message_count ?? 0) + 2, last_message_at: new Date().toISOString() }).eq("id", sid);
        send({ type: "done", messageId: saved?.id ?? null, flags: screened.flags });
      } catch (error) {
        let msg = "El tutor no pudo responder ahora. Intenta de nuevo en un momento.";
        if (error instanceof AIBudgetExceededError) {
          msg = "El tutor está descansando por hoy. Mientras tanto, repasa el material y practica con los ejercicios.";
          console.warn("tutor refused:", error.message);
        }
        else if (error instanceof AIRefusalError) msg = "El tutor no puede ayudar con eso. Prueba a preguntar sobre el tema de la unidad.";
        else if (!(error instanceof AIUnavailableError)) console.error("tutor turn failed:", (error as Error).message);
        if (answer) {
          await admin.from("tutor_messages").insert({ session_id: sid, role: "assistant", content: answer, safety_flags: [...screened.flags] });
        }
        send({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
