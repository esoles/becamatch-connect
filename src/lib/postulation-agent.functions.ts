import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { agentProfileSchema } from "./postulation-agent";
import { readPlan } from "./postulation-agent.server";
import { resumeSchema } from "./agent-history.functions";

export const generateAgentPlan = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    resumeSchema.extend({ profile: agentProfileSchema, confirmed: z.literal(true) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { openConversation } = await import("./agent-history.server");
    const { db } = await openConversation(data);
    const plan = await readPlan(data.profile);
    const result = await db
      .from("web_agent_plans")
      .insert({
        conversation_id: data.conversationId,
        plan: plan as unknown as import("@/integrations/supabase/types").Json,
      });
    if (result.error) throw new Error("No se pudo guardar el plan.");
    const updated = await db
      .from("web_agent_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);
    if (updated.error) throw new Error("No se pudo actualizar la conversación.");
    return plan;
  });

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
export const emailAgentPlan = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        profile: agentProfileSchema,
        email: z.string().email().max(200),
        requested: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"],
      resend = process.env["RESEND_API_KEY"];
    if (!key || !resend) return { ok: false, error: "El envío de correo no está configurado." };
    const plan = await readPlan(data.profile);
    const text = [
      "Tu plan de postulación — BecaMatch",
      JSON.stringify(plan.profile),
      plan.notice,
      ...plan.opportunities.map(
        (s) =>
          `${s.name} (${s.entity}, ${s.country})\nCompatibilidad: ${s.score}/100. ${s.reasons}\nFecha límite: ${s.deadline}\n${s.requirements ?? "Requisitos no registrados"}\n${s.legacyDocuments ?? ""}\n${s.orientation.documents.map((d) => `${d.nombre}: ${d.obligatorio ? "obligatorio" : "opcional"}`).join("\n")}\n${s.pending}\n${s.url ?? "Enlace no registrado"}`,
      ),
      ...plan.steps,
    ].join("\n\n");
    const response = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "X-Connection-Api-Key": resend,
      },
      body: JSON.stringify({
        from: "BecaMatch <onboarding@resend.dev>",
        to: [data.email],
        subject: "Tu plan de postulación — BecaMatch",
        html: `<pre style="white-space:pre-wrap;font-family:Arial">${escapeHtml(text)}</pre>`,
      }),
    });
    if (!response.ok)
      return {
        ok: false,
        error:
          "No se pudo enviar el correo. El remitente de prueba solo permite destinatarios autorizados; para enviar a cualquier estudiante falta verificar un dominio de correo.",
      };
    return { ok: true };
  });
