import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { linkWhatsapp } from "@/lib/whatsapp.functions";

export const Route = createFileRoute("/whatsapp/vincular")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ t: typeof s.t === "string" ? s.t : undefined }),
  head: () => ({
    meta: [
      { title: "Vincular WhatsApp — BecaMatch" },
      { name: "description", content: "Vincula tu número de WhatsApp con tu cuenta de BecaMatch." },
      { property: "og:title", content: "Vincular WhatsApp — BecaMatch" },
      { property: "og:description", content: "Confirma tu número y guarda la beca consultada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Vincular,
});

type Info = { phone: string; scholarship: string | null; done: boolean };

function Vincular() {
  const { t } = Route.useSearch();
  const link = useServerFn(linkWhatsapp);
  const [token, setToken] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const tk = t ?? localStorage.getItem("wa_link_token");
    if (tk) localStorage.setItem("wa_link_token", tk);
    setToken(tk);
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
  }, [t]);

  useEffect(() => {
    if (!signedIn || !token) return;
    link({ data: { token, confirm: false } }).then((r) => (r.ok ? setInfo(r) : setError(r.error))).catch(() => setError("No se pudo validar el enlace."));
  }, [signedIn, token, link]);

  async function confirm() {
    if (!token) return;
    setBusy(true);
    try {
      const r = await link({ data: { token, confirm: true } });
      if (r.ok) { setInfo(r); localStorage.removeItem("wa_link_token"); } else setError(r.error);
    } catch { setError("No se pudo completar la vinculación."); }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="font-display text-2xl font-bold">Vincular WhatsApp</h1>
        {!token && <p className="mt-3 text-muted-foreground">Falta el enlace. Escribe GUARDAR en WhatsApp para recibir uno nuevo.</p>}
        {token && signedIn === false && (
          <>
            <p className="mt-3 text-muted-foreground">Inicia sesión o crea tu cuenta para vincular tu número y guardar la beca.</p>
            <Link to="/auth" className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground">Ingresar o registrarme</Link>
          </>
        )}
        {error && <p className="mt-3 text-destructive">{error}</p>}
        {info && !info.done && (
          <>
            <p className="mt-3 text-muted-foreground">Número: <b className="text-foreground">{info.phone}</b></p>
            {info.scholarship && <p className="mt-1 text-muted-foreground">Beca pendiente de guardar: <b className="text-foreground">{info.scholarship}</b></p>}
            <button onClick={confirm} disabled={busy} className="mt-5 rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-60">
              {busy ? "Vinculando…" : "Confirmar vinculación y guardar"}
            </button>
          </>
        )}
        {info?.done && (
          <>
            <p className="mt-3">✅ Número vinculado{info.scholarship ? ` y «${info.scholarship}» guardada` : ""}.</p>
            <Link to="/mis-becas" className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-foreground">Ver Mis becas</Link>
          </>
        )}
      </div>
    </main>
  );
}
