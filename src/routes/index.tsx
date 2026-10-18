import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BecaMatch — Becas compatibles con tu perfil" },
      { name: "description", content: "Crea tu perfil y descubre becas ordenadas por compatibilidad real con tus estudios, idiomas y promedio." },
      { property: "og:title", content: "BecaMatch — Becas compatibles con tu perfil" },
      { property: "og:description", content: "Crea tu perfil y descubre becas ordenadas por compatibilidad." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { n: "01", t: "Crea tu perfil", d: "Nivel, área, idiomas y promedio en escala 0–20." },
  { n: "02", t: "Calculamos tu compatibilidad", d: "Una puntuación clara de 0 a 100, siempre igual con los mismos datos." },
  { n: "03", t: "Explora tu mazo", d: "Becas verificadas y vigentes, ordenadas para ti." },
];

function Landing() {
  return (
    <main>
      <section className="bg-hero">
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:pt-24">
          <p className="mb-4 inline-block rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            Para estudiantes de Latinoamérica
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.05] text-foreground sm:text-6xl">
            La beca correcta, <em className="text-primary">sin buscar a ciegas.</em>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-muted-foreground">
            Cuéntanos quién eres y te mostramos las oportunidades que de verdad encajan contigo.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-full px-8 text-base">
              <Link to="/auth">Crear mi perfil</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="h-12 rounded-full px-8 text-base">
              <Link to="/postular">Quiero postular</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-12 rounded-full">
              <Link to="/auth" search={{ mode: "login" }}>Ya tengo cuenta</Link>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-14 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <span className="font-display text-3xl text-accent">{s.n}</span>
            <h3 className="mt-3 text-xl font-semibold">{s.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
