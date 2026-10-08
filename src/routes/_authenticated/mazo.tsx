import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { buildDeck, explain, type CompatResult, type UserLanguage } from "@/lib/compatibility";
import { PARENTAL_LABEL, profileQuery, scholarshipsQuery } from "@/lib/profile";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/mazo")({
  head: () => ({
    meta: [
      { title: "Mi mazo de becas — BecaMatch" },
      { name: "description", content: "Becas verificadas y vigentes ordenadas por compatibilidad con tu perfil." },
      { property: "og:title", content: "Mi mazo de becas — BecaMatch" },
      { property: "og:description", content: "Becas ordenadas por compatibilidad." },
    ],
  }),
  component: MazoPage,
});

type S = Tables<"scholarships"> & { min_gpa: number | null };

function MazoPage() {
  const p = useQuery(profileQuery);
  const s = useQuery(scholarshipsQuery);

  if (p.isLoading || s.isLoading) return <p className="p-8 text-center text-muted-foreground">Calculando compatibilidad…</p>;
  if (p.error || s.error) return <p className="p-8 text-center text-destructive">No pudimos cargar las becas. Recarga la página.</p>;
  if (!p.data)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Primero, tu perfil</h1>
        <p className="mt-2 text-muted-foreground">Necesitamos tus datos para calcular tu compatibilidad.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/perfil">Completar perfil</Link></Button>
      </main>
    );

  const profile = p.data;
  const today = new Date().toISOString().slice(0, 10);
  const list = (s.data ?? []).map((x) => ({ ...x, min_gpa: x.min_gpa === null ? null : Number(x.min_gpa) })) as S[];
  const { eligible, ineligible } = buildDeck(
    { ...profile, gpa: Number(profile.gpa), languages: profile.languages as unknown as UserLanguage[] },
    list,
    today,
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Hola, {profile.full_name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tus becas, de mayor a menor compatibilidad.</p>
        </div>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent-foreground">Datos de demostración</span>
      </div>

      {profile.parental_status !== "no_requerida" && (
        <div className="mt-4 rounded-xl border border-warning bg-warning/20 p-4 text-sm text-warning-foreground">
          Autorización parental: <strong>{PARENTAL_LABEL[profile.parental_status]}</strong>. Mientras esté pendiente, las funciones de cuenta completa quedan bloqueadas. Flujo demostrativo.
        </div>
      )}

      {eligible.length < 5 && (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          Hay {eligible.length} {eligible.length === 1 ? "beca disponible" : "becas disponibles"} para tu perfil en este momento. Mostramos todas las que cumplen los requisitos.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {eligible.map((r) => <Card key={r.scholarship.id} r={r} />)}
      </div>

      {ineligible.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">No cumples un requisito</h2>
          <div className="mt-4 grid gap-4 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
            {ineligible.map((r) => <Card key={r.scholarship.id} r={r} />)}
          </div>
        </section>
      )}
    </main>
  );
}

function Card({ r }: { r: CompatResult<S> }) {
  const s = r.scholarship;
  const high = r.compatibility_score >= 50;
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-card">
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
      <h3 className="mt-3 text-lg font-semibold leading-tight">{s.name}</h3>
      <p className="text-sm text-muted-foreground">{s.entity}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">País</dt><dd>{s.country}</dd>
        <dt className="text-muted-foreground">Nivel</dt><dd>{s.study_level ?? "Cualquiera"}</dd>
        <dt className="text-muted-foreground">Área</dt><dd>{s.area ?? "Cualquiera"}</dd>
        <dt className="text-muted-foreground">Cierre</dt><dd>{new Date(s.deadline + "T00:00:00").toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" })}</dd>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">{r.ineligibleReason ?? explain(r.components)}</p>
    </article>
  );
}
