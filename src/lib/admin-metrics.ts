import { stages, type Stage } from "./applicant-followup";

export const METRICS_ZONE = "America/Lima";
export const PRIORITY_THRESHOLD = 60;
export type MetricsRange = { from: string; to: string };
export type MetricPerson = {
  key: string;
  createdAt: string;
  channel: string;
  stage: Stage;
  priority: number | null;
};
export type SubmissionEvent = { key: string; date: string };
export function limaDay(date: string | number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: METRICS_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}
export function quickRange(
  mode: "today" | "week" | "month" | "current",
  now: number,
): MetricsRange {
  const to = limaDay(now);
  const start = new Date(`${to}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (mode === "week" ? 6 : mode === "month" ? 29 : 0));
  return {
    from: mode === "current" ? `${to.slice(0, 7)}-01` : start.toISOString().slice(0, 10),
    to,
  };
}
export function isFictionalMetricRecord(text: string) {
  return /caso\s+(?:ficticio|de prueba)|ejemplo ficticio|datos de demostración|^prueba\b|prueba de (?:la bandeja|flujo)|^validación\b/i.test(
    text.trim(),
  );
}
export function aggregateMetrics(
  people: MetricPerson[],
  events: SubmissionEvent[],
  range: MetricsRange,
) {
  const inside = (date: string) => {
    const day = limaDay(date);
    return day >= range.from && day <= range.to;
  };
  const unique = [...new Map(people.map((p) => [p.key, p])).values()];
  const cohort = unique.filter((p) => inside(p.createdAt));
  const keys = new Set(unique.map((p) => p.key));
  const firstSubmission = new Map<string, string>();
  for (const event of events) {
    if (
      keys.has(event.key) &&
      (!firstSubmission.has(event.key) || event.date < (firstSubmission.get(event.key) ?? ""))
    )
      firstSubmission.set(event.key, event.date);
  }
  const submissions = [...firstSubmission.values()].filter(inside).length;
  const converted = cohort.filter((p) =>
    ["postulado", "seguimiento", "ganado"].includes(p.stage),
  ).length;
  const average = cohort.length
    ? cohort.filter(
        (p) => firstSubmission.has(p.key) && inside(firstSubmission.get(p.key) ?? p.createdAt),
      ).length / cohort.length
    : 0;
  const channels = [...new Set(cohort.map((p) => p.channel))].sort();
  const days: { day: string; [key: string]: string | number }[] = [];
  for (
    let d = new Date(`${range.from}T12:00:00Z`);
    d.toISOString().slice(0, 10) <= range.to;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const day = d.toISOString().slice(0, 10);
    days.push({
      day,
      ...Object.fromEntries(
        channels.map((c) => [
          c,
          cohort.filter((p) => p.channel === c && limaDay(p.createdAt) === day).length,
        ]),
      ),
    });
  }
  return {
    leads: cohort.length,
    priority: cohort.filter((p) => p.priority !== null && p.priority >= PRIORITY_THRESHOLD).length,
    submissions,
    average,
    converted,
    conversion: cohort.length ? (converted / cohort.length) * 100 : 0,
    channels,
    days,
    funnel: Object.entries(stages).map(([stage, label]) => ({
      stage,
      label,
      count: cohort.filter((p) => p.stage === stage).length,
    })),
  };
}
