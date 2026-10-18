import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAssistantAi } from "./assistant.server";
import { verificationLabel, expiryLabel } from "./admin-scholarships";

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const Input = z.object({
  messages: z.array(Message).min(1).max(40),
});

const today = () => new Date().toISOString().slice(0, 10);

async function gatherAdminContext(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = today();
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [scholarships, profiles, requests, decisions, whatsapp] = await Promise.all([
    supabaseAdmin
      .from("scholarships")
      .select(
        "id, name, entity, country, deadline, verified, archived, es_demo, estado_datos, official_url, requirements, documents, coverage, study_level, area",
      ),
    supabaseAdmin.from("profiles").select("id, updated_at", { count: "exact" }),
    supabaseAdmin
      .from("postulation_requests")
      .select("id, full_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("scholarship_decisions")
      .select("id, status", { count: "exact" })
      .eq("status", "saved"),
    supabaseAdmin
      .from("whatsapp_messages")
      .select("id, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const rows = scholarships.data ?? [];
  const real = rows.filter(
    (s) => !s.es_demo && s.estado_datos !== "propuesta_ficticia_no_verificada",
  );
  const demo = rows.length - real.length;
  const pendingVerification = real.filter(
    (s) => verificationLabel(s) === "Pendiente de verificación",
  );
  const expiring = real.filter(
    (s) => !s.archived && s.deadline >= now && s.deadline <= in30,
  );
  const expired = real.filter((s) => !s.archived && s.deadline < now);
  const incomplete = real.filter(
    (s) => !s.requirements || !s.documents || !s.coverage || !s.official_url,
  );
  const pendingRequests = (requests.data ?? []).filter((r) =>
    ["recibida", "analizada", "error"].includes(r.status),
  );

  const list = (items: { name: string; entity: string; deadline: string }[]) =>
    items.length
      ? items.map((s) => `- ${s.name} (${s.entity}, cierra ${s.deadline})`).join("\n")
      : "- Ninguna";

  return `DATOS REALES DE LA PLATAFORMA (fecha de hoy: ${now}):

BECAS:
- Total registradas: ${rows.length} (reales: ${real.length}, ejemplos de demostración: ${demo})
- Verificadas: ${real.filter((s) => verificationLabel(s) === "Verificada").length}
- Pendientes de verificación: ${pendingVerification.length}
${list(pendingVerification)}
- Vencen en los próximos 30 días: ${expiring.length}
${list(expiring)}
- Vencidas (no archivadas): ${expired.length}
${list(expired)}
- Con campos incompletos (requisitos, documentos, cobertura o enlace oficial): ${incomplete.length}
${list(incomplete)}

POSTULANTES Y ACTIVIDAD:
- Perfiles registrados: ${profiles.count ?? 0}
- Becas guardadas (total en la plataforma): ${decisions.count ?? 0}
- Último mensaje de WhatsApp registrado: ${whatsapp.data?.[0]?.created_at ?? "ninguno"}

SOLICITUDES DE POSTULACIÓN:
- Pendientes de atención: ${pendingRequests.length}
${pendingRequests.length ? pendingRequests.map((r) => `- ${r.full_name} (${r.status}, ${r.created_at.slice(0, 10)})`).join("\n") : "- Ninguna"}
- Últimas solicitudes: ${(requests.data ?? []).length} registradas en total reciente

SECCIONES DEL PANEL (para sugerir enlaces):
- Resumen: /admin · Becas: /admin/becas · Verificación: /admin/verificacion
- Postulantes: /admin/postulantes · Solicitudes: /admin/solicitudes
- Marketing: /admin/marketing · WhatsApp: /admin/whatsapp · Administradores: /admin/usuarios`;
}

const SYSTEM_RULES = `Eres el copiloto administrativo de BecaMatch, exclusivo para administradores. Respondes en español, de forma clara y profesional.

REGLAS OBLIGATORIAS:
- Responde SOLO con los datos proporcionados en este mensaje. Nunca inventes cifras, actividades, tendencias ni resultados.
- Si un dato no está disponible, dilo expresamente y sugiere dónde consultarlo en el panel.
- Distingue siempre entre información verificada, pendiente de verificación y contenido generado como borrador.
- Estás en modo de consulta y recomendación: NO puedes crear, editar, verificar ni eliminar becas, ni enviar comunicaciones. Si el administrador pide una acción de escritura, explica qué haría, qué datos se modificarían e indícale la sección del panel donde ejecutarla (por ejemplo /admin/becas o /admin/verificacion). Nunca afirmes que realizaste una acción.
- No modifiques roles, permisos ni políticas de seguridad. No alteres las reglas de compatibilidad.
- Limita la información personal a lo estrictamente necesario; no expongas correos ni datos de contacto de postulantes.
- Cuando sea útil, organiza la respuesta con listas o tablas en texto plano y sugiere la sección del panel correspondiente como siguiente paso.
- Indica claramente cuándo una respuesta es una recomendación tuya y cuándo procede directamente de los datos registrados.`;

export const askAdminAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || !role.data)
      return { ok: false as const, error: "Solo administradores autorizados pueden usar este asistente." };

    let adminContext: string;
    try {
      adminContext = await gatherAdminContext();
    } catch {
      return { ok: false as const, error: "No se pudieron cargar los datos de la plataforma." };
    }

    return callAssistantAi(`${SYSTEM_RULES}\n\n${adminContext}`, data.messages);
  });
