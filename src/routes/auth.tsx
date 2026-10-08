import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: s.mode === "login" ? ("login" as const) : undefined }),
  head: () => ({
    meta: [
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

function AuthPage() {
  const { mode } = Route.useSearch();
  const [isLogin, setIsLogin] = useState(mode === "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      setLoading(false);
      if (error) return toast.error("No pudimos ingresar. Revisa tus datos.");
      navigate({ to: "/perfil" });
    } else {
      const { data, error } = await supabase.auth.signUp({
        ...parsed.data,
        options: { emailRedirectTo: `${window.location.origin}/perfil` },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      if (data.session) navigate({ to: "/perfil" });
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
            <h1 className="text-2xl font-bold">{isLogin ? "Ingresar" : "Crea tu cuenta"}</h1>
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
            <button className="mt-4 w-full text-center text-sm text-muted-foreground underline" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Ingresa"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
