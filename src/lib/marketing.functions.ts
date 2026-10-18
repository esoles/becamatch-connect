import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MarketingContent {
  texto: string;
  beneficios: string[];
  requisitos: string[];
  deadline: string;
  cta: string;
  hashtags: string[];
  campana: string;
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Solo administradores.");
}

const generateInput = z.object({ scholarshipId: z.string().uuid(), channel: z.string().trim().min(1).max(40) });

/** Generates a marketing draft with AI, using only verified scholarship data from the DB. */
export const generateMarketingPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => generateInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin
      .from("scholarships")
      .select("id, name, entity, country, study_level, area, deadline, coverage, requirements, documents, official_url")
      .eq("id", data.scholarshipId)
      .eq("verified", true)
      .eq("archived", false)
      .single();
    if (error || !s) return { ok: false as const, error: "Beca no encontrada o no verificada." };

    const apiKey = process.env["LOVABLE_API_KEY"]!;
    const prompt = `Eres el redactor de marketing de BecaMatch. Genera una publicación para el canal "${data.channel}" sobre esta beca, usando ÚNICAMENTE estos datos verificados (no inventes montos, beneficios, requisitos ni fechas):
${JSON.stringify(s, null, 2)}

Reglas:
- "texto": cuerpo de la publicación (máx. 120 palabras), en español, tono motivador.
- "beneficios": solo los confirmados en la cobertura; si no hay, lista vacía.
- "requisitos": solo los destacados de los requisitos reales; si no hay, lista vacía.
- "deadline": la fecha límite exacta en formato legible (ej. "15 de noviembre de 2026").
- "cta": llamada a la acción que invite a consultar la beca y crear el perfil en BecaMatch.
- "hashtags": 4-6 hashtags relevantes.
- "campana": nombre corto de campaña en slug (ej. "beca-daam-2026").`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "marketing_post",
            strict: true,
            schema: {
              type: "object",
              properties: {
                texto: { type: "string" },
                beneficios: { type: "array", items: { type: "string" } },
                requisitos: { type: "array", items: { type: "string" } },
                deadline: { type: "string" },
                cta: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
                campana: { type: "string" },
              },
              required: ["texto", "beneficios", "requisitos", "deadline", "cta", "hashtags", "campana"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
    if (!res.ok) return { ok: false as const, error: "La IA no pudo generar la publicación. Inténtalo de nuevo." };
    const json = await res.json();
    const content = JSON.parse(json.choices[0].message.content) as MarketingContent;

    const slug = content.campana.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const utm = new URL("https://becamatch-connect.lovable.app/");
    utm.searchParams.set("utm_source", "admin");
    utm.searchParams.set("utm_medium", data.channel);
    utm.searchParams.set("utm_campaign", slug);
    utm.searchParams.set("utm_content", s.id);

    return { ok: true as const, content, utmUrl: utm.toString(), scholarshipName: s.name };
  });

const saveInput = z.object({
  scholarshipId: z.string().uuid(),
  channel: z.string().trim().min(1).max(40),
  campaign: z.string().trim().min(1).max(120),
  content: z.object({
    texto: z.string().max(4000),
    beneficios: z.array(z.string().max(300)).max(20),
    requisitos: z.array(z.string().max(300)).max(20),
    deadline: z.string().max(120),
    cta: z.string().max(500),
    hashtags: z.array(z.string().max(60)).max(15),
    campana: z.string().max(120),
  }),
  utmUrl: z.string().url().max(1000),
});

/** Saves (or re-saves) a marketing post as a draft. */
export const saveMarketingPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("marketing_posts").insert({
      scholarship_id: data.scholarshipId,
      channel: data.channel,
      campaign: data.campaign,
      content: data.content,
      utm_url: data.utmUrl,
      status: "borrador",
      created_by: context.userId,
    });
    if (error) return { ok: false as const, error: "No se pudo guardar la publicación." };
    return { ok: true as const };
  });

const updateInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["borrador", "aprobada", "publicada"]).optional(),
  texto: z.string().max(4000).optional(),
});

/** Approves, marks as published, or edits the text of a marketing post. */
export const updateMarketingPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateInput.parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { updated_at: string; status?: string; published_at?: string | null; content?: import("@/integrations/supabase/types").Json } = {
      updated_at: new Date().toISOString(),
    };
    if (data.status) {
      patch.status = data.status;
      patch.published_at = data.status === "publicada" ? new Date().toISOString() : null;
    }
    if (data.texto !== undefined) {
      const { data: row } = await supabaseAdmin.from("marketing_posts").select("content").eq("id", data.id).single();
      if (!row) return { ok: false as const, error: "Publicación no encontrada." };
      patch.content = { ...(row.content as Record<string, unknown>), texto: data.texto } as import("@/integrations/supabase/types").Json;
    }
    const { error } = await supabaseAdmin.from("marketing_posts").update(patch).eq("id", data.id);
    if (error) return { ok: false as const, error: "No se pudo actualizar." };
    return { ok: true as const };
  });

/** Lists marketing posts with measurable metrics only (posts per campaign, saved scholarships via UTM content id). */
export const listMarketingPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: posts, error } = await supabaseAdmin
      .from("marketing_posts")
      .select("id, scholarship_id, channel, campaign, content, utm_url, status, published_at, created_at, scholarships(name, entity)")
      .order("created_at", { ascending: false });
    if (error) return { ok: false as const, error: "No se pudieron cargar las publicaciones." };

    // Measurable metric: how many times each promoted scholarship was saved (real DB data).
    const ids = [...new Set((posts ?? []).map((p) => p.scholarship_id))];
    const savedCounts = new Map<string, number>();
    if (ids.length) {
      const { data: dec } = await supabaseAdmin
        .from("scholarship_decisions")
        .select("scholarship_id")
        .in("scholarship_id", ids)
        .eq("decision", "guardada");
      for (const d of dec ?? []) savedCounts.set(d.scholarship_id, (savedCounts.get(d.scholarship_id) ?? 0) + 1);
    }

    return {
      ok: true as const,
      posts: (posts ?? []).map((p) => ({
        id: p.id,
        scholarshipId: p.scholarship_id,
        scholarshipName: (p.scholarships as { name: string } | null)?.name ?? "—",
        channel: p.channel,
        campaign: p.campaign,
        content: p.content as unknown as MarketingContent,
        utmUrl: p.utm_url,
        status: p.status,
        publishedAt: p.published_at,
        createdAt: p.created_at,
        guardadas: savedCounts.get(p.scholarship_id) ?? 0,
      })),
    };
  });
