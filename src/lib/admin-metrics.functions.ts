import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadInteractions } from "./interaction-inbox.server";
import { groupApplicants, type Followup } from "./applicant-followup";
import { aggregateMetrics, isFictionalMetricRecord, type MetricPerson } from "./admin-metrics";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
export const metricsRangeSchema = z.object({ from: day, to: day }).refine((r) => r.from <= r.to && Date.parse(r.to) - Date.parse(r.from) <= 365 * 86400000, "Selecciona un período de hasta 366 días.");
export const getAdminMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => metricsRangeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("Solo administradores.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    async function all<T>(fetchPage: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
      const rows: T[] = [];
      for (let a = 0; ; a += 500) {
        const r = await fetchPage(a, a + 499);
        if (r.error) throw new Error("No se pudieron cargar las métricas.");
        rows.push(...(r.data ?? []));
        if ((r.data?.length ?? 0) < 500) return rows;
      }
    }
    const [rawInteractions, profiles, calls, followups, links, roles, audit, decisions, scholarships] = await Promise.all([
      loadInteractions(db),
      all((a,b) => db.from("profiles").select("id,full_name,created_at,updated_at").order("id").range(a,b)),
      all((a,b) => db.from("applicant_calls").select("*").order("id").range(a,b)),
      all((a,b) => db.from("applicant_followups").select("*").order("person_key").range(a,b)),
      all((a,b) => db.from("applicant_identity_links").select("source_key,target_key").order("source_key").range(a,b)),
      all((a,b) => db.from("user_roles").select("user_id").eq("role","admin").order("id").range(a,b)),
      all((a,b) => db.from("applicant_followup_audit").select("record_key,record_type,after_data,created_at").eq("record_type","applicant_followups").order("id").range(a,b)),
      all((a,b) => db.from("scholarship_decisions").select("user_id,scholarship_id").eq("decision","guardada").order("id").range(a,b)),
      all((a,b) => db.from("scholarships").select("id,name,deadline,es_demo,estado_datos").order("id").range(a,b)),
    ]);
    const resolve = (initial: string) => {
      let key = initial; const seen = new Set<string>();
      while (!seen.has(key)) { seen.add(key); const link = links.find((l) => l.source_key === key); if (!link) break; key = link.target_key; }
      return key;
    };
    const excluded = new Set<string>(roles.map((r) => resolve(`user:${r.user_id}`)));
    for (const f of followups) if (isFictionalMetricRecord(f.objective)) excluded.add(resolve(f.person_key));
    for (const p of profiles) if (isFictionalMetricRecord(p.full_name)) excluded.add(resolve(`user:${p.id}`));
    const interactions = rawInteractions.filter((r) => !isFictionalMetricRecord(r.title) && !isFictionalMetricRecord(r.requestText ?? "") && !excluded.has(resolve(r.userId ? `user:${r.userId}` : r.key)));
    const realProfiles = profiles.filter((p) => !excluded.has(resolve(`user:${p.id}`)));
    const realCalls = calls.filter((c) => !isFictionalMetricRecord(c.full_name) && !isFictionalMetricRecord(c.notes) && !excluded.has(resolve(c.user_id ? `user:${c.user_id}` : `call:${c.id}`)));
    const saved = decisions.flatMap((d) => { const s = scholarships.find((s) => s.id === d.scholarship_id && !s.es_demo && s.estado_datos !== "propuesta_ficticia_no_verificada"); return s ? [{ ...s, user_id: d.user_id }] : []; });
    const grouped = groupApplicants({ profiles: realProfiles, interactions, calls: realCalls, followups: followups as Followup[], links, saved }, Date.now());
    const people: MetricPerson[] = grouped.flatMap((p) => {
      const touches = [
        ...realProfiles.filter((r) => resolve(`user:${r.id}`) === p.key).map((r) => ({ date: r.created_at, channel: "Registro web" })),
        ...p.interactions.flatMap((r) => { const date = r.incomingAt ?? r.messages.filter((m) => ["user","entrante"].includes(m.direction)).map((m) => m.date).sort()[0]; return date ? [{ date, channel: r.channel }] : []; }),
        ...p.calls.map((c) => ({ date: c.occurred_at, channel: "Llamada" })),
      ].sort((a,b) => a.date.localeCompare(b.date) || a.channel.localeCompare(b.channel));
      const first = touches[0];
      return first ? [{ key: p.key, createdAt: first.date, channel: first.channel, stage: p.followup.stage, priority: p.priority }] : [];
    });
    const events = audit.flatMap((a) => {
      const value = a.after_data as { stage?: string } | null;
      return value?.stage === "postulado" || value?.stage === "seguimiento" ? [{ key: resolve(a.record_key), date: a.created_at }] : [];
    });
    return { ...aggregateMetrics(people, events, data), range: data, generatedAt: new Date().toISOString() };
  });