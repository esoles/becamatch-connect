// WhatsApp bot (server-only). Answers only from stored scholarship data, reusing the
// shared assistant logic (assistant.server.ts) and the deterministic compatibility rules.
import { answer } from "./assistant";
import { fmtDate } from "./profile";
import { buildSystemPrompt, callAssistantAi } from "./assistant.server";
import { buildDeck, type CompatProfile } from "./compatibility";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
type Sch = {
  id: string; name: string; entity: string; country: string; deadline: string; area: string | null;
  study_level: string | null; coverage: string | null; requirements: string | null; documents: string | null;
  official_url: string | null; min_gpa: number | null; language_code: string | null; language_level: string | null;
};

export const ASK = "¿Deseas GUARDAR o DESCARTAR esta beca?";
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["beca", "becas", "para", "programa", "del", "las", "los", "the", "and", "de", "la", "el"]);

export function findScholarship(list: Sch[], text: string): Sch | null {
  const q = norm(text);
  const exact = list.filter((s) => q.includes(norm(s.name))).sort((a, b) => b.name.length - a.name.length)[0];
  if (exact) return exact;
  const qTokens = new Set(q.split(" "));
  let best: Sch | null = null, bestScore = 0;
  for (const s of list) {
    const toks = norm(s.name).split(" ").filter((t) => t.length > 2 && !STOP.has(t));
    if (!toks.length) continue;
    const hits = toks.filter((t) => qTokens.has(t)).length;
    const score = hits / toks.length;
    if (hits >= 1 && score >= 0.5 && score > bestScore) { best = s; bestScore = score; }
  }
  return best;
}

export function summary(s: Sch) {
  return `${s.name} (${s.entity}, ${s.country}): cierra el ${fmtDate(s.deadline)}; cobertura: ${s.coverage?.trim() || "no registrada"}.`;
}

function newToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function handleIncoming(db: Admin, phone: string, body: string, origin: string): Promise<string> {
  const log = (direction: string, text: string, extra: Record<string, unknown> = {}) =>
    db.from("whatsapp_messages").insert({ phone, direction, body: text, ...extra });

  const { data: sess } = await db.from("whatsapp_sessions").select("*").eq("phone", phone).maybeSingle();
  if (!sess) await db.from("whatsapp_sessions").insert({ phone });
  const userId = sess?.user_id ?? null;
  const q = norm(body);
  const { data: list } = await db.from("scholarships").select("*").eq("archived", false);
  const all = (list ?? []) as Sch[];
  const current = all.find((s) => s.id === sess?.current_scholarship_id) ?? null;

  let reply: string, action: string | null = null, result: string | null = null, sid: string | null = null;

  if (/\bguardar\b/.test(q)) {
    action = "guardar";
    if (!current) { reply = "Primero dime qué beca te interesa. Ej.: «Dame información de la BECA ABC»."; result = "sin_beca"; }
    else if (userId) {
      sid = current.id;
      const { error } = await db.from("scholarship_decisions").upsert(
        { user_id: userId, scholarship_id: current.id, decision: "guardada", updated_at: new Date().toISOString() },
        { onConflict: "user_id,scholarship_id" });
      result = error ? "error" : "guardada";
      reply = error ? "No pude guardarla ahora. Intenta de nuevo en unos minutos." : `✅ «${current.name}» quedó guardada en Mis becas.`;
      if (!error) await db.from("whatsapp_sessions").update({ current_scholarship_id: null, updated_at: new Date().toISOString() }).eq("phone", phone);
    } else {
      sid = current.id;
      const token = newToken();
      await db.from("whatsapp_sessions").update({
        pending_action: "guardar", pending_scholarship_id: current.id, link_token: token,
        link_token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), updated_at: new Date().toISOString(),
      }).eq("phone", phone);
      result = "pendiente_vinculacion";
      reply = `Para guardar «${current.name}», inicia sesión o regístrate y vincula tu WhatsApp (enlace válido 1 hora):\n${origin}/whatsapp/vincular?t=${token}`;
    }
  } else if (/\bdescartar\b/.test(q)) {
    action = "descartar";
    if (!current) { reply = "No hay una beca en consulta para descartar."; result = "sin_beca"; }
    else {
      sid = current.id;
      if (userId) await db.from("scholarship_decisions").upsert(
        { user_id: userId, scholarship_id: current.id, decision: "descartada", updated_at: new Date().toISOString() },
        { onConflict: "user_id,scholarship_id" });
      await db.from("whatsapp_sessions").update({ current_scholarship_id: null, updated_at: new Date().toISOString() }).eq("phone", phone);
      result = "descartada";
      reply = `Listo, descarté «${current.name}». Pregúntame por otra beca cuando quieras.`;
    }
  } else if (/\b(ayuda|hola|como funciona|que es becamatch|inicio|menu)\b/.test(q)) {
    action = "ayuda"; result = "explicacion";
    reply = [
      "👋 Soy el asistente de BecaMatch. Te ayudo a encontrar becas verificadas:",
      "1) Crea tu perfil en la web (nivel, área, países, idiomas, promedio).",
      "2) Te muestro becas ordenadas por compatibilidad (0-100).",
      "3) Guardas las que te interesen y postulas en la convocatoria oficial (la postulación NO se hace aquí).",
      "Escríbeme el nombre de una beca, «becas compatibles» o «ayuda con mi perfil».",
    ].join("\n");
  } else if (/\bperfil\b/.test(q) && /\b(ayuda|completar|crear|llenar|como)\b/.test(q)) {
    action = "ayuda"; result = "orientacion_perfil";
    reply = userId
      ? "Tu WhatsApp ya está vinculado. Completa o revisa tu perfil en BecaMatch → sección Perfil: nivel de estudios, área, países de interés, idiomas y promedio (0-20). Con eso calculo tu compatibilidad con cada beca."
      : "Para crear tu perfil entra a BecaMatch y pulsa «Crear mi perfil»: nivel de estudios, área, países de interés, idiomas y promedio (0-20). Luego puedes vincular este WhatsApp para guardar becas desde aquí.";
  } else if (/\b(becas? compatibles?|recomienda|recomendacion|que becas|buscar becas?)\b/.test(q)) {
    action = "compatibles";
    if (!userId) {
      result = "sin_perfil";
      reply = "Para recomendarte becas compatibles necesito tu perfil. Regístrate en BecaMatch, complétalo y vincula este WhatsApp. Mientras tanto, escríbeme el nombre de una beca y te doy su información.";
    } else {
      const { data: prof } = await db.from("profiles").select("study_level, area, countries, languages, gpa").eq("id", userId).maybeSingle();
      if (!prof) {
        result = "sin_perfil";
        reply = "Aún no tienes perfil en BecaMatch. Créalo en la web (sección Perfil) y vuelve a preguntarme.";
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const deck = buildDeck(prof as unknown as CompatProfile, all as never, today);
        const top = deck.eligible.slice(0, 3);
        if (!top.length) {
          result = "sin_resultados";
          reply = "Por ahora no hay becas verificadas compatibles con tu perfil. Revisa el mazo en BecaMatch más adelante.";
        } else {
          result = "listadas";
          reply = "Tus 3 becas más compatibles:\n" +
            top.map((r, i) => `${i + 1}) ${r.scholarship.name} — compatibilidad ${r.compatibility_score}/100, cierra ${fmtDate(r.scholarship.deadline)}.`).join("\n") +
            "\nEscríbeme el nombre de una para ver detalles. Guárdalas desde BecaMatch o escribiendo GUARDAR aquí.";
        }
      }
    }
  } else {
    const found = findScholarship(all, body);
    if (found) {
      action = "consultar"; sid = found.id; result = "encontrada";
      await db.from("whatsapp_sessions").update({ current_scholarship_id: found.id, updated_at: new Date().toISOString() }).eq("phone", phone);
      reply = `${summary(found)}\n${ASK}`;
    } else if (current) {
      const a = answer(current, body);
      action = "pregunta"; sid = current.id; result = a.known ? "dato_registrado" : "no_registrado";
      reply = `${a.text}\n${ASK}`;
    } else {
      // Free-form orientation question: same AI and rules as the web assistant.
      action = "pregunta"; result = "ia";
      const verified = all.filter((s) => (s as { verified?: boolean }).verified);
      const system = buildSystemPrompt({
        scholarship: null,
        channel: "whatsapp",
        catalog: verified.map((s) => ({ name: s.name, entity: s.entity, country: s.country, deadline: s.deadline })),
      });
      const ai = await callAssistantAi(system, [{ role: "user", content: body }]);
      reply = ai.ok
        ? ai.reply
        : "No pude responder eso ahora. Escríbeme el nombre de una beca, «becas compatibles» o «ayuda».";
    }
  }

  await log("entrante", body, { scholarship_id: sid, action, user_id: userId });
  await log("saliente", reply, { scholarship_id: sid, action, result, user_id: userId });
  return reply;
}
