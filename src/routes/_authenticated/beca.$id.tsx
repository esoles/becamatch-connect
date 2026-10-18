import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sendTestNotice } from "@/lib/email.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScholarshipOrientation } from "@/components/scholarship-orientation";
import { evaluate, WEIGHTS, type Criterion, type UserLanguage } from "@/lib/compatibility";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Detail,
});

const CRITERION_LABEL: Record<Criterion, string> = {
  level: "Nivel de estudio",
  area: "Área",
  language: "Idioma",
  gpa: "Promedio",
  country: "País",
};

function criterionState(v: number): { text: string; className: string } {
  if (v === 100) return { text: "Coincide", className: "text-primary" };
  if (v > 0) return { text: `Parcial (${v}/100)`, className: "text-foreground" };
  return { text: "No coincide", className: "text-muted-foreground" };
}

function Detail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const p = useQuery(profileQuery);
  const s = useQuery(scholarshipsQuery);
  const d = useQuery(decisionsQuery);

  if (p.isLoading || s.isLoading || d.isLoading) return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  const raw = s.data?.find((x) => x.id === id);
  const today = new Date().toISOString().slice(0, 10);
  const unavailable = raw && (!raw.verified || raw.archived || raw.deadline <= today);
  if (!raw || unavailable)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{!raw ? "Beca no encontrada" : "Beca no disponible"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {!raw
            ? "No existe una beca con este identificador."
            : "Esta beca no está verificada o su fecha límite ya pasó, por eso no se muestra."}
        </p>
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
        {sch.verified && (sch.es_demo || sch.estado_datos === "propuesta_ficticia_no_verificada") && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">Verificada para pruebas</span>}
        {current && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{current === "guardada" ? "Guardada" : "Descartada"}</span>}
      </div>
      <h1 className="mt-2 text-3xl font-bold leading-tight">{sch.name}</h1>
      <p className="text-muted-foreground">{sch.entity} · {sch.country}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
        <div><p className="text-muted-foreground">País</p><p className="font-semibold">{sch.country}</p></div>
        <div><p className="text-muted-foreground">Nivel académico</p><p className="font-semibold">{sch.study_level ?? "Cualquiera"}</p></div>
        <div><p className="text-muted-foreground">Área de estudio</p><p className="font-semibold">{sch.area ?? "Todas"}</p></div>
        <div><p className="text-muted-foreground">Idioma requerido</p><p className="font-semibold">{sch.language_code ? `${sch.language_code}${sch.language_level ? " " + sch.language_level : ""}` : "No especificado"}</p></div>
        <div><p className="text-muted-foreground">Promedio mínimo</p><p className="font-semibold">{sch.min_gpa != null ? `${sch.min_gpa} / 20` : "No especificado"}</p></div>
        <div><p className="text-muted-foreground">Fecha límite</p><p className="font-semibold">{fmtDate(sch.deadline)} · {days > 0 ? `${days} días` : "Expirada"}</p></div>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Tu compatibilidad</h2>
          <p className="text-2xl font-bold">{r ? r.compatibility_score : "—"}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
        </div>
        {r?.ineligibleReason && <p className="mt-1 text-sm font-medium text-destructive">{r.ineligibleReason}</p>}
        {r && Object.keys(r.components).length > 0 ? (
          <ul className="mt-3 divide-y divide-border text-sm">
            {(Object.keys(r.components) as Criterion[]).map((k) => {
              const v = r.components[k] ?? 0;
              const st = criterionState(v);
              return (
                <li key={k} className="flex items-center justify-between py-2">
                  <span>{CRITERION_LABEL[k]} <span className="text-xs text-muted-foreground">(peso {WEIGHTS[k]})</span></span>
                  <span className={`font-medium ${st.className}`}>{st.text}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Completa tu perfil para ver el desglose.</p>
        )}
      </section>

      <Block title="Cobertura y beneficios" text={sch.coverage} />
      <Block title="Requisitos de elegibilidad" text={sch.requirements} />
      <Block title="Documentos solicitados por la fuente oficial" text={sch.documents} />
      <ScholarshipOrientation scholarship={sch} />

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Enlace oficial</h2>
        {sch.official_url ? (
          <>
            <a href={sch.official_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block break-all text-sm font-medium text-primary underline">
              {sch.official_url}
            </a>
            <div className="mt-3">
              <Button asChild variant="outline">
                <a href={sch.official_url} target="_blank" rel="noopener noreferrer">Ir a la convocatoria oficial ↗</a>
              </Button>
            </div>
          </>
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
        <Button asChild variant="secondary">
          <Link to="/asistente" search={{ beca: id }}>Consultar al asistente</Link>
        </Button>
      </div>

      {current === "guardada" && <NoticeButton id={id} />}
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
