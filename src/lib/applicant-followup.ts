import type { InboxInteraction } from "./interaction-inbox";

export const stages = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  preparando: "Preparando postulación",
  postulado: "Postulado",
  seguimiento: "Postulación en seguimiento",
  ganado: "Ganado",
  perdido: "Perdido",
} as const;
export type Stage = keyof typeof stages;
export type Followup = {
  person_key: string;
  stage: Stage;
  next_action: string;
  followup_at: string | null;
  assigned_to: string | null;
  objective: string;
  response_resolved_at: string | null;
};
export type Call = {
  id: string;
  full_name: string;
  user_id: string | null;
  occurred_at: string;
  notes: string;
  requires_response: boolean;
};
export type Applicant = {
  key: string;
  name: string;
  userId: string | null;
  channels: string[];
  interactions: InboxInteraction[];
  calls: Call[];
  saved: { id: string; name: string; deadline: string }[];
  lastActivity: string | null;
  followup: Followup;
  priority: number | null;
  factors: string[];
  pendingSince: string | null;
  response: "pending" | "answered" | "unknown";
  suggestion: string;
};
const DAY = 86400000;
export function responseState(interactions: InboxInteraction[], calls: Call[], f: Followup) {
  if (f.stage === "ganado" || f.stage === "perdido")
    return { response: "answered" as const, pendingSince: null };
  const pending: string[] = [];
  let known = false;
  let unknown = false;
  for (const r of interactions) {
    if (r.status === "atendida") {
      known = true;
      continue;
    }
    if (r.channel === "Formulario") {
      if (r.processStatus === "correo_enviado") {
        unknown = true;
        continue;
      } // Provider acceptance is not delivery evidence.
      pending.push(r.incomingAt ?? r.lastActivity);
      known = true;
      continue;
    }
    const incoming = r.messages
      .filter((m) => m.direction === "user" || m.direction === "entrante")
      .sort((a, b) => a.date.localeCompare(b.date))
      .at(-1);
    if (!incoming) {
      unknown = true;
      continue;
    }
    const answered =
      r.channel === "Agente web" &&
      r.messages.some(
        (m) =>
          m.direction === "assistant" &&
          m.date >= incoming.date &&
          m.message?.parts.some((p) => p.type === "text" && p.text.trim()),
      );
    if (answered) known = true;
    else if (r.channel === "Agente web") {
      known = true;
      pending.push(incoming.date);
    }
    // WhatsApp outgoing logs have no delivery receipt: do not infer an effective response.
    else if (!r.messages.some((m) => m.direction === "saliente" && m.date >= incoming.date)) {
      known = true;
      pending.push(incoming.date);
    } else if (!f.response_resolved_at || incoming.date > f.response_resolved_at) unknown = true;
  }
  for (const c of calls) {
    known = true;
    if (c.requires_response) pending.push(c.occurred_at);
  }
  const unresolved = pending
    .filter((t) => !f.response_resolved_at || t > f.response_resolved_at)
    .sort();
  return {
    response: unresolved.length
      ? ("pending" as const)
      : unknown
        ? ("unknown" as const)
        : known || f.response_resolved_at
          ? ("answered" as const)
          : ("unknown" as const),
    pendingSince: unresolved.at(-1) ?? null,
  };
}
export function overdue(p: Pick<Applicant, "pendingSince" | "response">, now: number) {
  return p.response === "pending" && !!p.pendingSince && now - Date.parse(p.pendingSince) > 3 * DAY;
}
export function evaluatePriority(
  p: Pick<
    Applicant,
    "interactions" | "calls" | "saved" | "lastActivity" | "followup" | "pendingSince"
  >,
  now: number,
) {
  const evidence =
    p.interactions.some(
      (r) =>
        r.channel === "Formulario" ||
        r.messages.some((m) => m.direction === "user" || m.direction === "entrante"),
    ) || p.calls.length > 0;
  if (!evidence)
    return { priority: null, factors: ["Sin interacciones suficientes para evaluar."] };
  if (p.followup.stage === "ganado" || p.followup.stage === "perdido")
    return { priority: 0, factors: ["Proceso cerrado: 0 puntos."] };
  const age = p.lastActivity ? (now - Date.parse(p.lastActivity)) / DAY : Infinity;
  const recency = age <= 7 ? 20 : age <= 30 ? 10 : 0;
  const pending = p.pendingSince ? (now - Date.parse(p.pendingSince) > 3 * DAY ? 30 : 15) : 0;
  const interest =
    p.saved.length ||
    p.interactions.some(
      (r) => r.scholarshipIds?.length || r.plans.some((plan) => plan.plan.opportunities.length),
    )
      ? 20
      : 0;
  const plan = p.interactions.some((r) => r.plans.length) ? 20 : 0;
  const progress = ["preparando", "postulado", "seguimiento"].includes(p.followup.stage) ? 10 : 0;
  return {
    priority: recency + pending + interest + plan + progress,
    factors: [
      `Actividad reciente: ${recency}/20`,
      `Consulta pendiente: ${pending}/30`,
      `Becas de interés registradas: ${interest}/20`,
      `Plan registrado: ${plan}/20`,
      `Etapa confirmada: ${progress}/10`,
    ],
  };
}
export function groupApplicants(
  data: {
    profiles: { id: string; full_name: string; updated_at: string }[];
    interactions: InboxInteraction[];
    calls: Call[];
    followups: Followup[];
    links: { source_key: string; target_key: string }[];
    saved: { user_id: string; id: string; name: string; deadline: string }[];
  },
  now: number,
): Applicant[] {
  const linkMap = new Map(data.links.map((l) => [l.source_key, l.target_key]));
  const resolve = (key: string) => {
    const seen = new Set<string>();
    while (linkMap.has(key) && !seen.has(key)) {
      seen.add(key);
      key = linkMap.get(key) ?? key;
    }
    return key;
  };
  const map = new Map<string, Applicant>();
  const ensure = (key: string, name: string, userId: string | null) => {
    key = resolve(key);
    let p = map.get(key);
    if (!p) {
      p = {
        key,
        name,
        userId,
        channels: [],
        interactions: [],
        calls: [],
        saved: [],
        lastActivity: null,
        followup: data.followups.find((f) => f.person_key === key) ?? {
          person_key: key,
          stage: "nuevo",
          next_action: "",
          followup_at: null,
          assigned_to: null,
          objective: "",
          response_resolved_at: null,
        },
        priority: null,
        factors: [],
        pendingSince: null,
        response: "unknown",
        suggestion: "",
      };
      map.set(key, p);
    }
    if (userId) {
      p.userId = userId;
      p.name = name;
    }
    return p;
  };
  for (const profile of data.profiles) {
    const p = ensure(`user:${profile.id}`, profile.full_name, profile.id);
    p.channels.push("Registro web");
    p.lastActivity = profile.updated_at;
  }
  for (const r of data.interactions) {
    const p = ensure(r.userId ? `user:${r.userId}` : r.key, r.title, r.userId);
    p.interactions.push(r);
    p.channels.push(r.channel);
    if (!p.lastActivity || r.lastActivity > p.lastActivity) p.lastActivity = r.lastActivity;
  }
  for (const c of data.calls) {
    const p = ensure(
      c.user_id ? `user:${c.user_id}` : `call:${c.id}`,
      c.full_name || `Contacto ${c.id.slice(0, 8)}`,
      c.user_id,
    );
    p.calls.push(c);
    p.channels.push("Llamada");
    if (!p.lastActivity || c.occurred_at > p.lastActivity) p.lastActivity = c.occurred_at;
  }
  for (const p of map.values()) {
    p.channels = [...new Set(p.channels)];
    p.saved = data.saved.filter((s) => s.user_id === p.userId);
    Object.assign(p, responseState(p.interactions, p.calls, p.followup));
    Object.assign(p, evaluatePriority(p, now));
    p.suggestion = p.pendingSince
      ? "Dar seguimiento a la consulta pendiente"
      : p.saved.length
        ? "Revisar requisitos y próxima fecha límite"
        : p.interactions.length
          ? "Confirmar información y necesidades del postulante"
          : "Invitar a explorar becas";
  }
  return [...map.values()];
}
