import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearDecision, daysLeft, decisionsQuery, fmtDate, scholarshipsQuery } from "@/lib/profile";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/mis-becas")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Mis becas — BecaMatch" },
      { name: "description", content: "Tus becas guardadas, días restantes, expiradas y descartadas recuperables." },
      { property: "og:title", content: "Mis becas — BecaMatch" },
      { property: "og:description", content: "Becas guardadas y descartadas." },
    ],
  }),
  component: MisBecas,
});

type Sch = Tables<"scholarships">;

function MisBecas() {
  const qc = useQueryClient();
  const s = useQuery(scholarshipsQuery);
  const d = useQuery(decisionsQuery);
  if (s.isLoading || d.isLoading) return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  if (s.error || d.error) return <p className="p-8 text-center text-destructive">No pudimos cargar tus becas.</p>;

  const byId = new Map((s.data ?? []).map((x) => [x.id, x]));
  const pick = (k: string) =>
    (d.data ?? [])
      .filter((x) => x.decision === k)
      .map((x) => byId.get(x.scholarship_id))
      .filter(Boolean) as Sch[];
  const saved = pick("guardada").sort((a, b) => a.deadline.localeCompare(b.deadline) || a.name.localeCompare(b.name, "es"));
  const active = saved.filter((x) => daysLeft(x.deadline) > 0);
  const expired = saved.filter((x) => daysLeft(x.deadline) <= 0);
  const discarded = pick("descartada").sort((a, b) => a.name.localeCompare(b.name, "es"));

  const remove = async (id: string, msg: string) => {
    try {
      await clearDecision(id);
      await qc.invalidateQueries({ queryKey: ["decisions"] });
      toast.success(msg);
    } catch {
      toast.error("No se pudo actualizar. Intenta de nuevo.");
    }
  };

  const Row = ({ x, children }: { x: Sch; children: React.ReactNode }) => {
    const days = daysLeft(x.deadline);
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-0">
          <Link to="/beca/$id" params={{ id: x.id }} className="font-semibold hover:underline">{x.name}</Link>
          <p className="text-sm text-muted-foreground">{x.entity} · {x.country} · cierra {fmtDate(x.deadline)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${days <= 0 ? "bg-muted text-muted-foreground" : days <= 14 ? "bg-warning/25 text-warning-foreground" : "bg-success/15 text-success"}`}>
            {days <= 0 ? "Expirada" : `${days} ${days === 1 ? "día" : "días"}`}
          </span>
          {children}
        </div>
      </li>
    );
  };

  const Empty = ({ t }: { t: string }) => <p className="mt-3 text-sm text-muted-foreground">{t}</p>;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold">Mis becas</h1>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent-foreground">Datos de demostración</span>
      </div>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Activas ({active.length})</h2>
        {active.length === 0 ? <Empty t="Aún no guardas becas vigentes. Guarda algunas desde tu mazo." /> : (
          <ul className="mt-3 space-y-3">
            {active.map((x) => (
              <Row key={x.id} x={x}><Button size="sm" variant="outline" onClick={() => remove(x.id, "Quitada de guardadas")}>Quitar</Button></Row>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Expiradas ({expired.length})</h2>
        {expired.length === 0 ? <Empty t="Ninguna beca guardada ha expirado." /> : (
          <ul className="mt-3 space-y-3 opacity-70">
            {expired.map((x) => (
              <Row key={x.id} x={x}><Button size="sm" variant="outline" onClick={() => remove(x.id, "Quitada de guardadas")}>Quitar</Button></Row>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Descartadas ({discarded.length})</h2>
        {discarded.length === 0 ? <Empty t="No has descartado becas." /> : (
          <ul className="mt-3 space-y-3">
            {discarded.map((x) => (
              <Row key={x.id} x={x}><Button size="sm" onClick={() => remove(x.id, "Recuperada: vuelve a tu mazo")}>Recuperar</Button></Row>
            ))}
          </ul>
        )}
      </section>

      <Button asChild variant="ghost" className="mt-8"><Link to="/mazo">← Volver al mazo</Link></Button>
    </main>
  );
}
