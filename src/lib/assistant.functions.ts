import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(1000),
});

const Input = z.object({
  scholarshipId: z.string().uuid().nullable(),
  messages: z.array(Message).min(1).max(40),
});

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data, context }) => {
    let sch: Record<string, unknown> | null = null;
    if (data.scholarshipId) {
      const { data: row } = await context.supabase
        .from("scholarships")
        .select("name, entity, country, deadline, area, study_level, coverage, requirements, documents, official_url, min_gpa, language_code, language_level, es_demo")
        .eq("id", data.scholarshipId)
        .maybeSingle();
      sch = row;
    }

    const beca = sch
      ? [
          `Nombre: ${sch.name}`,
          `Entidad: ${sch.entity}`,
          `País: ${sch.country}`,
          `Fecha límite: ${sch.deadline}`,
          `Nivel de estudio: ${sch.study_level ?? "no registrado"}`,
          `Área: ${sch.area ?? "no registrada"}`,
          `Cobertura: ${sch.coverage ?? "no registrada"}`,
          `Requisitos: ${sch.requirements ?? "no registrados"}`,
          `Documentos requeridos: ${sch.documents ?? "no registrados"}`,
          `Promedio mínimo: ${sch.min_gpa ?? "no registrado"}`,
          `Idioma: ${sch.language_code ?? "no registrado"}${sch.language_level ? " " + sch.language_level : ""}`,
          `Enlace oficial: ${sch["official_url"] ?? "no registrado"}`,
        ].join("\n")
      : "El usuario no ha seleccionado ninguna beca.";

    const system = `Eres el asistente de orientación de BecaMatch. Respondes en español, de forma breve y clara.

DATOS REALES DE LA BECA SELECCIONADA (única fuente permitida):
${beca}

REGLAS OBLIGATORIAS:
- Responde SOLO con los datos anteriores. Puedes responder sobre requisitos, elegibilidad, cobertura, fechas y documentos.
- Las listas de documentos se generan únicamente a partir del campo "Documentos requeridos" y "Requisitos" anteriores.
- Si un dato no está registrado, dilo expresamente ("ese dato no está registrado") y dirige al usuario al enlace oficial.
- Nunca inventes becas, requisitos, montos, beneficios ni fechas.
- Nunca afirmes que el usuario ha postulado ni que BecaMatch envía postulaciones.
- Al terminar cada respuesta, incluye el enlace oficial (si existe) y sugiere un siguiente paso concreto (por ejemplo: revisar el enlace oficial, guardar la beca o preparar un documento).`;

    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, error: "El servicio de IA no está configurado (falta la clave del servidor)." };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false as const, error: `El servicio de IA respondió con error (${res.status}). ${t.slice(0, 200)}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) return { ok: false as const, error: "El asistente no generó respuesta. Intenta de nuevo." };
    return { ok: true as const, reply };
  });
