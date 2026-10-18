import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Plus, Pencil, ClipboardCheck, ExternalLink } from "lucide-react";
import { scholarshipsQuery, fmtDate } from "@/lib/profile";
import {
  verificationLabel,
  expiryLabel,
  canVerifyScholarship,
  type AdminScholarship,
} from "@/lib/admin-scholarships";
import { saveAdminScholarship, verifyAdminScholarship } from "@/lib/admin-scholarships.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScholarshipOrientation } from "@/components/scholarship-orientation";

export function AdminScholarships({
  verificationOnly = false,
  selectedId,
}: {
  verificationOnly?: boolean;
  selectedId?: string | undefined;
}) {
  const query = useQuery(scholarshipsQuery);
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [editing, setEditing] = useState<AdminScholarship | "new" | null>(null);
  const [selected, setSelected] = useState<AdminScholarship | null>(null);
  const [verifying, setVerifying] = useState<AdminScholarship | null>(null);
  const [checked, setChecked] = useState(false);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const save = useServerFn(saveAdminScholarship);
  const verify = useServerFn(verifyAdminScholarship);
  const today = new Date().toISOString().slice(0, 10);
  const rows = (query.data ?? [])
    .filter(
      (s) =>
        (!verificationOnly || verificationLabel(s) !== "Verificada") &&
        (!selectedId || s.id === selectedId) &&
        `${s.name} ${s.entity} ${s.country}`.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" ||
          (filter === "real" && !s.es_demo) ||
          (filter === "demo" && s.es_demo) ||
          (filter === "verified" && verificationLabel(s) === "Verificada") ||
          (filter === "pending" && verificationLabel(s) === "Pendiente de verificación") ||
          (filter === "expiring" &&
            expiryLabel(s.deadline, today, s.archived) === "Próxima a vencer") ||
          (filter === "expired" && expiryLabel(s.deadline, today, s.archived) === "Vencida")),
    )
    .sort((a, b) =>
      sort === "deadline" ? a.deadline.localeCompare(b.deadline) : a.name.localeCompare(b.name),
    );
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["scholarships"] });
    await client.invalidateQueries({ queryKey: ["admin", "overview"] });
  };
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">
            {verificationOnly ? "Revisar convocatorias" : "Catálogo de becas"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {verificationOnly
              ? "Comprueba los datos en la fuente oficial antes de registrar una verificación."
              : "Convocatorias y ejemplos de demostración, diferenciados por su procedencia."}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing("new");
            setError("");
          }}
        >
          <Plus />
          Crear beca
        </Button>
      </div>
      <div className="my-6 flex flex-wrap gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Buscar becas"
            placeholder="Buscar por nombre, entidad o país…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-56" aria-label="Filtrar becas">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              ["all", "Todos los registros"],
              ["real", "Convocatorias reales"],
              ["demo", "Datos de demostración"],
              ["verified", "Verificadas"],
              ["pending", "Pendientes de verificación"],
              ["expiring", "Próximas a vencer"],
              ["expired", "Vencidas"],
            ].map(([value, label]) => (
              <SelectItem key={value} value={value ?? "all"}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-44" aria-label="Ordenar becas">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nombre A–Z</SelectItem>
            <SelectItem value="deadline">Fecha límite</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {notice && (
        <p role="status" className="mb-4 text-sm text-primary">
          {notice}
        </p>
      )}
      {query.isError && (
        <p role="alert" className="text-destructive">
          No se pudieron cargar las becas.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {[
                "Beca / entidad",
                "País",
                "Nivel",
                "Fecha límite",
                "Verificación",
                "Vigencia",
                "Última comprobación",
                "Acciones",
              ].map((x) => (
                <th key={x} className="px-4 py-3 font-medium">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="max-w-72 px-4 py-4">
                  <Button
                    variant="link"
                    className="h-auto whitespace-normal p-0 text-left font-medium"
                    onClick={() => setSelected(s)}
                  >
                    {s.name}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">{s.entity}</p>
                </td>
                <td className="px-4 py-4">{s.country}</td>
                <td className="px-4 py-4">{s.study_level ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-4">{fmtDate(s.deadline)}</td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-block rounded-md px-2 py-1 text-xs ${verificationLabel(s) === "Verificada" ? "bg-primary/10 text-primary" : s.es_demo ? "bg-secondary text-secondary-foreground" : "bg-warning/20 text-warning-foreground"}`}
                  >
                    {verificationLabel(s)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={
                      expiryLabel(s.deadline, today, s.archived) === "Vencida"
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {expiryLabel(s.deadline, today, s.archived)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {s.ultima_verificacion ? fmtDate(s.ultima_verificacion) : "—"}
                </td>
                <td className="px-4 py-4">
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${s.name}`}
                      title="Editar beca"
                      onClick={() => {
                        setEditing(s);
                        setError("");
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!canVerifyScholarship(s)}
                      title={
                        s.es_demo
                          ? "Los ejemplos ficticios no pueden verificarse"
                          : "Verificar fuente"
                      }
                      aria-label={`Verificar ${s.name}`}
                      onClick={() => {
                        setVerifying(s);
                        setSource(s.fuente_requisitos || s.official_url || "");
                        setChecked(false);
                        setError("");
                      }}
                    >
                      <ClipboardCheck />
                    </Button>
                    {s.official_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a
                          href={s.official_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir fuente oficial"
                          aria-label={`Fuente de ${s.name}`}
                        >
                          <ExternalLink />
                        </a>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="px-6 py-14 text-center text-sm text-muted-foreground">
            {query.isLoading ? "Cargando becas…" : "No hay becas que coincidan con esta selección."}
            <div className="mt-3">
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Restablecer filtros
              </Button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {rows.length} registros · No existe un historial de modificaciones: se muestra la última
        comprobación registrada, cuando está disponible.
      </p>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Crear beca" : "Editar beca"}</DialogTitle>
            <DialogDescription>
              {editing !== "new" && editing?.es_demo
                ? "Este registro conserva su identidad de demostración."
                : "Al guardar, la convocatoria queda pendiente de comprobación de su fuente."}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              key={typeof editing === "string" ? editing : editing.id}
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const text = (key: string) => String(f.get(key) ?? "").trim() || null;
                setBusy(true);
                setError("");
                try {
                  const result = await save({
                    data: {
                      id: editing === "new" ? null : editing.id,
                      fields: {
                        name: text("name") ?? "",
                        entity: text("entity") ?? "",
                        country: text("country") ?? "",
                        deadline: text("deadline") ?? "",
                        study_level: text("study_level"),
                        area: text("area"),
                        official_url: text("official_url"),
                        coverage: text("coverage"),
                        requirements: text("requirements"),
                        documents: text("documents"),
                        language_code: text("language_code"),
                        language_level: text("language_level"),
                        min_gpa: text("min_gpa") ? Number(text("min_gpa")) : null,
                        archived: f.get("archived") === "on",
                      },
                    },
                  });
                  await refresh();
                  setEditing(null);
                  setNotice(`Beca guardada. Identificador: ${result.id}`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "No se pudo guardar.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {[
                ["name", "Nombre de la beca", true],
                ["entity", "Entidad", true],
                ["country", "País", true],
                ["study_level", "Nivel académico", false],
                ["area", "Área de estudio", false],
                ["deadline", "Fecha límite", true],
                ["official_url", "Enlace oficial", false],
                ["language_code", "Código de idioma", false],
                ["language_level", "Nivel de idioma", false],
                ["min_gpa", "Promedio mínimo (0–20)", false],
              ].map(([key, label, required]) => {
                const k = String(key);
                const value = editing === "new" ? "" : editing[k as keyof AdminScholarship];
                return (
                  <div key={k} className="space-y-1">
                    <Label htmlFor={`edit-${k}`}>{String(label)}</Label>
                    <Input
                      id={`edit-${k}`}
                      name={k}
                      required={Boolean(required)}
                      type={
                        k === "deadline"
                          ? "date"
                          : k === "official_url"
                            ? "url"
                            : k === "min_gpa"
                              ? "number"
                              : "text"
                      }
                      defaultValue={
                        typeof value === "string" || typeof value === "number" ? value : ""
                      }
                      min={k === "min_gpa" ? 0 : undefined}
                      max={k === "min_gpa" ? 20 : undefined}
                      step={k === "min_gpa" ? "any" : undefined}
                    />
                  </div>
                );
              })}
              {[
                ["coverage", "Cobertura y beneficios confirmados"],
                ["requirements", "Requisitos de la fuente"],
                ["documents", "Documentos confirmados"],
              ].map(([key, label]) => (
                <div key={key} className="space-y-1 sm:col-span-2">
                  <Label htmlFor={`edit-${key}`}>{label}</Label>
                  <Textarea
                    id={`edit-${key}`}
                    name={key}
                    defaultValue={
                      editing === "new" ? "" : String(editing[key as keyof AdminScholarship] ?? "")
                    }
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="archived" defaultChecked={editing !== "new" && editing.archived} />
                Archivada
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive sm:col-span-2">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Guardando…" : "Guardar beca"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!verifying}
        onOpenChange={(open) => {
          if (!open && !busy) setVerifying(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprobar la fuente oficial</DialogTitle>
            <DialogDescription>
              {verifying?.name}. BecaMatch registra tu comprobación, no verifica automáticamente la
              convocatoria.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!verifying || !checked) return;
              setBusy(true);
              setError("");
              try {
                await verify({ data: { id: verifying.id, source, checked: true } });
                await refresh();
                setVerifying(null);
                setNotice("Verificación registrada tras tu confirmación de la fuente.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "No se pudo verificar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {verifying?.official_url && (
              <Button asChild variant="outline">
                <a href={verifying.official_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                  Consultar convocatoria
                </a>
              </Button>
            )}
            <Label htmlFor="verification-source">Fuente consultada</Label>
            <Input
              id="verification-source"
              type="url"
              required
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
              <span>
                He comprobado en la fuente oficial los requisitos, beneficios y fecha límite
                registrados.
              </span>
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button disabled={!checked || busy} type="submit">
              {busy ? "Registrando…" : "Registrar verificación"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              {selected?.entity} · {selected && verificationLabel(selected)}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <p>
                {selected.country} · {selected.study_level} · {selected.area}
              </p>
              <p>Fecha límite: {fmtDate(selected.deadline)}</p>
              {[
                ["Cobertura", selected.coverage],
                ["Requisitos", selected.requirements],
                ["Documentos", selected.documents],
              ].map(([label, value]) => (
                <div key={label}>
                  <h3 className="font-semibold">{label}</h3>
                  <p className="whitespace-pre-wrap">{value || "No especificado en la fuente."}</p>
                </div>
              ))}
              <ScholarshipOrientation scholarship={selected} />
              {selected.official_url && (
                <Button asChild variant="outline">
                  <a href={selected.official_url} target="_blank" rel="noopener noreferrer">
                    Ir a la convocatoria oficial
                    <ExternalLink />
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
