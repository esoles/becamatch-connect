import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AREAS, COUNTRIES, LANGUAGES, STUDY_LEVELS } from "@/lib/catalog";
import { CEFR, isMinor, type Cefr, type UserLanguage } from "@/lib/compatibility";
import { PARENTAL_LABEL, profileQuery } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil — BecaMatch" },
      { name: "description", content: "Completa tu perfil académico para calcular tu compatibilidad con becas." },
      { property: "og:title", content: "Mi perfil — BecaMatch" },
      { property: "og:description", content: "Completa tu perfil académico en BecaMatch." },
    ],
  }),
  component: PerfilPage,
});

const thisYear = new Date().getFullYear();
const schema = z.object({
  full_name: z.string().trim().min(1, "Ingresa tu nombre").max(120),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de nacimiento inválida").refine((d) => d < new Date().toISOString().slice(0, 10), "Fecha inválida"),
  study_level: z.string().min(1, "Elige un nivel"),
  area: z.string().min(1, "Elige un área"),
  countries: z.array(z.string()),
  languages: z.array(z.object({ code: z.string(), level: z.enum(CEFR) })),
  gpa: z.number({ message: "Promedio inválido" }).min(0, "El promedio debe estar entre 0 y 20").max(20, "El promedio debe estar entre 0 y 20"),
  graduation_year: z.number().int().min(1950, "Año inválido").max(thisYear + 10, "Año inválido"),
});

const select = "h-10 w-full rounded-md border border-input bg-card px-3 text-sm";

function PerfilPage() {
  const { data: profile, isLoading } = useQuery(profileQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [f, setF] = useState({
    full_name: "", birth_date: "", study_level: "", area: "",
    countries: [] as string[], languages: [{ code: "es", level: "C2" }] as UserLanguage[],
    gpa: "", graduation_year: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);
  useEffect(() => {
    if (profile)
      setF({
        full_name: profile.full_name, birth_date: profile.birth_date, study_level: profile.study_level,
        area: profile.area, countries: profile.countries, languages: profile.languages as unknown as UserLanguage[],
        gpa: String(profile.gpa), graduation_year: String(profile.graduation_year),
      });
  }, [profile]);

  const toggleCountry = (c: string) =>
    setF((s) => ({ ...s, countries: s.countries.includes(c) ? s.countries.filter((x) => x !== c) : [...s.countries, c] }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      ...f,
      gpa: f.gpa === "" ? NaN : Number(f.gpa),
      graduation_year: Number(f.graduation_year),
      languages: f.languages.filter((l) => l.code),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").upsert({ id: u.user!.id, email, ...parsed.data });
    setSaving(false);
    if (error) return toast.error("No se pudo guardar el perfil.");
    await qc.invalidateQueries({ queryKey: ["profile"] });
    toast.success("Perfil guardado");
    navigate({ to: "/mazo" });
  }

  if (isLoading) return <p className="p-8 text-center text-muted-foreground">Cargando…</p>;
  const minor = f.birth_date && isMinor(f.birth_date);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">Tu perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">Con estos datos calculamos tu compatibilidad.</p>

      {profile && profile.parental_status !== "no_requerida" && (
        <div className="mt-4 rounded-xl border border-warning bg-warning/20 p-4 text-sm text-warning-foreground">
          <strong>Autorización parental: {PARENTAL_LABEL[profile.parental_status]}.</strong> Flujo demostrativo; no constituye validación legal.
        </div>
      )}

      <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo"><Input value={f.full_name} maxLength={120} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field label="Email"><Input value={email} disabled /></Field>
          <Field label="Fecha de nacimiento"><Input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></Field>
          <Field label="Año de egreso"><Input type="number" inputMode="numeric" value={f.graduation_year} onChange={(e) => setF({ ...f, graduation_year: e.target.value })} /></Field>
          <Field label="Nivel de estudios">
            <select className={select} value={f.study_level} onChange={(e) => setF({ ...f, study_level: e.target.value })}>
              <option value="">Elige…</option>
              {STUDY_LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Área">
            <select className={select} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}>
              <option value="">Elige…</option>
              {AREAS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
          <Field label="Promedio (0–20)">
            <Input type="number" inputMode="decimal" min={0} max={20} step="0.01" value={f.gpa} onChange={(e) => setF({ ...f, gpa: e.target.value })} />
          </Field>
        </div>
        {minor && (
          <p className="rounded-lg bg-warning/20 p-3 text-sm text-warning-foreground">
            Eres menor de 18: tu cuenta quedará con autorización parental <strong>pendiente</strong>.
          </p>
        )}

        <div>
          <Label>Países de interés</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {COUNTRIES.map((c) => {
              const on = f.countries.includes(c);
              return (
                <button type="button" key={c} onClick={() => toggleCountry(c)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Idiomas (CEFR)</Label>
          <div className="mt-2 space-y-2">
            {f.languages.map((l, i) => (
              <div key={i} className="flex gap-2">
                <select className={select} value={l.code} onChange={(e) => setF({ ...f, languages: f.languages.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)) })}>
                  {LANGUAGES.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                </select>
                <select className={`${select} w-28`} value={l.level} onChange={(e) => setF({ ...f, languages: f.languages.map((x, j) => (j === i ? { ...x, level: e.target.value as Cefr } : x)) })}>
                  {CEFR.map((c) => <option key={c}>{c}</option>)}
                </select>
                <Button type="button" variant="ghost" onClick={() => setF({ ...f, languages: f.languages.filter((_, j) => j !== i) })}>✕</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setF({ ...f, languages: [...f.languages, { code: "en", level: "B1" }] })}>
              + Agregar idioma
            </Button>
          </div>
        </div>

        <Button type="submit" className="h-11 w-full rounded-full" disabled={saving}>
          {saving ? "Guardando…" : "Guardar y ver mis becas"}
        </Button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
