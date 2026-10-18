import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitPostulation } from "@/lib/postulation.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PostulationAgent } from "@/components/postulation-agent";
import { ClipboardList, MessagesSquare, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/postular")({
  head: () => ({
    meta: [
      { title: "Quiero postular — BecaMatch" },
      {
        name: "description",
        content:
          "Cuéntanos tu situación y recibe un plan de postulación con becas reales que encajan contigo.",
      },
      { property: "og:title", content: "Quiero postular — BecaMatch" },
      {
        property: "og:description",
        content: "Recibe un plan de postulación personalizado con becas reales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostularPage,
});

function PostularPage() {
  const [mode, setMode] = useState<"select" | "form" | "agent">("select");
  if (mode === "agent") return <PostulationAgent onBack={() => setMode("select")} />;
  if (mode === "form")
    return (
      <>
        <div className="mx-auto max-w-lg px-4 pt-6">
          <Button variant="ghost" onClick={() => setMode("select")}>
            <ArrowLeft />
            Opciones
          </Button>
        </div>
        <PostulationForm />
      </>
    );
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Quiero postular</h1>
      <p className="mt-2 text-muted-foreground">
        Encuentra becas que encajen contigo y prepara tu plan de postulación. Elige cómo quieres
        comenzar.
      </p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <article className="flex flex-col rounded-lg border border-border bg-card p-6">
          <ClipboardList className="mb-4 size-8 text-primary" />
          <h2 className="text-xl font-semibold">Prefiero completar el formulario</h2>
          <p className="mb-6 mt-3 flex-1 text-sm text-muted-foreground">
            Cuéntanos tu situación en un formulario sencillo y recibe tu plan de postulación.
          </p>
          <Button onClick={() => setMode("form")}>Completar formulario</Button>
        </article>
        <article className="flex flex-col rounded-lg border border-border bg-card p-6">
          <MessagesSquare className="mb-4 size-8 text-primary" />
          <h2 className="text-xl font-semibold">Quiero conversar con la IA</h2>
          <p className="mb-6 mt-3 flex-1 text-sm text-muted-foreground">
            Responde unas preguntas paso a paso y recibe recomendaciones personalizadas de becas.
          </p>
          <Button onClick={() => setMode("agent")}>Hablar con el agente</Button>
        </article>
      </div>
    </main>
  );
}

function PostulationForm() {
  const submit = useServerFn(submitPostulation);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [requestText, setRequestText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{
    shareId: string;
    planNumber: string;
    emailAccepted: boolean;
    emailError: string | null;
  } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setErrorMsg("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await submit({
        data: { fullName, email, requestText, accessToken: session.session?.access_token },
      });
      if (res.ok) {
        setResult(res);
        setState("done");
      } else {
        setState("error");
        setErrorMsg(res.error);
      }
    } catch {
      setState("error");
      setErrorMsg("Revisa los datos del formulario e inténtalo de nuevo.");
    }
  }

  if (state === "done")
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-bold">¡Gracias, {fullName.split(" ")[0]}!</h1>
        <p className="mt-3 text-muted-foreground">Tu plan {result?.planNumber} está guardado.</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {result?.emailAccepted
            ? "El servicio aceptó el correo con el enlace; la entrega aún no está confirmada."
            : result?.emailError}
        </p>
        {result && (
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/plan/$id" params={{ id: result.shareId }}>
                Consultar mi plan
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${window.location.origin}/plan/${result.shareId}`,
                  );
                } catch {
                  setErrorMsg("Abre el plan para copiar el enlace desde la barra de direcciones.");
                }
              }}
            >
              Copiar enlace
            </Button>
          </div>
        )}
        {errorMsg && (
          <p role="alert" className="mt-3 text-destructive">
            {errorMsg}
          </p>
        )}
        <Button asChild className="mt-6">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </main>
    );

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Quiero postular</h1>
      <p className="mt-2 text-muted-foreground">
        Cuéntanos tu situación y nuestra IA buscará las becas reales que mejor encajan contigo.
        Recibirás un plan de postulación por correo.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
            maxLength={120}
          />
        </div>
        <div>
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={200}
          />
        </div>
        <div>
          <Label htmlFor="requestText">Cuéntanos tu situación</Label>
          <Textarea
            id="requestText"
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            required
            minLength={20}
            maxLength={2000}
            rows={6}
            placeholder="Ejemplo: Estoy en último año de Ingeniería, mi promedio es 16/20, me interesan becas de maestría en Alemania o Canadá y tengo inglés B2."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Incluye tu nivel de estudios, área, promedio, países de interés e idiomas.
          </p>
        </div>
        {state === "error" && <p className="text-sm text-destructive">{errorMsg}</p>}
        <Button type="submit" className="w-full" disabled={state === "sending"}>
          {state === "sending" ? "Enviando…" : "Recibir mi plan de postulación"}
        </Button>
      </form>
    </main>
  );
}
