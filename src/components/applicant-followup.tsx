import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, RefreshCw, X, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  stages,
  overdue,
  evaluatePriority,
  type Applicant,
  type Stage,
} from "@/lib/applicant-followup";
import {
  saveApplicantFollowup,
  recordApplicantCall,
  confirmApplicantIdentity,
} from "@/lib/applicant-followup.functions";

const fmt = (s: string | null) =>
  s
    ? new Date(s).toLocaleString("es-PE", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Lima",
      })
    : "—";
const localDate = (s: string | null) => {
  if (!s) return "";
  const d = new Date(s);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const field = "min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm";
const responseLabel = (p: Applicant, now: number) =>
  overdue(p, now)
    ? "Sin respuesta"
    : p.response === "pending"
      ? "Pendiente"
      : p.response === "answered"
        ? "Atendida"
        : "Desconocido";
export function ApplicantFollowupView({
  people,
  admins,
}: {
  people: Applicant[];
  admins: { id: string; name: string }[];
}) {
  const client = useQueryClient();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const [query, setQuery] = useState(""),
    [channel, setChannel] = useState("todos"),
    [stage, setStage] = useState("todos"),
    [assignee, setAssignee] = useState("todos"),
    [alert, setAlert] = useState("todos"),
    [order, setOrder] = useState("priority");
  const [selected, setSelected] = useState<string | null>(null),
    [calling, setCalling] = useState(false);
  const evaluated = people.map((p) => ({ ...p, ...evaluatePriority(p, now) }));
  const visible = evaluated
    .filter(
      (p) =>
        (!query || `${p.name} ${p.key}`.toLowerCase().includes(query.trim().toLowerCase())) &&
        (channel === "todos" || p.channels.includes(channel)) &&
        (stage === "todos" || p.followup.stage === stage) &&
        (assignee === "todos" ||
          (assignee === "none" ? !p.followup.assigned_to : p.followup.assigned_to === assignee)) &&
        (alert === "todos" ||
          (alert === "overdue"
            ? overdue(p, now)
            : alert === "unknown"
              ? p.response === "unknown"
              : p.response === "pending")),
    )
    .sort((a, b) =>
      order === "priority"
        ? (b.priority ?? -1) - (a.priority ?? -1) || a.key.localeCompare(b.key)
        : order === "activity"
          ? (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "")
          : order === "date"
            ? (a.followup.followup_at ?? "9999").localeCompare(b.followup.followup_at ?? "9999")
            : (a.pendingSince ?? "9999").localeCompare(b.pendingSince ?? "9999"),
    );
  const person = evaluated.find((p) => p.key === selected);
  const channels = [...new Set(evaluated.flatMap((p) => p.channels))];
  return (
    <section className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Postulantes e interesados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {people.length} fichas · {evaluated.filter((p) => overdue(p, now)).length} sin respuesta
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCalling(true)}>
            <Phone className="size-4" />
            Registrar llamada
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Actualizar postulantes"
            title="Actualizar postulantes"
            onClick={() =>
              void client.invalidateQueries({ queryKey: ["admin", "applicant-followup"] })
            }
          >
            <RefreshCw />
          </Button>
        </div>
      </div>
      <div className="mb-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-md border border-border px-2 py-1">
          Web · Formularios y agente
        </span>
        <span className="rounded-md border border-border px-2 py-1">
          WhatsApp · Historial registrado, entrega no confirmada
        </span>
        <span className="rounded-md border border-border px-2 py-1">
          Llamadas · Registro manual
        </span>
        <span className="rounded-md border border-border px-2 py-1">
          Instagram / Facebook · Sin conexión
        </span>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Input
          aria-label="Buscar postulante"
          placeholder="Buscar nombre o identificador…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Canal"
          className={field}
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
        >
          <option value="todos">Todos los canales</option>
          {channels.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Etapa"
          className={field}
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="todos">Todas las etapas</option>
          {Object.entries(stages).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="Responsable"
          className={field}
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        >
          <option value="todos">Todos los responsables</option>
          <option value="none">Sin asignar</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Alertas"
          className={field}
          value={alert}
          onChange={(e) => setAlert(e.target.value)}
        >
          <option value="todos">Todos los estados de respuesta</option>
          <option value="overdue">Sin respuesta · más de 3 días</option>
          <option value="pending">Pendientes</option>
          <option value="unknown">Desconocidos</option>
        </select>
        <select
          aria-label="Ordenar postulantes"
          className={field}
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        >
          <option value="priority">Mayor prioridad primero</option>
          <option value="activity">Última interacción</option>
          <option value="date">Fecha de seguimiento</option>
          <option value="pending">Antigüedad pendiente</option>
        </select>
      </div>
      <div className="overflow-x-auto border-y border-border">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-secondary">
            <tr>
              {[
                "Postulante",
                "Canales",
                "Prioridad",
                "Etapa",
                "Última interacción",
                "Próxima acción",
                "Fecha de seguimiento",
                "Respuesta",
              ].map((h) => (
                <th key={h} className="px-3 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr
                key={p.key}
                className={`border-t border-border ${overdue(p, now) ? "bg-destructive/5" : ""}`}
              >
                <td className="max-w-48 px-3 py-3">
                  <Button
                    variant="link"
                    className="h-auto max-w-48 justify-start whitespace-normal p-0 text-left"
                    onClick={() => setSelected(p.key)}
                  >
                    {p.name}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.key.split(":")[1]?.slice(0, 8)}
                  </p>
                </td>
                <td className="max-w-40 px-3 py-3 text-xs">{p.channels.join(" · ")}</td>
                <td className="px-3 py-3">
                  <span title={p.factors.join("\n")} className="font-semibold">
                    {p.priority === null ? "Sin evaluar" : `${p.priority}/100`}
                  </span>
                </td>
                <td className="px-3 py-3">{stages[p.followup.stage]}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs">{fmt(p.lastActivity)}</td>
                <td className="max-w-56 px-3 py-3 text-xs">
                  {p.followup.next_action || (
                    <span className="text-muted-foreground">Recomendación: {p.suggestion}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-xs">
                  {fmt(p.followup.followup_at)}
                </td>
                <td
                  className={`px-3 py-3 text-xs ${overdue(p, now) ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                >
                  {responseLabel(p, now)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p className="p-8 text-center text-muted-foreground">
            No hay fichas que coincidan con estos filtros.
          </p>
        )}
      </div>
      <details className="mt-5 text-xs text-muted-foreground">
        <summary className="cursor-pointer">Criterios de prioridad de seguimiento</summary>
        <p className="mt-2">
          Actividad en 7 días: 20 puntos; en 30 días: 10. Consulta pendiente: 15; más de 3 días: 30.
          Becas guardadas o recomendadas: 20. Plan registrado: 20. Etapa Preparando o En seguimiento
          confirmada: 10. Proceso cerrado: 0. Sin interacciones suficientes: Sin evaluar. No mide
          elegibilidad ni probabilidad de obtener una beca.
        </p>
        <p className="mt-2">
          Las respuestas de WhatsApp sin confirmación de entrega y los correos aceptados sin entrega
          comprobada conservan estado desconocido. No se envían mensajes desde esta vista.
        </p>
      </details>
      {person && (
        <PersonDetail
          key={person.key}
          person={person}
          people={evaluated}
          admins={admins}
          now={now}
          close={() => setSelected(null)}
        />
      )}
      {calling && <CallForm people={people} close={() => setCalling(false)} />}
    </section>
  );
}
function PersonDetail({
  person: p,
  people,
  admins,
  now,
  close,
}: {
  person: Applicant;
  people: Applicant[];
  admins: { id: string; name: string }[];
  now: number;
  close: () => void;
}) {
  const save = useServerFn(saveApplicantFollowup),
    link = useServerFn(confirmApplicantIdentity),
    client = useQueryClient();
  const [stage, setStage] = useState<Stage>(p.followup.stage),
    [action, setAction] = useState(p.followup.next_action),
    [date, setDate] = useState(localDate(p.followup.followup_at)),
    [assigned, setAssigned] = useState(p.followup.assigned_to ?? ""),
    [objective, setObjective] = useState(p.followup.objective),
    [resolve, setResolve] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [target, setTarget] = useState(""),
    [evidence, setEvidence] = useState("");
  const timeline = [
    ...p.interactions.flatMap((r) =>
      r.messages.length
        ? r.messages.map((m) => ({
            date: m.date,
            channel: `${r.channel} · ${m.direction === "user" || m.direction === "entrante" ? "Entrante" : "Respuesta registrada"}`,
            text:
              m.body ??
              m.message?.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join(" ") ??
              "",
            key: r.key,
          }))
        : [
            {
              date: r.incomingAt ?? r.lastActivity,
              channel: r.channel,
              text: r.requestText ?? r.preview,
              key: r.key,
            },
          ],
    ),
    ...p.calls.map((c) => ({ date: c.occurred_at, channel: "Llamada", text: c.notes, key: "" })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  async function persist() {
    setBusy(true);
    setError("");
    try {
      await save({
        data: {
          personKey: p.key,
          stage,
          nextAction: action,
          followupAt: date ? new Date(date).toISOString() : null,
          assignedTo: assigned || null,
          objective,
          resolve,
        },
      });
      await client.invalidateQueries({ queryKey: ["admin", "applicant-followup"] });
      setNotice("Seguimiento guardado.");
      setResolve(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-foreground/30 p-2 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Ficha del postulante"
    >
      <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="break-words text-xl font-bold">{p.name}</h2>
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {p.key} · {p.channels.join(" · ")}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Cerrar ficha" onClick={close}>
            <X />
          </Button>
        </div>
        <div className="my-5 grid gap-3 border-y border-border py-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Prioridad de seguimiento</p>
            <p className="font-semibold">
              {p.priority === null ? "Sin evaluar" : `${p.priority}/100`}
            </p>
            {p.factors.map((f) => (
              <p key={f} className="text-xs text-muted-foreground">
                {f}
              </p>
            ))}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Última interacción</p>
            <p className="text-sm">{fmt(p.lastActivity)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estado de respuesta</p>
            <p className={`text-sm ${overdue(p, now) ? "text-destructive" : ""}`}>
              {responseLabel(p, now)}
            </p>
            {p.pendingSince && (
              <p className="text-xs text-muted-foreground">Desde {fmt(p.pendingSince)}</p>
            )}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void persist();
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <label className="grid gap-1 text-sm">
            Etapa actual
            <select
              aria-label="Etapa actual"
              className={field}
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
            >
              {Object.entries(stages).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Responsable administrativo
            <select
              className={field}
              value={assigned}
              onChange={(e) => setAssigned(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Próxima acción
            <Input
              aria-label="Próxima acción"
              maxLength={500}
              value={action}
              onChange={(e) => setAction(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Recomendación: {p.suggestion}</p>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0"
              onClick={() => setAction(p.suggestion)}
            >
              Usar recomendación
            </Button>
          </div>
          <label className="grid gap-1 text-sm">
            Fecha de seguimiento
            <Input
              aria-label="Fecha de seguimiento"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Objetivo administrativo alcanzado
            <Input
              aria-label="Objetivo administrativo alcanzado"
              required={stage === "ganado"}
              maxLength={1000}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={resolve}
              onChange={(e) => setResolve(e.target.checked)}
            />
            Confirmo que las consultas pendientes fueron atendidas
          </label>
          <div className="sm:col-span-2">
            <Button disabled={busy} type="submit">
              <Save className="size-4" />
              {busy ? "Guardando…" : "Guardar seguimiento"}
            </Button>
          </div>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-3 text-sm text-success">
            {notice}
          </p>
        )}
        <section className="mt-6 border-t border-border pt-5">
          <h3 className="font-semibold">Becas de interés</h3>
          {p.saved.map((s) => (
            <p key={s.id} className="mt-2 text-sm">
              {s.name} · Guardada · Cierre {s.deadline}
            </p>
          ))}
          {p.interactions
            .flatMap((r) => r.plans.flatMap((plan) => plan.plan.opportunities))
            .map((s, i) => (
              <p key={`${s.id}-${i}`} className="mt-2 text-sm">
                {s.name} · Plan registrado · Cierre {s.deadline}
              </p>
            ))}
          {p.interactions
            .filter((r) => r.scholarshipIds?.length)
            .map((r) => (
              <p key={r.key} className="mt-2 text-xs text-muted-foreground">
                {r.scholarshipIds?.length} becas recomendadas en formulario ·{" "}
                <Link
                  to="/admin/whatsapp"
                  search={{ interaction: r.key }}
                  className="text-primary underline"
                >
                  Consultar solicitud
                </Link>
              </p>
            ))}
          {!p.saved.length &&
            !p.interactions.some((r) => r.plans.length || r.scholarshipIds?.length) && (
              <p className="mt-2 text-sm text-muted-foreground">
                Sin becas de interés registradas.
              </p>
            )}
        </section>
        <section className="mt-6 border-t border-border pt-5">
          <h3 className="font-semibold">Actividad y solicitudes por canal</h3>
          {timeline.map((t, i) => (
            <div key={i} className="mt-3 border-l-2 border-border pl-3">
              <p className="text-xs text-muted-foreground">
                {fmt(t.date)} · {t.channel}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{t.text}</p>
              {t.key && (
                <Link
                  to="/admin/whatsapp"
                  search={{ interaction: t.key }}
                  className="mt-1 inline-block text-sm text-primary underline"
                >
                  Abrir historial de {t.channel}
                </Link>
              )}
            </div>
          ))}
          {!timeline.length && (
            <p className="mt-2 text-sm text-muted-foreground">Sin conversaciones registradas.</p>
          )}
        </section>
        {!p.userId && (
          <details className="mt-6 border-t border-border pt-5">
            <summary className="cursor-pointer text-sm font-semibold">
              Revisar coincidencia de identidad
            </summary>
            <p className="mt-2 text-xs text-muted-foreground">
              Confirma solo con identidad autenticada, correo verificado o teléfono confirmado. Los
              historiales originales se conservan.
            </p>
            <select
              aria-label="Ficha de identidad confirmada"
              className={`${field} mt-3 w-full`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Seleccionar ficha confirmada</option>
              {people
                .filter((other) => other.key !== p.key)
                .map((other) => (
                  <option key={other.key} value={other.key}>
                    {other.name} · {other.key}
                  </option>
                ))}
            </select>
            <Textarea
              aria-label="Evidencia de identidad"
              className="mt-2"
              placeholder="Evidencia verificada de la coincidencia (sin documentos ni datos sensibles)"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
            <Button
              className="mt-2"
              variant="outline"
              disabled={busy || !target || evidence.trim().length < 10}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await link({ data: { sourceKey: p.key, targetKey: target, evidence } });
                  await client.invalidateQueries({ queryKey: ["admin", "applicant-followup"] });
                  close();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "No se pudo confirmar.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar identidad y relacionar
            </Button>
          </details>
        )}
      </div>
    </div>
  );
}
function CallForm({ people, close }: { people: Applicant[]; close: () => void }) {
  const record = useServerFn(recordApplicantCall),
    client = useQueryClient();
  const [name, setName] = useState(""),
    [user, setUser] = useState(""),
    [date, setDate] = useState(localDate(new Date().toISOString())),
    [notes, setNotes] = useState(""),
    [pending, setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-foreground/30 p-3 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar llamada"
    >
      <form
        className="mx-auto max-w-lg rounded-lg border border-border bg-card p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await record({
              data: {
                name,
                userId: user || null,
                occurredAt: new Date(date).toISOString(),
                notes,
                requiresResponse: pending,
              },
            });
            await client.invalidateQueries({ queryKey: ["admin", "applicant-followup"] });
            close();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo registrar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Registrar llamada</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cerrar llamada"
            onClick={close}
          >
            <X />
          </Button>
        </div>
        <label className="mb-3 grid gap-1 text-sm">
          Nombre o identificador
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </label>
        <label className="mb-3 grid gap-1 text-sm">
          Usuario confirmado
          <select className={field} value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">Sin identidad confirmada · ficha independiente</option>
            {people
              .filter((p) => p.userId)
              .map((p) => (
                <option key={p.key} value={p.userId ?? ""}>
                  {p.name} · {p.userId?.slice(0, 8)}
                </option>
              ))}
          </select>
        </label>
        <label className="mb-3 grid gap-1 text-sm">
          Fecha de la llamada
          <Input
            type="datetime-local"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="mb-3 grid gap-1 text-sm">
          Resumen de la llamada
          <Textarea
            required
            minLength={10}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pending} onChange={(e) => setPending(e.target.checked)} />
          Quedó una consulta pendiente de respuesta
        </label>
        <p className="mb-4 flex gap-2 text-xs text-muted-foreground">
          <AlertCircle className="size-4 shrink-0" />
          Registra únicamente llamadas realizadas y evita datos sensibles.
        </p>
        {error && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          <Phone className="size-4" />
          {busy ? "Guardando…" : "Guardar llamada"}
        </Button>
      </form>
    </div>
  );
}
