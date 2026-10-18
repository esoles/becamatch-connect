// Shared AI orientation logic (server-only). Used by the web assistant and the WhatsApp bot
// so there is a single response system with a single set of rules.

export interface ScholarshipFacts {
  name: string;
  entity: string;
  country: string;
  deadline: string;
  area: string | null;
  study_level: string | null;
  coverage: string | null;
  requirements: string | null;
  documents: string | null;
  official_url: string | null;
  min_gpa: number | null;
  language_code: string | null;
  language_level: string | null;
}

export function scholarshipFactsBlock(sch: ScholarshipFacts | null): string {
  if (!sch) return "El usuario no ha seleccionado ninguna beca.";
  return [
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
    `Enlace oficial: ${sch.official_url ?? "no registrado"}`,
  ].join("\n");
}

const BASE_RULES = `REGLAS OBLIGATORIAS:
- Responde SOLO con los datos proporcionados. Puedes responder sobre requisitos, elegibilidad, cobertura, fechas y documentos.
- Las listas de documentos se generan únicamente a partir de los campos "Documentos requeridos" y "Requisitos".
- Si un dato no está registrado, dilo expresamente ("ese dato no está registrado") y dirige al usuario al enlace oficial.
- Nunca inventes becas, requisitos, montos, beneficios ni fechas.
- Nunca afirmes que el usuario ha postulado ni que BecaMatch envía postulaciones: la postulación siempre se realiza fuera de BecaMatch, en la fuente oficial.
- No solicites ni expongas datos personales innecesarios. Nunca compartas perfiles o decisiones de otros usuarios.`;

export function buildSystemPrompt(opts: {
  scholarship: ScholarshipFacts | null;
  catalog?: { name: string; entity: string; country: string; deadline: string }[];
  channel: "web" | "whatsapp";
}): string {
  const catalogBlock = opts.catalog?.length
    ? `\n\nBECAS VERIFICADAS DISPONIBLES (únicas que puedes mencionar):\n${opts.catalog
        .map((s) => `- ${s.name} (${s.entity}, ${s.country}, cierra ${s.deadline})`)
        .join("\n")}`
    : "";

  const channelRules =
    opts.channel === "whatsapp"
      ? `\n- Responde en máximo 4 líneas cortas, aptas para WhatsApp (sin formato markdown complejo).
- Dirige al estudiante a BecaMatch (becamatch-connect.lovable.app) para guardar becas, ver su ficha completa y crear o completar su perfil.`
      : `\n- Al terminar cada respuesta, incluye el enlace oficial (si existe) y sugiere un siguiente paso concreto (por ejemplo: revisar el enlace oficial, guardar la beca o preparar un documento).`;

  return `Eres el asistente de orientación de BecaMatch, una aplicación que ayuda a estudiantes peruanos a encontrar becas. Respondes en español, de forma breve y clara.

CÓMO FUNCIONA BECAMATCH (puedes explicarlo cuando pregunten):
- El estudiante crea su perfil (nivel de estudios, área, países de interés, idiomas, promedio).
- BecaMatch calcula una compatibilidad de 0 a 100 con cada beca verificada y se las muestra ordenadas.
- El estudiante guarda o descarta becas, revisa la ficha de cada una y consulta el enlace oficial.
- La postulación NO se hace en BecaMatch: se realiza en la convocatoria oficial de cada entidad.

DATOS REALES DE LA BECA SELECCIONADA (única fuente permitida sobre esa beca):
${scholarshipFactsBlock(opts.scholarship)}${catalogBlock}

${BASE_RULES}${channelRules}`;
}

export async function callAssistantAi(
  system: string,
  messages: { role: "user" | "assistant"; content: string }[],
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { ok: false, error: "El servicio de IA no está configurado (falta la clave del servidor)." };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      reasoning_effort: "low",
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `El servicio de IA respondió con error (${res.status}). ${t.slice(0, 200)}` };
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const reply = json.choices?.[0]?.message?.content?.trim();
  if (!reply) return { ok: false, error: "El asistente no generó respuesta. Intenta de nuevo." };
  return { ok: true, reply };
}
