import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  requestText: z.string().trim().min(20).max(2000),
});

type ScholarshipRow = {
  id: string; name: string; entity: string; country: string; deadline: string;
  study_level: string | null; area: string | null; min_gpa: number | null;
  coverage: string | null; requirements: string | null; documents: string | null;
  official_url: string | null; language_code: string | null; language_level: string | null;
};

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function analyzeWithAI(requestText: string, catalog: ScholarshipRow[]): Promise<{ needs: Record<string, unknown>; ids: string[] }> {
  const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
  if (!LOVABLE_API_KEY) return { needs: {}, ids: [] };
  const list = catalog.map((s) => ({ id: s.id, nombre: s.name, entidad: s.entity, pais: s.country, nivel: s.study_level, area: s.area, promedio_minimo: s.min_gpa, fecha_limite: s.deadline, idioma: s.language_code ? `${s.language_code} ${s.language_level ?? ""}`.trim() : null }));
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      reasoning_effort: "low",
      messages: [
        { role: "system", content: "Eres un asistente de BecaMatch. Analiza la solicitud del estudiante y elige hasta 3 becas del catálogo que mejor encajen. NUNCA inventes becas: solo puedes devolver IDs exactos del catálogo. Responde SOLO con JSON." },
        { role: "user", content: `Solicitud del estudiante:\n${requestText}\n\nCatálogo de becas (JSON):\n${JSON.stringify(list)}\n\nDevuelve JSON con: {"needs": {"nivel": string|null, "area": string|null, "paises": string[], "promedio": number|null}, "recommended_ids": string[]}` },
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
    const ids = (Array.isArray(parsed.recommended_ids) ? parsed.recommended_ids : []).filter((id: unknown) => typeof id === "string" && valid.has(id)).slice(0, 3);
    return { needs: parsed.needs ?? {}, ids };
  } catch {
    return { needs: {}, ids: [] };
  }
}

function buildEmailHtml(name: string, becas: ScholarshipRow[], appUrl: string): string {
  const items = becas.map((s) => {
    const link = `${appUrl.replace(/\/$/, "")}/beca/${s.id}`;
    return `<div style="border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:12px 0">
      <h3 style="margin:0 0 4px">${esc(s.name)}</h3>
      <p style="margin:2px 0;color:#555">${esc(s.entity)} · ${esc(s.country)}</p>
      <p style="margin:2px 0"><b>Fecha límite:</b> ${esc(s.deadline)}</p>
      ${s.coverage ? `<p style="margin:2px 0"><b>Cobertura:</b> ${esc(s.coverage)}</p>` : ""}
      ${s.requirements ? `<p style="margin:2px 0"><b>Requisitos:</b> ${esc(s.requirements)}</p>` : ""}
      ${s.documents ? `<p style="margin:2px 0"><b>Documentos:</b> ${esc(s.documents)}</p>` : ""}
      ${s.official_url ? `<p style="margin:2px 0"><a href="${esc(s.official_url)}">Enlace oficial</a></p>` : ""}
      <p style="margin:8px 0 0"><a href="${esc(link)}" style="background:#0d9488;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;display:inline-block">Ver en BecaMatch</a></p>
    </div>`;
  }).join("");
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
    <h2>Hola ${esc(name)},</h2>
    <p>Gracias por contarnos tu situación. Estas son las becas que mejor encajan contigo:</p>
    ${items}
    <p><b>Próximos pasos:</b> revisa los requisitos de cada beca, prepara los documentos indicados y postula desde el enlace oficial antes de la fecha límite.</p>
    <p style="color:#888;font-size:12px">BecaMatch · Datos de demostración</p>
  </div>`;
}

export const submitPostulation = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("postulation_requests")
      .insert({ full_name: data.fullName, email: data.email, request_text: data.requestText, status: "recibida" })
      .select("id")
      .single();
    if (insErr || !inserted) {
      console.error("insert postulation failed", insErr);
      return { ok: false as const, error: "No se pudo registrar tu solicitud. Inténtalo de nuevo." };
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: catalog } = await supabaseAdmin
      .from("scholarships").select("*")
      .eq("archived", false).gte("deadline", today).order("deadline");

    const becas = (catalog ?? []) as ScholarshipRow[];
    const analysis = await analyzeWithAI(data.requestText, becas);
    // Fallback determinista: si la IA no eligió nada, las 3 becas con deadline más próxima.
    const recommended = analysis.ids.length
      ? analysis.ids.map((id) => becas.find((b) => b.id === id)!).filter(Boolean)
      : becas.slice(0, 3);

    await supabaseAdmin.from("postulation_requests")
      .update({ ai_analysis: analysis.needs as import("@/integrations/supabase/types").Json, recommended_scholarship_ids: recommended.map((b) => b.id), status: "analizada" })
      .eq("id", inserted.id);

    const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
    const RESEND_API_KEY = process.env["RESEND_API_KEY"];
    let emailStatus = "error";
    if (LOVABLE_API_KEY && RESEND_API_KEY && recommended.length) {
      const appUrl = process.env["APP_URL"] ?? "https://becamatch-connect.lovable.app";
      const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY },
        body: JSON.stringify({
          from: "BecaMatch <onboarding@resend.dev>",
          to: [data.email],
          subject: `Tu plan de postulación — BecaMatch`,
          html: buildEmailHtml(data.fullName, recommended, appUrl),
        }),
      });
      if (res.ok) emailStatus = "correo_enviado";
      else console.error(`Resend failed [${res.status}]: ${await res.text()}`);
    }
    await supabaseAdmin.from("postulation_requests").update({ status: emailStatus }).eq("id", inserted.id);
    return { ok: true as const };
  });
