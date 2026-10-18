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
      action = "consultar"; result = "no_encontrada";
      reply = "No encontré esa beca en BecaMatch. Escribe su nombre, p. ej.: «Dame información de la BECA ABC».";
    }
  }

  await log("entrante", body, { scholarship_id: sid, action, user_id: userId });
  await log("saliente", reply, { scholarship_id: sid, action, result, user_id: userId });
  return reply;
}
