import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, LineChart, Line } from "recharts";
import { UsersRound, ListChecks, Target, TrendingUp, ChartNoAxesCombined, RefreshCw } from "lucide-react";
import { getAdminMetrics, metricsRangeSchema } from "@/lib/admin-metrics.functions";
import { quickRange, limaDay, PRIORITY_THRESHOLD, type MetricsRange } from "@/lib/admin-metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";

const metricsQuery = (range: MetricsRange) => queryOptions({ queryKey: ["admin", "metrics", range], queryFn: () => getAdminMetrics({ data: range }), staleTime: 30000 });
export const Route = createFileRoute("/admin/metricas")({
  validateSearch: (search): MetricsRange => {
    const parsed = metricsRangeSchema.safeParse(search);
    return parsed.success ? parsed.data : quickRange("current", Date.now());
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(metricsQuery(deps)),
  head: () => ({ meta: [
    { title: "Métricas de seguimiento — BecaMatch" },
    { name: "description", content: "Indicadores reales de interesados, canales y seguimiento de BecaMatch." },
    { property: "og:title", content: "Métricas de seguimiento — BecaMatch" },
    { property: "og:description", content: "Panel administrativo de actividad y etapas de postulación." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  pendingComponent: () => <p role="status" className="py-16 text-muted-foreground">Cargando métricas…</p>,
  errorComponent: MetricsError,
  notFoundComponent: () => <p>No se encontraron métricas.</p>,
  component: MetricsPage,
});
function MetricsError() {
  const router = useRouter();
  return <div role="alert" className="space-y-4 py-12"><p>No se pudieron cargar las métricas. Verifica tu acceso e inténtalo nuevamente.</p><Button onClick={() => router.invalidate()}>Reintentar</Button></div>;
}
const colors = ["var(--primary)", "var(--accent)", "var(--chart-3)", "var(--chart-4)", "var(--chart-2)"];
function MetricsPage() {
  const range = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data } = useSuspenseQuery(metricsQuery(range));
  const router = useRouter();
  const setRange = (next: MetricsRange) => { if (metricsRangeSchema.safeParse(next).success) void navigate({ search: next }); };
  const today = limaDay(Date.now());
  const exactToday = range.from === today && range.to === today;
  const currentMonth = range.from === `${today.slice(0,7)}-01` && range.to === today;
  const cards = [
    { title: exactToday ? "Leads de hoy" : "Leads del período", value: data.leads, detail: "Personas únicas registradas", icon: UsersRound },
    { title: "Leads prioritarios", value: data.priority, detail: `Prioridad actual ≥ ${PRIORITY_THRESHOLD}/100`, icon: Target },
    { title: currentMonth ? "Postulaciones del mes" : "Postulaciones del período", value: data.submissions, detail: "Primer proceso externo registrado por persona", icon: ListChecks },
    { title: "Postulaciones por interesado", value: data.average.toLocaleString("es-PE", { maximumFractionDigits: 2 }), detail: "Promedio de la cohorte seleccionada", icon: ChartNoAxesCombined },
    { title: "Tasa de conversión", value: `${data.conversion.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`, detail: `${data.converted} avanzados / ${data.leads} leads`, icon: TrendingUp },
  ];
  const config = Object.fromEntries(data.channels.map((channel, i) => [channel, { label: channel, color: colors[i % colors.length] }]));
  return <div className="space-y-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs uppercase text-muted-foreground">Seguimiento real</p><h2 className="text-3xl font-semibold">Métricas de BecaMatch</h2><p className="mt-2 text-sm text-muted-foreground">{range.from} — {range.to} · Hora de Lima (UTC−5)</p></div><Button variant="outline" size="icon" aria-label="Actualizar métricas" title="Actualizar métricas" onClick={() => router.invalidate()}><RefreshCw /></Button></div>
    <section aria-label="Filtro de fechas" className="flex flex-wrap items-end gap-4 border-y border-border py-5">
      <label className="space-y-2 text-sm">Desde<Input type="date" aria-label="Fecha inicial" value={range.from} max={range.to} min={new Date(Date.parse(range.to) - 365 * 86400000).toISOString().slice(0,10)} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
      <label className="space-y-2 text-sm">Hasta<Input type="date" aria-label="Fecha final" value={range.to} min={range.from} max={new Date(Date.parse(range.from) + 365 * 86400000).toISOString().slice(0,10)} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
      <div className="flex flex-wrap gap-2">{([["today","Hoy"],["week","Últimos 7 días"],["month","Últimos 30 días"],["current","Mes actual"]] as const).map(([mode,label]) => { const next = quickRange(mode, Date.now()); return <Button key={mode} variant={next.from === range.from && next.to === range.to ? "default" : "outline"} size="sm" onClick={() => setRange(next)}>{label}</Button>; })}</div>
    </section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ title,value,detail,icon: Icon }) => <article key={title} className="min-w-0 rounded-lg border border-border bg-card p-5"><Icon className="mb-4 size-5 text-accent" /><p className="min-h-10 text-sm text-muted-foreground">{title}</p><p className="my-3 text-3xl font-semibold tabular-nums">{value}</p><p className="text-xs leading-relaxed text-muted-foreground">{detail}</p></article>)}</div>
    {data.leads === 0 && <p role="status" className="border-l-2 border-accent px-4 py-2 text-sm text-muted-foreground">No hay interesados reales nuevos en este período. Los casos ficticios y cuentas administrativas están excluidos.</p>}
    <div className="grid gap-8 xl:grid-cols-2">
      <section className="min-w-0 border-t border-border pt-5"><h3 className="text-lg font-semibold">Leads por canal y día</h3><p className="mt-1 mb-5 text-xs text-muted-foreground">Canal del primer contacto registrado · una persona, un origen</p>{data.channels.length ? <ChartContainer className="h-72 w-full aspect-auto" config={config}><LineChart data={data.days} accessibilityLayer><CartesianGrid vertical={false} /><XAxis dataKey="day" tickFormatter={(v: string) => v.slice(5)} minTickGap={32} /><YAxis allowDecimals={false} width={30} /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} />{data.channels.map((channel,i) => <Line key={channel} type="linear" dataKey={channel} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} isAnimationActive={false} />)}</LineChart></ChartContainer> : <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Sin contactos en el período.</div>}</section>
      <section className="min-w-0 border-t border-border pt-5"><h3 className="text-lg font-semibold">Embudo por etapa</h3><p className="mt-1 mb-5 text-xs text-muted-foreground">Etapa actual de los leads registrados en el período · no acumulativo</p><ChartContainer className="h-72 w-full aspect-auto" config={{ count: { label: "Personas", color: "var(--primary)" } }}><BarChart data={data.funnel} layout="vertical" margin={{ left: 0, right: 20 }} accessibilityLayer><CartesianGrid horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="label" width={145} tick={{ fontSize: 11 }} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="count" fill="var(--primary)" radius={3} isAnimationActive={false} /></BarChart></ChartContainer></section>
    </div>
    <details className="border-t border-border pt-5 text-sm"><summary className="cursor-pointer font-medium">Definiciones y límites de los datos</summary><div className="mt-4 space-y-3 leading-relaxed text-muted-foreground">
      <p>Leads: primer perfil, formulario, mensaje entrante o llamada registrada. Se deduplican por cuenta verificada y vínculos de identidad revisados; no por nombre o correo sin verificar.</p>
      <p>Prioridad: puntuación de seguimiento actual de la cohorte, desde {PRIORITY_THRESHOLD}/100. Actividad: hasta 20; consulta pendiente: 30; interés en becas reales: 20; plan: 20; etapa confirmada: 10. No es compatibilidad ni probabilidad de obtener una beca.</p>
      <p>Postulaciones: primera entrada en Postulado o Postulación en seguimiento en la bitácora, por persona y dentro del período. Preparando postulación y un plan generado no cuentan como envío. No existe un registro individual de cada envío externo: este indicador cuenta procesos, no solicitudes a distintas becas.</p>
      <p>Conversión: leads de la cohorte actualmente en Postulado, Postulación en seguimiento o Ganado, divididos entre todos los leads de la cohorte. Ganado indica un objetivo administrativo confirmado, no necesariamente una beca obtenida. Con cero leads se muestra 0%.</p>
      <p>Promedio: procesos registrados en el período de personas de la cohorte, dividido entre sus leads. No hay registros de pagos o ingresos; no se calcula valor económico por cliente.</p>
      <p>Fuentes: perfiles, solicitudes, conversaciones y mensajes web/WhatsApp, llamadas, decisiones de becas, seguimiento, vínculos revisados y bitácora. Los canales solo aparecen cuando tienen contactos registrados; el historial de WhatsApp no confirma entrega. Sin datos atribuidos de Instagram o Facebook.</p>
      <p>Se excluyen registros explícitamente etiquetados como prueba, ficticios o demostración y cuentas administrativas. Los registros de prueba sin etiqueta no se pueden identificar automáticamente. Rango máximo: 366 días. Actualizado: {new Date(data.generatedAt).toLocaleString("es-PE", { timeZone: "America/Lima" })}.</p>
    </div></details>
  </div>;
}