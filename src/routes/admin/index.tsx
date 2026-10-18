import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  GraduationCap,
  ClipboardCheck,
  Clock3,
  UsersRound,
  Inbox,
  ArrowUpRight,
  FlaskConical,
  CheckCheck,
} from "lucide-react";
import { scholarshipsQuery, fmtDate } from "@/lib/profile";
import { summaryMetrics, verificationLabel, expiryLabel } from "@/lib/admin-scholarships";
import { getAdminOverview } from "@/lib/admin-scholarships.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Resumen operativo — BecaMatch" },
      {
        name: "description",
        content: "Indicadores y seguimiento operativo de becas y solicitudes de BecaMatch.",
      },
      { property: "og:title", content: "Resumen operativo — BecaMatch" },
      {
        property: "og:description",
        content: "Indicadores reales y convocatorias pendientes de revisión.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});
function Overview() {
  const scholarships = useQuery(scholarshipsQuery);
  const fetchOverview = useServerFn(getAdminOverview);
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => fetchOverview() });
  const today = new Date().toISOString().slice(0, 10);
  const rows = scholarships.data ?? [];
  const metrics = summaryMetrics(rows, today);
  const real = rows.filter(
    (s) => !s.es_demo && s.estado_datos !== "propuesta_ficticia_no_verificada",
  );
  const review = real.filter((s) => verificationLabel(s) !== "Verificada").slice(0, 4);
  const expiring = real
    .filter((s) => expiryLabel(s.deadline, today, s.archived) === "Próxima a vencer")
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 4);
  const indicators = [
    {
      label: "Becas registradas",
      value: scholarships.isSuccess ? metrics.total : null,
      icon: GraduationCap,
    },
    {
      label: "Becas verificadas",
      value: scholarships.isSuccess ? metrics.verified : null,
      icon: CheckCheck,
    },
    {
      label: "Pendientes de verificación",
      value: scholarships.isSuccess ? metrics.pending : null,
      icon: ClipboardCheck,
    },
    {
      label: "Próximas a vencer",
      value: scholarships.isSuccess ? metrics.expiring : null,
      icon: Clock3,
    },
    { label: "Perfiles registrados", value: overview.data?.registered, icon: UsersRound },
    { label: "Solicitudes por atender", value: overview.data?.pendingRequests, icon: Inbox },
  ];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Vista operativa
          </p>
          <h2 className="text-3xl font-semibold">Resumen de BecaMatch</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Convocatorias, revisiones y solicitudes en un solo lugar.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/becas" search={{ id: undefined }}>
            Gestionar becas
            <ArrowUpRight />
          </Link>
        </Button>
      </div>
      {(scholarships.isError || overview.isError) && (
        <p role="alert" className="text-sm text-destructive">
          No se pudieron cargar todos los indicadores. No se muestran cifras estimadas.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {indicators.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className="size-5 text-primary/65" />
            </div>
            <p className="mt-4 text-3xl font-semibold tabular-nums">{value ?? "—"}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {label === "Próximas a vencer"
                ? "Fechas futuras dentro de 30 días"
                : label === "Solicitudes por atender"
                  ? "Recibidas, analizadas o con error"
                  : label === "Perfiles registrados"
                    ? "Perfiles almacenados, no visitantes anónimos"
                    : "Convocatorias reales, excluye demostraciones"}
            </p>
          </article>
        ))}
      </div>
      {metrics.demo > 0 && (
        <div className="flex items-start gap-3 border-l-2 border-accent bg-accent/5 px-4 py-3 text-sm">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-accent" />
          <p>
            <strong>{metrics.demo} registros de demostración</strong> en el catálogo. No se
            contabilizan como convocatorias reales o verificadas.{" "}
            <Link to="/admin/becas" search={{ id: undefined }} className="text-primary underline">
              Consultar catálogo
            </Link>
          </p>
        </div>
      )}
      <div className="grid gap-x-8 gap-y-8 xl:grid-cols-2">
        <section className="border-t border-border pt-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Becas por revisar</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/verificacion" search={{ id: undefined }}>
                Ver todas
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          {review.length ? (
            review.map((s) => (
              <Link
                key={s.id}
                to="/admin/verificacion"
                search={{ id: s.id }}
                className="flex items-center justify-between gap-4 border-b border-border py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.entity} · {s.country}
                  </p>
                </div>
                <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))
          ) : (
            <Empty title="No hay convocatorias reales pendientes." to="becas" />
          )}
        </section>
        <section className="border-t border-border pt-5">
          <h3 className="mb-4 text-lg font-semibold">Próximos vencimientos</h3>
          {expiring.length ? (
            expiring.map((s) => (
              <Link
                key={s.id}
                to="/admin/becas"
                search={{ id: s.id }}
                className="flex items-center justify-between gap-4 border-b border-border py-3 text-sm"
              >
                <p className="font-medium">{s.name}</p>
                <p className="whitespace-nowrap text-accent">{fmtDate(s.deadline)}</p>
              </Link>
            ))
          ) : (
            <Empty title="No hay convocatorias reales próximas a vencer." to="becas" />
          )}
        </section>
        <section className="border-t border-border pt-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Solicitudes recientes</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/solicitudes">
                Ver todas
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          {overview.data?.recentRequests.length ? (
            overview.data.recentRequests.map((r) => (
              <Link
                key={r.id}
                to="/admin/solicitudes"
                search={{ id: r.id }}
                className="flex items-center justify-between gap-4 border-b border-border py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{r.full_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.status === "correo_enviado"
                      ? "Correo enviado"
                      : r.status === "error"
                        ? "Error"
                        : r.status === "analizada"
                          ? "Analizada"
                          : "Recibida"}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(r.created_at.slice(0, 10))}
                </p>
              </Link>
            ))
          ) : (
            <Empty title="Aún no hay solicitudes registradas." to="solicitudes" />
          )}
        </section>
        <section className="border-t border-border pt-5">
          <h3 className="mb-4 text-lg font-semibold">Actividad reciente</h3>
          {overview.data?.recentRequests.length ? (
            overview.data.recentRequests.map((r) => (
              <Link
                key={r.id}
                to="/admin/solicitudes"
                search={{ id: r.id }}
                className="flex items-start gap-3 py-3 text-sm"
              >
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p>Solicitud recibida: {r.full_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("es-PE")}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              No hay eventos de solicitud registrados.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Se muestran eventos de recepción existentes; no se infieren cambios ni interacciones.
          </p>
        </section>
      </div>
    </div>
  );
}
function Empty({ title, to }: { title: string; to: "becas" | "solicitudes" }) {
  return (
    <div className="py-8">
      <p className="mb-3 text-sm text-muted-foreground">{title}</p>
      <Button asChild variant="outline" size="sm">
        {to === "becas" ? (
          <Link to="/admin/becas" search={{ id: undefined }}>
            Consultar becas
          </Link>
        ) : (
          <Link to="/admin/solicitudes">Consultar solicitudes</Link>
        )}
      </Button>
    </div>
  );
}
