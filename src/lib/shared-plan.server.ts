import type { AgentPlan, AgentProfile, PlanScholarship } from "./postulation-agent";
import { shareablePlan, selectedOpportunity, PLAN_STEPS } from "./shared-plan";
import type { CompatProfile } from "./compatibility";
import { isAvailable } from "./compatibility";
import type { Json } from "@/integrations/supabase/types";

type Db = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
export const blankPlanProfile: AgentProfile = {
  name: "", residence: "", nationality: "", currentLevel: "", desiredLevel: "", area: "",
  gpa: null, gpaScale: null, languages: [], countries: [], startYear: null, funding: "",
};
export async function verifiedCatalog(db: Db) {
  const result = await db.from("scholarships").select("*").eq("verified", true)
    .eq("es_demo", false).eq("estado_datos", "verificada").eq("archived", false)
    .gt("deadline", new Date().toISOString().slice(0, 10));
  if (result.error) throw new Error("No se pudo consultar el catálogo verificado.");
  return result.data;
}
export function planForSelection(catalog: PlanScholarship[], profile: CompatProfile | null): AgentPlan {
  const verified = catalog.filter((s) => !s.es_demo && s.estado_datos === "verificada" && isAvailable(s, new Date().toISOString().slice(0, 10)));
  return {
    profile: blankPlanProfile,
    opportunities: verified.map((s) => selectedOpportunity(s, profile)),
    notice: verified.length
      ? "Plan de orientación con datos verificados. Confirma los datos faltantes y la vigencia en cada fuente oficial."
      : "No hay una beca real verificada y vigente identificada. Indica el nombre o enlace oficial de la beca y completa nivel, área, promedio e idiomas; no se incluyen ejemplos ficticios.",
    steps: PLAN_STEPS,
  };
}
export async function saveSharedPlan(db: Db, plan: AgentPlan, source: {
  conversationId?: string; requestId?: string; whatsappMessageId?: string; userId?: string | null;
}) {
  const result = await db.from("web_agent_plans").insert({
    conversation_id: source.conversationId ?? null, request_id: source.requestId ?? null,
    whatsapp_message_id: source.whatsappMessageId ?? null, user_id: source.userId ?? null,
    plan: plan as unknown as Json, shared_content: shareablePlan(plan) as unknown as Json,
  }).select("id,plan_number,share_id,created_at").single();
  if (result.error || !result.data) throw new Error("No se pudo guardar el plan y su seguimiento.");
  const row = result.data;
  return { ...plan, planNumber: row.plan_number ?? "", shareId: row.share_id,
    shareUrl: `https://becamatch-connect.lovable.app/plan/${row.share_id}`, createdAt: row.created_at };
}

export async function sendStoredPlanEmail(db: Db, shareId: string, email: string) {
  const stored = await db.from("web_agent_plans").select("id,plan_number").eq("share_id", shareId).single();
  if (stored.error || !stored.data) throw new Error("No se encontró el plan guardado.");
  const key = process.env["LOVABLE_API_KEY"], resend = process.env["RESEND_API_KEY"];
  if (!key || !resend) return { ok: false, error: "Correo no configurado. Puedes copiar el enlace del plan." };
  const link = `https://becamatch-connect.lovable.app/plan/${shareId}`;
  let ok = false;
  try {
    const response = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Connection-Api-Key": resend },
      body: JSON.stringify({ from: "BecaMatch <onboarding@resend.dev>", to: [email],
        subject: `Tu plan ${stored.data.plan_number} — BecaMatch`,
        text: `Consulta tu plan de postulación ${stored.data.plan_number}:\n${link}\n\nEl enlace permite consultar el plan. Compártelo solo con personas de confianza. BecaMatch no envía postulaciones.`,
      }),
    });
    if (response.ok) {
      const body = await response.json() as { id?: string };
      ok = typeof body.id === "string";
    } else console.error("Plan email rejected", response.status, await response.text());
  } catch { console.error("Plan email unavailable"); }
  const updated = await db.from("web_agent_plans").update({ delivery_status: ok ? "correo_aceptado" : "correo_error" }).eq("id", stored.data.id);
  if (updated.error) throw new Error("No se pudo registrar el resultado del envío.");
  return ok ? { ok: true } : { ok: false, error: "El servicio no aceptó el correo. El remitente de prueba requiere destinatarios autorizados; puedes copiar el enlace." };
}