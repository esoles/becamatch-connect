import type { UIMessage } from "ai";
import type { AgentPlan } from "./postulation-agent";

export type InteractionChannel = "Formulario" | "Agente web" | "WhatsApp";
export type InboxInteraction = {
  key: string; id: string; channel: InteractionChannel; title: string; userId: string | null;
  lastActivity: string; preview: string; status: string; email?: string; phone?: string;
  requestText?: string; processStatus?: string; analysis?: unknown; scholarshipIds?: string[];
  messages: { id: string; date: string; direction: string; body?: string; message?: UIMessage; action?: string | null; result?: string | null }[];
  plans: { date: string; plan: AgentPlan }[];
};
export function sortInteractions(rows: InboxInteraction[]) {
  return [...rows].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity) || a.key.localeCompare(b.key));
}
export function filterInteractions(rows: InboxInteraction[], channel: InteractionChannel | "Todas", query = "") {
  const text = query.trim().toLocaleLowerCase();
  return sortInteractions(rows.filter((r) => (channel === "Todas" || r.channel === channel) && (!text || `${r.title} ${r.id} ${r.email ?? ""} ${r.phone ?? ""} ${r.preview}`.toLocaleLowerCase().includes(text))));
}
export function relatedInteractions(rows: InboxInteraction[], selected: InboxInteraction) {
  if (!selected.userId) return [];
  return rows.filter((r) => r.key !== selected.key && r.userId === selected.userId);
}
export function messagePreview(message?: UIMessage) {
  return message?.parts.filter((p) => p.type === "text").map((p) => p.text).join(" ").slice(0, 160) ?? "";
}
export const attentionLabels: Record<string, string> = { recibida: "Recibida", en_atencion: "En atención", atendida: "Atendida" };