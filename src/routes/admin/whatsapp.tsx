import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isToolUIPart } from "ai";
import { ClipboardList, MessageCircle, MessagesSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { listInteractions, updateInteractionAttention } from "@/lib/interaction-inbox.functions";
import {
  attentionLabels,
  filterInteractions,
  relatedInteractions,
  type InboxInteraction,
  type InteractionChannel,
} from "@/lib/interaction-inbox";

const inboxQuery = queryOptions({
  queryKey: ["admin", "interaction-inbox"],
  queryFn: async () => JSON.parse(await listInteractions()) as InboxInteraction[],
});
const date = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  });
const icons = { Formulario: ClipboardList, "Agente web": MessagesSquare, WhatsApp: MessageCircle };
export const Route = createFileRoute("/admin/whatsapp")({
  validateSearch: (s: Record<string, unknown>): { interaction?: string | undefined } => ({
    interaction: typeof s["interaction"] === "string" ? s["interaction"] : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(inboxQuery),
  head: () => ({
    meta: [
      { title: "Bandeja de interacciones — BecaMatch" },
      {
        name: "description",
        content:
          "Solicitudes del formulario, conversaciones del agente web e historial de WhatsApp de BecaMatch.",
      },
      { property: "og:title", content: "Bandeja de interacciones — BecaMatch" },
      {
        property: "og:description",
        content: "Seguimiento privado de formularios, agente web y WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InteractionInbox,
});
function InteractionInbox() {
  const { data: rows } = useSuspenseQuery(inboxQuery);
  const { interaction } = Route.useSearch();
  const navigate = Route.useNavigate();
  const client = useQueryClient();
  const update = useServerFn(updateInteractionAttention);
  const [channel, setChannel] = useState<InteractionChannel | "Todas">("Todas");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const visible = filterInteractions(rows, channel, query);
  const selected = visible.find((r) => r.key === interaction) ?? visible[0];
  const select = (row: InboxInteraction) => {
    setChannel("Todas");
    setQuery("");
    void navigate({ search: { interaction: row.key }, replace: true });
  };
  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Bandeja de interacciones</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} interacciones registradas
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          title="Actualizar bandeja"
          aria-label="Actualizar bandeja"
          onClick={() => void client.invalidateQueries({ queryKey: inboxQuery.queryKey })}
        >
          <RefreshCw />
        </Button>
      </div>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Filtrar por canal">
        {(["Todas", "Formulario", "Agente web", "WhatsApp"] as const).map((value) => (
          <Button
            key={value}
            variant={channel === value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setChannel(value);
              void navigate({ search: {}, replace: true });
            }}
          >
            {value === "Formulario" ? "Formularios" : value}
          </Button>
        ))}
      </div>
      <div className="grid min-w-0 border-y border-border md:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside
          className="min-w-0 border-b border-border md:border-b-0 md:border-r"
          aria-label="Lista de interacciones"
        >
          <div className="p-3">
            <Input
              aria-label="Buscar interacción"
              placeholder="Buscar nombre o identificador…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-72 overflow-y-auto md:max-h-[680px]">
            {visible.map((r) => {
              const Icon = icons[r.channel];
              return (
                <Button
                  key={r.key}
                  variant="ghost"
                  aria-pressed={selected?.key === r.key}
                  className={`h-auto w-full justify-start whitespace-normal rounded-none border-t border-border px-4 py-4 text-left ${selected?.key === r.key ? "bg-secondary" : ""}`}
                  onClick={() => void navigate({ search: { interaction: r.key }, replace: true })}
                >
                  <div className="w-full min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 shrink-0 text-primary" />
                      <span className="truncate font-semibold">{r.title}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{r.channel}</span>
                      <span>{date(r.lastActivity)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 break-words text-xs font-normal text-muted-foreground">
                      {r.preview}
                    </p>
                  </div>
                </Button>
              );
            })}
            {!visible.length && (
              <p className="p-5 text-sm text-muted-foreground">
                No hay interacciones en este filtro.
              </p>
            )}
          </div>
        </aside>
        <div className="min-w-0 p-4 sm:p-6">
          {selected ? (
            <>
              <div className="mb-5 border-b border-border pb-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="break-words text-xl font-semibold">{selected.title}</h3>
                  <Badge variant="secondary">{selected.channel}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Última actividad: {date(selected.lastActivity)} · {selected.id}
                </p>
                {selected.email && <p className="mt-2 break-all text-sm">{selected.email}</p>}
                {selected.phone && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      Número de contacto
                    </summary>
                    <p>{selected.phone}</p>
                  </details>
                )}
                {selected.channel !== "WhatsApp" && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <label htmlFor="attention-status" className="text-sm">
                      Estado de atención
                    </label>
                    <select
                      id="attention-status"
                      value={selected.status}
                      disabled={saving}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      onChange={async (e) => {
                        const status = e.target.value as "recibida" | "en_atencion" | "atendida";
                        setSaving(true);
                        setError("");
                        try {
                          await update({
                            data: {
                              id: selected.id,
                              channel: selected.channel as "Formulario" | "Agente web",
                              status,
                            },
                          });
                          await client.invalidateQueries({ queryKey: inboxQuery.queryKey });
                        } catch (problem) {
                          setError(
                            problem instanceof Error
                              ? problem.message
                              : "No se pudo guardar el estado.",
                          );
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      {Object.entries(attentionLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {error && (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
              {selected.channel === "Formulario" ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="font-semibold">Situación del postulante</h4>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {selected.requestText}
                    </p>
                  </div>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Resultado del procesamiento: </span>
                    {selected.processStatus}
                  </p>
                  <p className="text-sm">
                    Becas recomendadas: {selected.scholarshipIds?.length ?? 0}
                  </p>
                  {selected.analysis != null && (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">
                        Análisis registrado
                      </summary>
                      <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words text-xs">
                        {JSON.stringify(selected.analysis, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                <>
                  {selected.channel === "WhatsApp" && (
                    <p className="mb-4 text-xs text-muted-foreground">
                      Historial registrado. Las respuestas salientes no tienen confirmación de
                      entrega de WhatsApp.
                    </p>
                  )}
                  <Conversation key={selected.key} className="h-[480px]">
                    <ConversationContent>
                      {selected.messages.map((m) => {
                        const from =
                          m.direction === "user" || m.direction === "entrante"
                            ? "user"
                            : "assistant";
                        return (
                          <Message key={m.id} from={from}>
                            <p className="mb-1 text-xs text-muted-foreground">
                              {m.direction === "sistema"
                                ? "Sistema"
                                : from === "user"
                                  ? "Usuario"
                                  : "Agente"}{" "}
                              · {date(m.date)}
                            </p>
                            <MessageContent
                              className={
                                from === "user"
                                  ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                                  : "bg-transparent"
                              }
                            >
                              {m.message ? (
                                m.message.parts.map((p, i) =>
                                  p.type === "text" ? (
                                    <MessageResponse key={i}>{p.text}</MessageResponse>
                                  ) : isToolUIPart(p) && p.type !== "dynamic-tool" ? (
                                    <Tool key={i} defaultOpen={false}>
                                      <ToolHeader
                                        type={p.type}
                                        state={p.state}
                                        title="Resumen de perfil"
                                      />
                                      <ToolContent>
                                        <ToolInput input={p.input} />
                                        <ToolOutput output={p.output} errorText={p.errorText} />
                                      </ToolContent>
                                    </Tool>
                                  ) : null,
                                )
                              ) : (
                                <MessageResponse>{m.body ?? ""}</MessageResponse>
                              )}
                            </MessageContent>
                            {m.action && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {m.action} · {m.result ?? "Sin resultado registrado"}
                              </p>
                            )}
                          </Message>
                        );
                      })}
                    </ConversationContent>
                    <ConversationScrollButton />
                  </Conversation>
                  {selected.plans.map(({ plan, date: created }, i) => (
                    <section key={`${created}-${i}`} className="mt-6 border-t border-border pt-5">
                      <h4 className="font-semibold">Plan de postulación · {date(created)}</h4>
                      {plan.shareId && plan.planNumber && <Button asChild variant="outline" className="mt-3"><a href={`/plan/${plan.shareId}`} target="_blank" rel="noopener noreferrer">Consultar {plan.planNumber}</a></Button>}
                      <p className="mt-2 text-sm text-muted-foreground">{plan.notice}</p>
                      {plan.opportunities.map((o) => (
                        <div key={o.id} className="mt-4 text-sm">
                          <h5 className="font-semibold">
                            {o.name} · {o.score === null ? "Sin calcular" : `${o.score}/100`}
                          </h5>
                          <p>
                            {o.entity} · {o.country} · {o.deadline}
                          </p>
                          <p>{o.reasons}</p>
                          <p>{o.requirements || "Requisitos no registrados."}</p>
                          <p>{o.legacyDocuments}</p>
                          {o.orientation.documents.map((d, j) => (
                            <p key={j}>
                              {d.nombre} · {d.obligatorio ? "Obligatorio" : "Opcional"}
                            </p>
                          ))}
                          {o.url && (
                            <a
                              className="break-all text-primary underline"
                              href={o.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Fuente oficial ↗
                            </a>
                          )}
                        </div>
                      ))}
                      <ol className="mt-4 list-decimal pl-5 text-sm">
                        {plan.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </>
              )}
              {relatedInteractions(rows, selected).length > 0 && (
                <section className="mt-6 border-t border-border pt-5">
                  <h4 className="mb-3 font-semibold">Registros relacionados</h4>
                  <div className="flex flex-wrap gap-2">
                    {relatedInteractions(rows, selected).map((r) => (
                      <Button key={r.key} variant="outline" size="sm" onClick={() => select(r)}>
                        {r.channel} · {date(r.lastActivity)}
                      </Button>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <p className="py-12 text-center text-muted-foreground">
              No hay interacciones para mostrar.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
