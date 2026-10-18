import type { UIMessage } from "ai";
import type { AgentPlan } from "./postulation-agent";
import { messagePreview, sortInteractions, type InboxInteraction } from "./interaction-inbox";
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
export async function loadInteractions(db: Admin) {
    async function all<T>(
      fetchPage: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
    ) {
      const rows: T[] = [];
      for (let offset = 0; ; offset += 500) {
        const page = await fetchPage(offset, offset + 499);
        if (page.error) throw new Error("No se pudieron cargar las interacciones.");
        rows.push(...(page.data ?? []));
        if ((page.data?.length ?? 0) < 500) return rows;
      }
    }
    const [requests, conversations, messages, plans, waMessages, sessions, profiles] =
      await Promise.all([
        all((a, b) =>
          db
            .from("postulation_requests")
            .select(
              "id,user_id,full_name,email,request_text,status,attention_status,created_at,updated_at,ai_analysis,recommended_scholarship_ids",
            )
            .order("id")
            .range(a, b),
        ),
        all((a, b) =>
          db
            .from("web_agent_conversations")
            .select("id,user_id,status,created_at,updated_at")
            .order("id")
            .range(a, b),
        ),
        all((a, b) =>
          db
            .from("web_agent_messages")
            .select("id,conversation_id,message,created_at")
            .order("created_at")
            .order("id")
            .range(a, b),
        ),
        all((a, b) =>
          db
            .from("web_agent_plans")
            .select("id,conversation_id,plan,created_at")
            .order("created_at")
            .order("id")
            .range(a, b),
        ),
        all((a, b) =>
          db
            .from("whatsapp_messages")
            .select("id,phone,user_id,direction,body,action,result,created_at")
            .order("created_at")
            .order("id")
            .range(a, b),
        ),
        all((a, b) =>
          db
            .from("whatsapp_sessions")
            .select("phone,user_id,created_at")
            .order("phone")
            .range(a, b),
        ),
        all((a, b) => db.from("profiles").select("id,full_name").order("id").range(a, b)),
      ]);
    const names = new Map(profiles.map((p) => [p.id, p.full_name]));
    const rows: InboxInteraction[] = requests.map((r) => ({
      key: `form:${r.id}`,
      id: r.id,
      channel: "Formulario",
      title: r.full_name,
      userId: r.user_id,
      lastActivity: r.attention_status === "recibida" ? r.created_at : r.updated_at,
      incomingAt: r.created_at,
      preview: r.request_text.slice(0, 160),
      status: r.attention_status,
      processStatus: r.status,
      email: r.email,
      requestText: r.request_text,
      analysis: r.ai_analysis,
      scholarshipIds: r.recommended_scholarship_ids,
      messages: [],
      plans: [],
    }));
    for (const c of conversations) {
      const transcript = messages
        .filter((m) => m.conversation_id === c.id)
        .map((m) => ({
          id: m.id,
          date: m.created_at,
          direction: (m.message as unknown as UIMessage).role,
          message: m.message as unknown as UIMessage,
        }));
      const savedPlans = plans
        .filter((p) => p.conversation_id === c.id)
        .map((p) => ({ date: p.created_at, plan: p.plan as unknown as AgentPlan }));
      if (!transcript.length && !savedPlans.length) continue;
      rows.push({
        key: `web:${c.id}`,
        id: c.id,
        channel: "Agente web",
        title: (c.user_id ? names.get(c.user_id) : null) || `Visitante ${c.id.slice(0, 8)}`,
        userId: c.user_id,
        lastActivity: c.updated_at,
        preview: messagePreview(transcript.at(-1)?.message) || "Plan de postulación",
        status: c.status,
        messages: transcript,
        plans: savedPlans,
      });
    }
    const phones = [...new Set(waMessages.map((m) => m.phone))];
    for (const phone of phones) {
      const transcript = waMessages.filter((m) => m.phone === phone);
      const session = sessions.find((s) => s.phone === phone);
      const userId = session?.user_id ?? transcript.find((m) => m.user_id)?.user_id ?? null;
      const first = transcript[0],
        last = transcript.at(-1);
      if (!first || !last) continue;
      rows.push({
        key: `wa:${first.id}`,
        id: first.id,
        channel: "WhatsApp",
        title: (userId ? names.get(userId) : null) || `Contacto ${first.id.slice(0, 8)}`,
        userId,
        phone,
        lastActivity: last.created_at,
        preview: last.body.slice(0, 160),
        status: "registrada",
        messages: transcript.map((m) => ({
          id: m.id,
          date: m.created_at,
          direction: m.direction,
          body: m.body,
          action: m.action,
          result: m.result,
        })),
        plans: [],
      });
    }
    return sortInteractions(rows);
}
