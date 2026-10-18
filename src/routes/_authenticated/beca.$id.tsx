import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sendTestNotice } from "@/lib/email.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { evaluate, explain, type UserLanguage } from "@/lib/compatibility";
import {
  clearDecision,
  daysLeft,
  decisionsQuery,
  fmtDate,
  profileQuery,
  scholarshipsQuery,
  setDecision,
  type Decision,
} from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/beca/$id")({
  head: () => ({
    meta: [
      { title: "Detalle de beca — BecaMatch" },
      { name: "description", content: "Requisitos, documentos, fecha límite y enlace oficial de la beca." },
      { property: "og:title", content: "Detalle de beca — BecaMatch" },
      { property: "og:description", content: "Requisitos, documentos y enlace oficial." },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const p = useQuery(profileQuery);
  const s = useQuery(scholarshipsQuery);
  const d = useQuery(decisionsQuery);

  if (p.isLoading || s.isLoading || d.isLoading) return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  const raw = s.data?.find((x) => x.id === id);
  if (!raw)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Beca no encontrada</h1>
        <Button asChild className="mt-6 rounded-full"><Link to="/mazo">Volver al mazo</Link></Button>
      </main>
    );
  const sch = { ...raw, min_gpa: raw.min_gpa === null ? null : Number(raw.min_gpa) };
  const r = p.data
    ? evaluate({ ...p.data, gpa: Number(p.data.gpa), languages: p.data.languages as unknown as UserLanguage[] }, sch)
    : null;
  const current = d.data?.find((x) => x.scholarship_id === id)?.decision;
  const days = daysLeft(sch.deadline);

  const act = async (fn: () => Promise<void>, msg: string) => {
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["decisions"] });
      toast.success(msg);
    } catch {
      toast.error("No se pudo actualizar. Intenta de nuevo.");
    }
  };
  const decide = (x: Decision) => act(() => setDecision(id, x), x === "guardada" ? "Guardada en Mis becas" : "Descartada");

  const Block = ({ title, text }: { title: string; text: string | null }) => (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{text || "No especificado en la fuente."}</p>
    </section>
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/mazo" className="text-sm text-muted-foreground hover:text-foreground">← Volver al mazo</Link>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {sch.es_demo && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent-foreground">Datos de demostración</span>}
        {current && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{current === "guardada" ? "Guardada" : "Descartada"}</span>}
      </div>
      <h1 className="mt-2 text-3xl font-bold leading-tight">{sch.name}</h1>
      <p className="text-muted-foreground">{sch.entity} · {sch.country}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 text-sm sm:grid-cols-4">
        <div><p className="text-muted-foreground">Compatibilidad</p><p className="text-xl font-bold">{r ? r.compatibility_score : "—"}/100</p></div>
        <div><p className="text-muted-foreground">Fecha límite</p><p className="font-semibold">{fmtDate(sch.deadline)}</p></div>
        <div><p className="text-muted-foreground">Días restantes</p><p className="font-semibold">{days > 0 ? days : "Expirada"}</p></div>
        <div><p className="text-muted-foreground">Nivel</p><p className="font-semibold">{sch.study_level ?? "Cualquiera"}</p></div>
      </div>
      {r && <p className="mt-2 text-xs text-muted-foreground">{r.ineligibleReason ?? explain(r.components)}</p>}

      <Block title="Requisitos" text={sch.requirements} />
      <Block title="Documentos requeridos" text={sch.documents} />
      {sch.coverage && <Block title="Cobertura" text={sch.coverage} />}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Enlace oficial</h2>
        {sch.official_url ? (
          <a href={sch.official_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-sm font-medium text-primary underline">
            {sch.official_url}
          </a>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No disponible.</p>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        {current === "guardada" ? (
          <Button variant="outline" onClick={() => act(() => clearDecision(id), "Quitada de guardadas")}>Quitar de guardadas</Button>
        ) : current === "descartada" ? (
          <Button onClick={() => act(() => clearDecision(id), "Recuperada: vuelve a tu mazo")}>Recuperar</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => decide("descartada")}>Descartar</Button>
            <Button onClick={() => decide("guardada")}>Guardar</Button>
          </>
        )}
      </div>

      {current === "guardada" && <NoticeButton id={id} />}

      <section className="mt-8 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold">Asistente de orientación</h2>
        <p className="text-sm text-muted-foreground">
          Pregunta sobre requisitos, elegibilidad, cobertura, fechas y documentos de esta beca. El asistente responde con los datos reales registrados.
        </p>
        <Button asChild className="mt-3">
          <Link to="/asistente" search={{ beca: id }}>Consultar al asistente</Link>
        </Button>
      </section>
    </main>
  );
}

function NoticeButton({ id }: { id: string }) {
  const send = useServerFn(sendTestNotice);
  const [state, setState] = useState<{ kind: "idle" | "sending" | "ok" | "error"; msg?: string }>({ kind: "idle" });
  const go = async () => {
    setState({ kind: "sending" });
    try {
      const r = await send({ data: { scholarshipId: id, appUrl: window.location.origin } });
      if (r.ok) { setState({ kind: "ok", msg: `Aviso enviado a ${r.to}` }); toast.success("Aviso enviado"); }
      else { setState({ kind: "error", msg: r.error }); toast.error("No se pudo enviar"); }
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Error inesperado" });
    }
  };
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Aviso por correo</h2>
      <p className="text-sm text-muted-foreground">Envía un correo de prueba a tu email con el nombre, la fecha límite y el enlace.</p>
      <Button className="mt-3" onClick={go} disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Enviando…" : "Enviar aviso de prueba"}
      </Button>
      {state.kind === "ok" && <p className="mt-2 text-sm font-medium text-primary">✓ {state.msg}</p>}
      {state.kind === "error" && <p className="mt-2 text-sm font-medium text-destructive">✗ {state.msg}</p>}
    </section>
  );
}

function Assistant({ sch }: { sch: Parameters<typeof answer>[0] }) {
  const [q, setQ] = useState("");
  const [log, setLog] = useState<{ q: string; a: string; known: boolean }[]>([]);
  const ask = (text: string) => {
    if (!text.trim()) return;
    const r = answer(sch, text);
    setLog((l) => [...l, { q: text, a: r.text, known: r.known }]);
    setQ("");
  };
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Asistente de la beca</h2>
      <p className="text-sm text-muted-foreground">Responde solo con datos registrados de esta beca.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_QUESTIONS.map((x) => (
          <button key={x} onClick={() => ask(x)} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{x}</button>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder="Escribe tu pregunta…"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <Button type="submit" size="sm">Preguntar</Button>
      </form>
      <ul className="mt-3 space-y-2">
        {log.map((m, i) => (
          <li key={i} className="text-sm">
            <p className="font-medium">Tú: {m.q}</p>
            <p className={m.known ? "text-foreground" : "text-muted-foreground italic"}>Asistente: {m.a}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
