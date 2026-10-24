import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, Trash2, ArrowLeft, ClipboardCopy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Reasoning, ReasoningTrigger, ReasoningContent } from "@/components/ai-elements/reasoning";
import {
  AGENT_STORAGE_KEY,
  agentProfileSchema,
  agentPlanOptionsSchema,
  profileLabels,
  type AgentProfile,
  type AgentPlan,
  type AgentPlanOptions,
} from "@/lib/postulation-agent";
import { generateAgentPlan, emailAgentPlan } from "@/lib/postulation-agent.functions";
import { startAgentConversation, restoreAgentConversation } from "@/lib/agent-history.functions";
import { PrivacyConsent } from "@/components/privacy-consent";
import { consentPayload, emptyConsent } from "@/lib/privacy";
import { supabase } from "@/integrations/supabase/client";

type SavedConversation = {
  messages: UIMessage[];
  plan: AgentPlan | null;
  conversationId: string;
  resumeToken: string;
};
const initialMessage: UIMessage = {
  id: "postulation-welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Soy tu orientador de BecaMatch. ¿Qué nivel de estudios tienes actualmente?",
    },
  ],
};

export function PostulationAgent({ onBack }: { onBack: () => void }) {
  const [consent, setConsent] = useState({ ...emptyConsent });
  const [ready, setReady] = useState(false);
  if (!ready) return <main className="mx-auto max-w-lg space-y-5 px-4 py-8"><Button variant="ghost" onClick={onBack}><ArrowLeft />Opciones</Button><h1 className="text-2xl font-semibold">Privacidad de la conversación</h1><PrivacyConsent value={consent} onChange={setConsent} id="agent" purpose="guardar y atender mi conversación, procesar mis respuestas con IA y preparar un plan; el correo se envía solo si lo solicito" /><Button disabled={!consent.legal} onClick={() => setReady(true)}>Continuar al agente</Button></main>;
  return <ConsentedAgent onBack={onBack} consent={consent} />;
}

function ConsentedAgent({ onBack, consent }: { onBack: () => void; consent: typeof emptyConsent }) {
  const [saved, setSaved] = useState<SavedConversation | null>(null);
  const [failure, setFailure] = useState("");
  const start = useServerFn(startAgentConversation);
  const restore = useServerFn(restoreAgentConversation);
  const boot = useRef<Promise<SavedConversation> | null>(null);
  useEffect(() => {
    if (!boot.current)
      boot.current = (async () => {
        const raw = localStorage.getItem(AGENT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.conversationId && parsed?.resumeToken) {
          const credential = {
            conversationId: parsed.conversationId as string,
            resumeToken: parsed.resumeToken as string,
          };
          const history = JSON.parse(await restore({ data: { ...credential, consent: consentPayload(consent) } })) as {
            messages: UIMessage[];
            plan: AgentPlan | null;
          };
          return {
            ...credential,
            messages: history.messages.length ? history.messages : [initialMessage],
            plan: history.plan,
          };
        }
        const { data: session } = await supabase.auth.getSession();
        const credential = await start({ data: { accessToken: session.session?.access_token, consent: consentPayload(consent) } });
        localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(credential));
        return { ...credential, messages: [initialMessage], plan: null };
      })();
    void boot.current
      .then(setSaved)
      .catch((error: unknown) =>
        setFailure(
          error instanceof Error ? error.message : "No se pudo recuperar la conversación.",
        ),
      );
  }, [start, restore, consent]);
  return saved ? (
    <AgentConversation
      key={saved.conversationId}
      initial={saved}
      onBack={onBack}
      onReset={() => {
        localStorage.removeItem(AGENT_STORAGE_KEY);
        onBack();
      }}
    />
  ) : (
    <p role={failure ? "alert" : undefined} className="p-8 text-muted-foreground">
      {failure || "Cargando conversación…"}
    </p>
  );
}

function ProfileSummary({ profile }: { profile: AgentProfile }) {
  return (
    <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      {Object.entries(profile).map(([key, value]) => (
        <div key={key}>
          <dt className="text-muted-foreground">{profileLabels[key as keyof AgentProfile]}</dt>
          <dd>
            {value === null || value === "" || (Array.isArray(value) && value.length === 0)
              ? "No indicado"
              : Array.isArray(value)
                ? value.map((v) => (typeof v === "string" ? v : `${v.code} ${v.level}`)).join(", ")
                : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function AgentConversation({
  initial,
  onBack,
  onReset,
}: {
  initial: SavedConversation;
  onBack: () => void;
  onReset: () => void;
}) {
  const [text, setText] = useState("");
  const [plan, setPlan] = useState<AgentPlan | null>(initial.plan);
  const [building, setBuilding] = useState(false);
  const [email, setEmail] = useState("");
  const [mailState, setMailState] = useState<"idle" | "sending" | "sent">("idle");
  const [problem, setProblem] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generate = useServerFn(generateAgentPlan);
  const sendEmail = useServerFn(emailAgentPlan);
  const { messages, sendMessage, status, stop } = useChat({
    id: initial.conversationId,
    messages: initial.messages,
    transport: new DefaultChatTransport({
      api: "/api/public/postulation-agent",
      body: { conversationId: initial.conversationId, resumeToken: initial.resumeToken },
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
      },
    }),
    onFinish: () => {
      textareaRef.current?.focus();
    },
    onError: (error) => {
      setProblem(error.message);
      textareaRef.current?.focus();
    },
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  let profile: AgentProfile | null = null;
  let planOptions: AgentPlanOptions = { mode: "real", scholarshipName: null };
  for (const message of messages)
    for (const part of message.parts) {
      if (message.role === "user") profile = null;
      if (
        isToolUIPart(part) &&
        part.type === "tool-prepare_profile" &&
        part.state === "output-available"
      ) {
        const output = part.output as { profile?: unknown; options?: unknown };
        const parsed = agentProfileSchema.safeParse(output.profile);
        if (parsed.success) profile = parsed.data;
        const options = agentPlanOptionsSchema.safeParse(output.options);
        if (options.success) planOptions = options.data;
      }
    }
  const confirm = async () => {
    if (!profile) return;
    setBuilding(true);
    setProblem("");
    try {
      setPlan(
        await generate({
          data: {
            profile,
            options: planOptions,
            confirmed: true,
            conversationId: initial.conversationId,
            resumeToken: initial.resumeToken,
          },
        }),
      );
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo preparar el plan.");
    } finally {
      setBuilding(false);
    }
  };
  const submitText = (value: string) => {
    if (!value.trim() || busy || building) return;
    setPlan(null);
    setMailState("idle");
    setProblem("");
    setText("");
    void sendMessage({ text: value.trim() });
    textareaRef.current?.focus();
  };
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft />
          Opciones
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Comenzar otra conversación"
          aria-label="Comenzar otra conversación"
          disabled={busy}
          onClick={() => {
            if (
              !window.confirm(
                "¿Comenzar otra conversación? El historial anterior se conservará para su atención.",
              )
            )
              return;
            onReset();
          }}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="mb-5 flex items-center gap-3">
        <GraduationCap className="size-8 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold">Tu plan con BecaMatch</h1>
          <p className="text-sm text-muted-foreground">
            Conversación guardada para su atención por BecaMatch.
          </p>
        </div>
      </div>
      <Conversation className="h-[480px] min-h-72">
        <ConversationContent>
          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={
                  message.role === "user"
                    ? "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                    : "bg-transparent"
                }
              >
                {message.parts.map((part, i) => {
                  if (part.type === "text")
                    return <MessageResponse key={i}>{part.text}</MessageResponse>;
                  if (part.type === "reasoning")
                    return (
                      <Reasoning
                        key={i}
                        defaultOpen={false}
                        isStreaming={part.state === "streaming"}
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    );
                  if (isToolUIPart(part) && part.type !== "dynamic-tool")
                    return (
                      <Tool key={i} defaultOpen={false}>
                        <ToolHeader type={part.type} state={part.state} title={part.type === "tool-lookup_scholarship" ? "Consultar beca" : "Preparar resumen"} />
                        <ToolContent>
                          <ToolInput input={part.input} />
                          {part.type === "tool-lookup_scholarship" && part.state === "output-available" && (
                            <ToolOutput output={part.output} errorText={undefined} />
                          )}
                          {part.state === "output-error" && (
                            <p className="text-destructive">{part.errorText}</p>
                          )}
                        </ToolContent>
                      </Tool>
                    );
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer>Preparando respuesta…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {problem && (
        <p role="alert" className="my-3 text-sm text-destructive">
          {problem}
        </p>
      )}
      <PromptInput onSubmit={({ text: value }) => submitText(value)} className="mt-4">
        <PromptInputTextarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe tu respuesta o una corrección…"
          aria-label="Mensaje al agente"
          maxLength={3000}
          disabled={building}
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit
            status={status}
            onStop={stop}
            disabled={!busy && (!text.trim() || building)}
            aria-label={busy ? "Detener respuesta" : "Enviar mensaje"}
            title={busy ? "Detener respuesta" : "Enviar mensaje"}
          />
        </PromptInputFooter>
      </PromptInput>
      {profile && !plan && !busy && (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="mb-3 text-xl font-semibold">Revisa tu perfil</h2>
          {planOptions.mode === "demo" && <p className="mb-3 font-semibold text-primary">Plan de demostración · {planOptions.scholarshipName}</p>}
          <ProfileSummary profile={profile} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={building} onClick={confirm}>
              {building ? "Preparando plan…" : planOptions.mode === "demo" ? "Confirmar y generar plan demo" : "Confirmar y generar plan"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setText("Quiero corregir ");
                textareaRef.current?.focus();
              }}
            >
              Corregir respuestas
            </Button>
          </div>
        </section>
      )}
      {plan && (
        <section
          className="mt-8 space-y-5 border-t border-border pt-6"
          aria-label="Plan personalizado"
        >
          <h2 className="text-xl font-semibold">Tu plan de postulación</h2>
          {plan.shareId && (
            <div className="flex flex-wrap items-center gap-3">
              <strong className="text-primary">{plan.planNumber}</strong>
              <Button asChild variant="outline">
                <a href={`/plan/${plan.shareId}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Consultar plan
                </a>
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${window.location.origin}/plan/${plan.shareId}`,
                    );
                  } catch {
                    setProblem("No se pudo copiar el enlace. Abre el plan para copiarlo.");
                  }
                }}
              >
                <ClipboardCopy />
                Copiar enlace
              </Button>
            </div>
          )}
          <ProfileSummary profile={plan.profile} />
          <p className="text-sm text-muted-foreground">{plan.notice}</p>
          {plan.opportunities.map((s) => (
            <article key={s.id} className="rounded-lg border border-border bg-card p-4 text-sm">
              <h3 className="font-semibold">
                {s.name} — {s.score}/100
              </h3>
              <p>
                {s.entity} · {s.country}
              </p>
              <p className="mt-2">{s.reasons}</p>
              <p>Fecha límite: {s.deadline}</p>
              <p>{s.pending}</p>
              <p className="mt-2">{s.requirements || (s.orientation.requirements.length ? "" : "Requisitos no registrados.")}</p>
              <ul className="list-disc pl-5">{s.orientation.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
              <p>{s.legacyDocuments || ""}</p>
              <ul>
                {s.orientation.documents.map((d, i) => (
                  <li key={i}>
                    {d.nombre} — {d.obligatorio ? "Obligatorio" : "Opcional"}
                  </li>
                ))}
              </ul>
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block break-all text-primary underline"
                >
                  {s.orientation.illustrative ? "Consultar enlace de ejemplo ↗" : "Consultar fuente oficial ↗"}
                </a>
              )}
            </article>
          ))}
          <div>
            <h3 className="font-semibold">Próximos pasos</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {plan.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <form
            className="space-y-2 border-t border-border pt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setMailState("sending");
              setProblem("");
              try {
                const result = await sendEmail({
                  data: {
                    shareId: plan.shareId ?? "",
                    conversationId: initial.conversationId,
                    resumeToken: initial.resumeToken,
                    email,
                    requested: true,
                  },
                });
                if (result.ok) setMailState("sent");
                else {
                  setProblem(result.error ?? "No se pudo enviar el correo.");
                  setMailState("idle");
                }
              } catch {
                setProblem("No se pudo enviar el correo.");
                setMailState("idle");
              }
            }}
          >
            <Label htmlFor="agent-email">Enviar este plan por correo</Label>
            <Input
              id="agent-email"
              type="email"
              required
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu correo electrónico"
            />
            <Button type="submit" disabled={mailState !== "idle" || !plan.shareId}>
              {mailState === "sent"
                ? "Correo aceptado por el servicio"
                : mailState === "sending"
                  ? "Enviando…"
                  : "Solicitar envío por correo"}
            </Button>
            <p className="text-xs text-muted-foreground">
              El remitente actual está en modo de prueba: solo entrega a destinatarios autorizados.
            </p>
          </form>
        </section>
      )}
    </main>
  );
}
