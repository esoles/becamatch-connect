import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAdminAssistant } from "@/lib/admin-assistant.functions";
import { Button } from "@/components/ui/button";
import { BotMessageSquare } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "Dame el resumen de BecaMatch",
  "¿Qué becas necesitan verificación?",
  "¿Qué oportunidades vencen pronto?",
  "Resume las solicitudes pendientes",
  "Revisa la calidad de los datos de las becas",
  "¿Qué tareas administrativas recomiendas?",
] as const;

export const Route = createFileRoute("/admin/asistente")({
  head: () => ({
    meta: [
      { title: "Asistente IA — BecaMatch Admin" },
      { name: "description", content: "Copiloto administrativo de BecaMatch con datos reales." },
      { property: "og:title", content: "Asistente IA — BecaMatch Admin" },
      { property: "og:description", content: "Consulta y prioriza tareas administrativas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminAssistantPage,
});

function AdminAssistantPage() {
  const ask = useServerFn(askAdminAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [busy]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const r = await ask({ data: { messages: next } });
      if (r.ok) setMessages([...next, { role: "assistant", content: r.reply }]);
      else setError(r.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="flex items-center gap-3">
        <BotMessageSquare className="size-6 text-accent" />
        <div>
          <h2 className="text-xl font-semibold">Asistente IA administrativo</h2>
          <p className="text-sm text-muted-foreground">
            Consulta datos reales de la plataforma y prioriza tareas. Modo consulta: las acciones de
            escritura se ejecutan desde las secciones del panel.
          </p>
        </div>
      </div>

      {messages.length === 0 && !busy && (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-medium">¿En qué te ayudo hoy?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Puedo resumir becas, detectar verificaciones pendientes, vencimientos próximos y
            solicitudes sin atender, siempre con los datos registrados.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((q) => (
              <Button
                key={q}
                variant="secondary"
                size="sm"
                className="rounded-full text-xs"
                onClick={() => send(q)}
                disabled={busy}
              >
                {q}
              </Button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-4 flex-1 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                  : "max-w-[85%] rounded-2xl border border-border bg-card px-4 py-2 text-sm"
              }
            >
              <p className="whitespace-pre-line">{m.content}</p>
            </div>
          </div>
        ))}
        {busy && <p className="text-sm italic text-muted-foreground">El asistente está analizando…</p>}
        {error && <p className="text-sm font-medium text-destructive">✗ {error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        className="sticky bottom-4 mt-4 flex gap-2 rounded-2xl border border-border bg-card p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={2000}
          placeholder="Escribe tu consulta administrativa…"
          disabled={busy}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
