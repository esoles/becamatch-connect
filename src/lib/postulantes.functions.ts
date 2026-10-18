import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PostulanteEstado =
  | "nuevo"
  | "perfil_completado"
  | "explorando"
  | "preparando_documentos"
  | "inactivo";

export interface PostulanteRow {
  key: string;
  nombre: string;
  email: string;
  canal: string;
  estado: PostulanteEstado;
  guardadas: number;
  ultimaActividad: string | null;
  proximaDeadline: string | null;
  accionSugerida: string;
}

const INACTIVE_DAYS = 30;

/**
 * Admin-only: merges profiles, postulation requests, decisions and WhatsApp
 * sessions into one row per person (deduplicated by email). All fields come
 * from real stored data; nothing is synthesized.
 */
export const listPostulantes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) return { ok: false as const, error: "Solo administradores." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [profiles, requests, decisions, waSessions, scholarships] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, created_at, updated_at"),
      supabaseAdmin.from("postulation_requests").select("id, full_name, email, status, created_at"),
      supabaseAdmin.from("scholarship_decisions").select("user_id, scholarship_id, decision, updated_at"),
      supabaseAdmin.from("whatsapp_sessions").select("phone, user_id, updated_at").not("user_id", "is", null),
      supabaseAdmin.from("scholarships").select("id, name, deadline").eq("verified", true).eq("archived", false),
    ]);

    const schById = new Map((scholarships.data ?? []).map((s) => [s.id, s]));
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() - INACTIVE_DAYS * 86400000).toISOString();

    const byEmail = new Map<string, PostulanteRow & { userId?: string; lastIso?: string }>();

    const ensure = (email: string, nombre: string) => {
      const key = email.toLowerCase();
      let row = byEmail.get(key);
      if (!row) {
        row = {
          key, nombre, email, canal: "", estado: "nuevo",
          guardadas: 0, ultimaActividad: null, proximaDeadline: null, accionSugerida: "",
        };
        byEmail.set(key, row);
      }
      return row;
    };

    for (const p of profiles.data ?? []) {
      const row = ensure(p.email, p.full_name);
      row.userId = p.id;
      row.canal = "Registro web";
      row.lastIso = p.updated_at ?? p.created_at;
    }
    for (const r of requests.data ?? []) {
      const row = ensure(r.email, r.full_name);
      if (!row.canal) row.canal = "Formulario de postulación";
      if (!row.lastIso || r.created_at > row.lastIso) row.lastIso = r.created_at;
    }
    for (const w of waSessions.data ?? []) {
      const uid = w.user_id as string;
      const profile = (profiles.data ?? []).find((p) => p.id === uid);
      if (!profile) continue;
      const row = ensure(profile.email, profile.full_name);
      row.canal = row.canal ? `${row.canal} + WhatsApp` : "WhatsApp";
      if (w.updated_at && (!row.lastIso || w.updated_at > row.lastIso)) row.lastIso = w.updated_at;
    }

    const decByUser = new Map<string, { guardadas: number; last: string; savedIds: string[] }>();
    for (const d of decisions.data ?? []) {
      const entry = decByUser.get(d.user_id) ?? { guardadas: 0, last: "", savedIds: [] };
      if (d.decision === "guardada") {
        entry.guardadas += 1;
        entry.savedIds.push(d.scholarship_id);
      }
      if (d.updated_at > entry.last) entry.last = d.updated_at;
      decByUser.set(d.user_id, entry);
    }

    for (const row of byEmail.values()) {
      const dec = row.userId ? decByUser.get(row.userId) : undefined;
      row.guardadas = dec?.guardadas ?? 0;
      if (dec && dec.last && (!row.lastIso || dec.last > row.lastIso)) row.lastIso = dec.last;
      row.ultimaActividad = row.lastIso ?? null;

      // Next relevant deadline among saved, verified, future scholarships.
      const future = (dec?.savedIds ?? [])
        .map((id) => schById.get(id))
        .filter((s): s is NonNullable<typeof s> => !!s && s.deadline >= today)
        .sort((a, b) => a.deadline.localeCompare(b.deadline));
      row.proximaDeadline = future[0]?.deadline ?? null;

      // State from real activity only.
      if (!row.userId) row.estado = "nuevo";
      else if (row.lastIso && row.lastIso < cutoff) row.estado = "inactivo";
      else if (row.guardadas > 0) row.estado = "preparando_documentos";
      else if (dec) row.estado = "explorando";
      else row.estado = "perfil_completado";

      row.accionSugerida =
        row.estado === "nuevo" ? "Invitar a crear su perfil"
        : row.estado === "perfil_completado" ? "Sugerir explorar el mazo de becas"
        : row.estado === "explorando" ? "Animar a guardar sus primeras becas"
        : row.estado === "preparando_documentos" ? "Recordar la fecha límite más próxima"
        : "Contactar para reactivar su búsqueda";
    }

    const rows: PostulanteRow[] = [...byEmail.values()].map(({ userId: _u, lastIso: _l, ...r }) => r);
    rows.sort((a, b) => (b.ultimaActividad ?? "").localeCompare(a.ultimaActividad ?? ""));
    return { ok: true as const, rows };
  });
