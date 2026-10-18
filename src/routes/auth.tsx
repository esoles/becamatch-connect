import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: "login"; next?: "admin" } => ({
    ...(s["mode"] === "login" ? { mode: "login" as const } : {}),
    ...(s["next"] === "admin" ? { next: "admin" as const } : {}),
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Crear cuenta — BecaMatch" },
      { name: "description", content: "Regístrate o ingresa a BecaMatch para ver tus becas compatibles." },
      { property: "og:title", content: "Crear cuenta — BecaMatch" },
      { property: "og:description", content: "Regístrate o ingresa a BecaMatch." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});

// Where to go after signing in. Access to /admin is still decided by the user's real role there.
function destination(): "/admin" | "/whatsapp/vincular" | "/perfil" {
  if (sessionStorage.getItem("post_login") === "admin") return "/admin";
  if (localStorage.getItem("wa_link_token")) return "/whatsapp/vincular";
  return "/perfil";
}

function AuthPage() {
  const { mode, next } = Route.useSearch();
  const [isLogin, setIsLogin] = useState(mode === "login" || next === "admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (next === "admin") sessionStorage.setItem("post_login", "admin");
    // Returning from Google: once the session exists, continue to the intended page.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { const to = destination(); sessionStorage.removeItem("post_login"); navigate({ to }); }
    });
  }, [next, navigate]);

  async function google() {
    setLoading(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/auth` });
    if (r.redirected) return;
    setLoading(false);
    if (r.error) { toast.error("No pudimos ingresar con Google."); return; }
    const to = destination(); sessionStorage.removeItem("post_login"); navigate({ to });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message); return; }
    setLoading(true);
    const to = destination();
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      setLoading(false);
      if (error) { toast.error("No pudimos ingresar. Revisa tus datos."); return; }
      sessionStorage.removeItem("post_login");
      navigate({ to });
    } else {
      const { data, error } = await supabase.auth.signUp({
        ...parsed.data,
        options: { emailRedirectTo: `${window.location.origin}${to === "/admin" ? "/perfil" : to}` },
      });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) navigate({ to: to === "/admin" ? "/perfil" : to });
      else setSent(true);
    }
  }

  return (
    <main className="bg-hero min-h-[calc(100vh-57px)] px-4 py-12">
      <div className="mx-auto max-w-sm rounded-2xl border border-border bg-card p-6 shadow-card">
        {sent ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Te enviamos un enlace a {email}. Ábrelo para confirmar tu cuenta y completar tu perfil.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{next === "admin" ? "Ingreso administrativo" : isLogin ? "Ingresar" : "Crea tu cuenta"}</h1>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Contraseña</Label>
                <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="h-11 w-full rounded-full" disabled={loading}>
                {loading ? "Un momento…" : isLogin ? "Ingresar" : "Crear cuenta"}
              </Button>
            </form>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" /></div>
            <Button type="button" variant="outline" className="h-11 w-full rounded-full" disabled={loading} onClick={google}>
              Continuar con Google
            </Button>
            <button className="mt-4 w-full text-center text-sm text-muted-foreground underline" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Ingresa"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
