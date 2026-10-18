import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Bookmark, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildDeck,
  explain,
  MIN_DECK,
  splitPriority,
  type CompatResult,
  type UserLanguage,
} from "@/lib/compatibility";
import {
  decisionsQuery,
  fmtDate,
  PARENTAL_LABEL,
  profileQuery,
  scholarshipsQuery,
  setDecision,
  type Decision,
} from "@/lib/profile";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/mazo")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Mi mazo de becas — BecaMatch" },
      { name: "description", content: "Becas verificadas y vigentes ordenadas por compatibilidad con tu perfil." },
      { property: "og:title", content: "Mi mazo de becas — BecaMatch" },
      { property: "og:description", content: "Becas ordenadas por compatibilidad." },
    ],
  }),
  component: MazoPage,
});

export type S = Tables<"scholarships"> & { min_gpa: number | null };

function MazoPage() {
  const qc = useQueryClient();
  const p = useQuery(profileQuery);
  const s = useQuery(scholarshipsQuery);
  const d = useQuery(decisionsQuery);
  const [pending, setPending] = useState<string | null>(null);

  if (p.isLoading || s.isLoading || d.isLoading)
    return <p className="p-8 text-center text-muted-foreground">Calculando compatibilidad…</p>;
  if (p.error || s.error || d.error)
    return <p className="p-8 text-center text-destructive">No pudimos cargar las becas. Recarga la página.</p>;
  if (!p.data)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Primero, tu perfil</h1>
        <p className="mt-2 text-muted-foreground">Necesitamos tus datos para calcular tu compatibilidad.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/perfil">Completar perfil</Link></Button>
      </main>
    );

  const profile = p.data;
  const decided = new Set((d.data ?? []).map((x) => x.scholarship_id));
  const today = new Date().toISOString().slice(0, 10);
  const list = (s.data ?? [])
    .filter((x) => !decided.has(x.id))
    .map((x) => ({ ...x, min_gpa: x.min_gpa === null ? null : Number(x.min_gpa) })) as S[];
  const { eligible, ineligible } = buildDeck(
    { ...profile, gpa: Number(profile.gpa), languages: profile.languages as unknown as UserLanguage[] },
    list,
    today,
  );
  const { priority, others } = splitPriority(eligible);

  const decide = async (id: string, decision: Decision) => {
    setPending(id);
    try {
      await setDecision(id, decision);
      await qc.invalidateQueries({ queryKey: ["decisions"] });
      toast.success(decision === "guardada" ? "Guardada en Mis becas" : "Descartada. Puedes recuperarla en Mis becas.");
    } catch {
      toast.error("No se pudo guardar tu decisión. Intenta de nuevo.");
    } finally {
      setPending(null);
    }
  };

  const grid = (rs: CompatResult<S>[]) => (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rs.map((r) => (
        <Card key={r.scholarship.id} r={r} busy={pending === r.scholarship.id} onDecide={decide} />
      ))}
    </div>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Hola, {profile.full_name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Desliza a la derecha para guardar, a la izquierda para descartar — o usa los botones.
          </p>
        </div>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent-foreground">Datos de demostración</span>
      </div>

      {profile.parental_status !== "no_requerida" && (
        <div className="mt-4 rounded-xl border border-warning bg-warning/20 p-4 text-sm text-warning-foreground">
          Autorización parental: <strong>{PARENTAL_LABEL[profile.parental_status]}</strong>. Mientras esté pendiente, las funciones de cuenta completa quedan bloqueadas. Flujo demostrativo.
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Alta compatibilidad (50 o más)</h2>
        {priority.length < MIN_DECK && (
          <p className="mt-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            {priority.length === 0
              ? "Ahora mismo no hay becas pendientes con compatibilidad de 50 o más."
              : `Solo hay ${priority.length} ${priority.length === 1 ? "beca pendiente" : "becas pendientes"} con compatibilidad de 50 o más; te mostramos las que existen.`}
            {others.length > 0 && " Más abajo verás otras becas para las que cumples requisitos, con menor compatibilidad."}
          </p>
        )}
        {grid(priority)}
      </section>

      {others.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Menor compatibilidad</h2>
          {grid(others)}
        </section>
      )}

      {eligible.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ya revisaste todo tu mazo. <Link to="/mis-becas" className="font-medium text-primary underline">Ver Mis becas</Link>
        </p>
      )}

      {ineligible.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">No cumples un requisito</h2>
          <div className="opacity-70">{grid(ineligible)}</div>
        </section>
      )}
    </main>
  );
}

function Card({
  r,
  busy,
  onDecide,
}: {
  r: CompatResult<S>;
  busy: boolean;
  onDecide: (id: string, d: Decision) => void;
}) {
  const s = r.scholarship;
  const high = r.compatibility_score >= 50;
  const start = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const THRESHOLD = 100;

  return (
    <article
      className="flex touch-pan-y flex-col rounded-2xl border border-border bg-card p-5 shadow-card transition-transform"
      style={{ transform: dx ? `translateX(${dx}px) rotate(${dx / 25}deg)` : undefined }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        start.current = e.clientX;
      }}
      onPointerMove={(e) => start.current !== null && setDx(e.clientX - start.current)}
      onPointerUp={() => {
        if (start.current === null) return;
        start.current = null;
        if (dx > THRESHOLD) onDecide(s.id, "guardada");
        else if (dx < -THRESHOLD) onDecide(s.id, "descartada");
        setDx(0);
      }}
      onPointerCancel={() => { start.current = null; setDx(0); }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {s.es_demo && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">Demo</span>}
          {s.verified && <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">Verificada</span>}
        </div>
        <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full ${high ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
          <span className="font-display text-lg font-bold leading-none">{r.compatibility_score}</span>
          <span className="text-[9px]">/100</span>
        </div>
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-tight">
        <Link to="/beca/$id" params={{ id: s.id }} className="hover:underline">{s.name}</Link>
      </h3>
      <p className="text-sm text-muted-foreground">{s.entity}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">País</dt><dd>{s.country}</dd>
        <dt className="text-muted-foreground">Nivel</dt><dd>{s.study_level ?? "Cualquiera"}</dd>
        <dt className="text-muted-foreground">Área</dt><dd>{s.area ?? "Cualquiera"}</dd>
        <dt className="text-muted-foreground">Cierre</dt><dd>{fmtDate(s.deadline)}</dd>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{r.ineligibleReason ?? explain(r.components)}</p>
      <div className="mt-auto grid grid-cols-3 gap-2 pt-4">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onDecide(s.id, "descartada")} aria-label={`Descartar ${s.name}`}>
          <X className="h-4 w-4" /> Descartar
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/beca/$id" params={{ id: s.id }}>Detalle</Link>
        </Button>
        <Button size="sm" disabled={busy} onClick={() => onDecide(s.id, "guardada")} aria-label={`Guardar ${s.name}`}>
          <Bookmark className="h-4 w-4" /> Guardar
        </Button>
      </div>
    </article>
  );
}
