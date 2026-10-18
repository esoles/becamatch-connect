import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { askAssistant } from "@/lib/assistant.functions";
import { scholarshipsQuery } from "@/lib/profile";
import { Button } from "@/components/ui/button";
import { QUICK_QUESTIONS } from "@/lib/assistant";
import { orientationData } from "@/lib/scholarship-orientation";

type Msg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/_authenticated/asistente")({
  validateSearch: (s: Record<string, unknown>) => ({
    beca: typeof s["beca"] === "string" ? (s["beca"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Asistente — BecaMatch" },
      { name: "description", content: "Pregunta al asistente sobre requisitos, cobertura, fechas y documentos de tu beca." },
      { property: "og:title", content: "Asistente — BecaMatch" },
      { property: "og:description", content: "Orientación sobre tu beca con datos reales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { beca } = Route.useSearch();
  const navigate = useNavigate();
  const s = useQuery(scholarshipsQuery);
  const ask = useServerFn(askAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sch = s.data?.find((x) => x.id === beca) ?? null;

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [beca]);

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
      const r = await ask({ data: { scholarshipId: sch?.id ?? null, messages: next } });
      if (r.ok) setMessages([...next, { role: "assistant", content: r.reply }]);
      else setError(r.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col px-4 py-8">
      <h1 className="text-2xl font-bold">Asistente de orientación</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {sch ? orientationData(sch).warning : "Orientación sobre becas registradas en BecaMatch."}
      </p>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        {s.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando becas…</p>
        ) : sch ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Beca en contexto</p>
              <p className="font-semibold">{sch.name}</p>
              <p className="text-sm text-muted-foreground">{sch.entity} · {sch.country}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/asistente", search: { beca: undefined } })}>
              Quitar contexto
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground">
              Sin beca seleccionada. Elige una desde tu mazo o suscríbete a una conversación general.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to="/mazo">Ir al mazo</Link>
            </Button>
          </div>
        )}
      </section>

      {sch && (
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_QUESTIONS.map((x) => (
            <Button variant="secondary" size="sm"
              key={x}
              onClick={() => send(x)}
              disabled={busy}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-medium disabled:opacity-50"
            >
              {x}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-4 flex-1 space-y-3">
        {messages.length === 0 && !busy && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {sch
              ? `Pregúntame sobre requisitos, elegibilidad, cobertura, fechas o documentos de “${sch.name}”.`
              : "Selecciona una beca para que pueda responderte con datos reales."}
          </p>
        )}
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
        {busy && <p className="text-sm text-muted-foreground italic">El asistente está escribiendo…</p>}
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
          maxLength={1000}
          placeholder={sch ? "Escribe tu pregunta…" : "Selecciona una beca primero…"}
          disabled={!sch || busy}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
        />
        <Button type="submit" disabled={!sch || busy || !input.trim()}>
          Enviar
        </Button>
      </form>
    </main>
  );
}
