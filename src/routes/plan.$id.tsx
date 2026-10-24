import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardCopy, ExternalLink, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSharedPlan } from "@/lib/shared-plan.functions";
import { remainingDays, type SharedPlan } from "@/lib/shared-plan";

const planQuery = (id: string) =>
  queryOptions({ queryKey: ["shared-plan", id], queryFn: () => getSharedPlan({ data: { id } }) });
export const Route = createFileRoute("/plan/$id")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(planQuery(params.id)),
  head: () => ({
    meta: [
      { title: "Plan de postulación — BecaMatch" },
      {
        name: "description",
        content:
          "Requisitos verificados, documentos y próximos pasos de tu plan de orientación BecaMatch.",
      },
      { property: "og:title", content: "Plan de postulación — BecaMatch" },
      {
        property: "og:description",
        content: "Consulta los pasos y las fuentes oficiales de este plan de orientación.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: PlanPage,
});
function PlanPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(planQuery(id));
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  if (!data)
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl">Plan no disponible</h1>
        <p className="mt-3 text-muted-foreground">
          Revisa el enlace seguro recibido. El número correlativo no permite abrir un plan.
        </p>
      </main>
    );
  const plan = JSON.parse(data) as {
    number: string;
    createdAt: string;
    content: SharedPlan;
    today: string;
  };
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <ClipboardList className="mb-3 size-9 text-primary" />
          <p className="text-sm font-semibold text-primary">{plan.number}</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Plan de postulación</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Creado el {plan.createdAt.slice(0, 10)} · BecaMatch
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            } catch {
              setCopyError("No se pudo copiar. Copia el enlace desde la barra de direcciones.");
            }
          }}
        >
          <ClipboardCopy />
          {copied ? "Enlace copiado" : "Copiar enlace"}
        </Button>
      </div>
      {copyError && (
        <p role="alert" className="mt-3 text-destructive">
          {copyError}
        </p>
      )}
      <p className="mt-6 text-muted-foreground">{plan.content.notice}</p>
      {plan.content.opportunities.map((s) => {
        const days = remainingDays(s.deadline, plan.today);
        return (
          <section key={s.id} className="mt-8 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              {s.entity} · {s.country}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">{s.name}</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["Nivel académico", s.studyLevel],
                ["Área de estudio", s.area],
                ["Idioma", s.language],
                [s.orientation.illustrative ? "Cobertura de demostración" : "Cobertura confirmada", s.coverage],
                ["Compatibilidad", s.score === null ? "Sin calcular" : `${s.score}/100`],
                [
                  "Fecha límite",
                  `${s.deadline} · ${days > 0 ? `${days} días restantes` : days === 0 ? "Vence hoy" : "Convocatoria vencida"}`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-medium">
                    {value || "Dato no disponible: consulta la fuente oficial."}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">{s.reasons}</p>
            <h3 className="mt-6 font-semibold">Requisitos de elegibilidad</h3>
            {s.requirements && <p className="mt-2 whitespace-pre-wrap text-sm">{s.requirements}</p>}
            {s.orientation.requirements.length ? (
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
                {s.orientation.requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              !s.requirements && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Requisitos no disponibles; confírmalos en la fuente oficial.
                </p>
              )
            )}
            {s.orientation.restrictions.length > 0 && (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                {s.orientation.restrictions.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            <h3 className="mt-6 font-semibold">Documentos requeridos</h3>
            {s.orientation.documents.length ? (
              <ul className="mt-2 space-y-2 text-sm">
                {s.orientation.documents.map((d, i) => (
                  <li key={i}>
                    {d.nombre} — <strong>{d.obligatorio ? "Obligatorio" : "Opcional"}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {s.legacyDocuments || "Documentos no registrados."} La obligatoriedad no está
                confirmada; consulta la fuente oficial.
              </p>
            )}
            <h3 className="mt-6 font-semibold">Proceso de postulación</h3>
            {s.orientation.steps.length ? (
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                {s.orientation.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Pasos oficiales no disponibles; revísalos en la convocatoria.
              </p>
            )}
            <p className="mt-5 text-sm text-muted-foreground">{s.pending}</p>
            {s.url ? (
              <Button asChild className="mt-4">
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  {s.orientation.illustrative ? "Consultar enlace de ejemplo" : "Ir a la convocatoria oficial"}
                </a>
              </Button>
            ) : (
              <p className="mt-4 text-sm text-destructive">
                Enlace oficial no registrado; solicítalo antes de continuar.
              </p>
            )}
          </section>
        );
      })}
      <section className="mt-8 border-t border-border pt-6">
        <h2 className="text-xl font-semibold">Próximas acciones recomendadas</h2>
        <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm">
          {plan.content.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </section>
      <p className="mt-8 text-sm text-muted-foreground">
        Este enlace permite consultar únicamente el plan. Compártelo con personas de confianza. No
        confirma una postulación ni una beca obtenida.
      </p>
      <Button asChild variant="outline" className="mt-5">
        <Link to="/perfil">Completar mi perfil</Link>
      </Button>
    </main>
  );
}
