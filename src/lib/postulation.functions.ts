import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  requestText: z.string().trim().min(20).max(2000),
  accessToken: z.string().max(5000).optional(),
});

type ScholarshipRow = import("./postulation-agent").PlanScholarship;

async function analyzeWithAI(
  requestText: string,
  catalog: ScholarshipRow[],
): Promise<{ needs: Record<string, unknown>; ids: string[] }> {
  const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
  if (!LOVABLE_API_KEY) return { needs: {}, ids: [] };
  const list = catalog.map((s) => ({
    id: s.id,
    nombre: s.name,
    entidad: s.entity,
    pais: s.country,
    nivel: s.study_level,
    area: s.area,
    promedio_minimo: s.min_gpa,
    fecha_limite: s.deadline,
    idioma: s.language_code ? `${s.language_code} ${s.language_level ?? ""}`.trim() : null,
  }));
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      reasoning_effort: "low",
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente de BecaMatch. Analiza la solicitud del estudiante y elige hasta 3 becas del catálogo que mejor encajen. NUNCA inventes becas: solo puedes devolver IDs exactos del catálogo. Responde SOLO con JSON.",
        },
        {
          role: "user",
          content: `Solicitud del estudiante:\n${requestText}\n\nCatálogo de becas (JSON):\n${JSON.stringify(list)}\n\nDevuelve JSON con: {"needs": {"nivel": string|null, "area": string|null, "paises": string[], "promedio": number|null}, "recommended_ids": string[]}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "postulation_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              needs: {
                type: "object",
                properties: {
                  nivel: { type: ["string", "null"] },
                  area: { type: ["string", "null"] },
                  paises: { type: "array", items: { type: "string" } },
                  promedio: { type: ["number", "null"] },
                },
                required: ["nivel", "area", "paises", "promedio"],
                additionalProperties: false,
              },
              recommended_ids: { type: "array", items: { type: "string" } },
            },
            required: ["needs", "recommended_ids"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  if (!res.ok) {
    console.error(`AI gateway failed [${res.status}]: ${await res.text()}`);
    return { needs: {}, ids: [] };
  }
  const json = await res.json();
  try {
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    const valid = new Set(catalog.map((s) => s.id));
    const ids = (Array.isArray(parsed.recommended_ids) ? parsed.recommended_ids : [])
      .filter((id: unknown) => typeof id === "string" && valid.has(id))
      .slice(0, 3);
    return { needs: parsed.needs ?? {}, ids };
  } catch {
    return { needs: {}, ids: [] };
  }
}

export const submitPostulation = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { verifiedIdentity } = await import("./agent-history.server");
    const { verifiedCatalog, planForSelection, saveSharedPlan, sendStoredPlanEmail } = await import("./shared-plan.server");
    const userId = await verifiedIdentity(data.accessToken);
    const inserted = await db.from("postulation_requests").insert({
      full_name: data.fullName, email: data.email, request_text: data.requestText,
      status: "recibida", user_id: userId,
    }).select("id").single();
    if (inserted.error || !inserted.data) return { ok: false as const, error: "No se pudo registrar tu solicitud." };
    const catalog = await verifiedCatalog(db);
    const analysis = catalog.length ? await analyzeWithAI(data.requestText, catalog) : { needs: {}, ids: [] };
    // AI selects only existing catalog IDs. No arbitrary closest-deadline fallback.
    const selected = catalog.filter((s) => analysis.ids.includes(s.id));
    const profileResult = userId ? await db.from("profiles").select("study_level,area,countries,languages,gpa").eq("id", userId).maybeSingle() : null;
    if (profileResult?.error) throw new Error("No se pudo consultar tu perfil.");
    const profile = profileResult?.data as unknown as import("./compatibility").CompatProfile | null;
    const plan = await saveSharedPlan(db, planForSelection(selected, profile ?? null), { requestId: inserted.data.id, userId });
    const updated = await db.from("postulation_requests").update({
      ai_analysis: analysis.needs as import("@/integrations/supabase/types").Json,
      recommended_scholarship_ids: selected.map((s) => s.id), status: "plan_generado",
    }).eq("id", inserted.data.id);
    if (updated.error) throw new Error("El plan se guardó, pero no se pudo actualizar la solicitud.");
    const email = await sendStoredPlanEmail(db, plan.shareId, data.email);
    const delivery = await db.from("postulation_requests").update({ status: email.ok ? "correo_enviado" : "plan_generado" }).eq("id", inserted.data.id);
    if (delivery.error) throw new Error("No se pudo registrar el estado del correo.");
    return { ok: true as const, shareId: plan.shareId, planNumber: plan.planNumber,
      emailAccepted: email.ok, emailError: email.ok ? null : email.error ?? "Correo no disponible." };
  });
