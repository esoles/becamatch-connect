import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAdminUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Administradores — Panel BecaMatch" },
      { name: "description", content: "Crear cuentas de administrador." },
      { property: "og:title", content: "Administradores — Panel BecaMatch" },
      { property: "og:description", content: "Crear cuentas de administrador." },
    ],
  }),
  component: Usuarios,
});

function Usuarios() {
  const create = useServerFn(createAdminUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Mínimo 8 caracteres"); return; }
    setBusy(true);
    try {
      const r = await create({ data: { email, password } });
      if (r.ok) { toast.success(`Administrador creado: ${r.email}`); setEmail(""); setPassword(""); }
      else toast.error(r.error);
    } catch { toast.error("No se pudo crear el administrador."); }
    setBusy(false);
  }
  return (
    <section className="mt-6 max-w-sm">
      <h2 className="font-display text-2xl font-bold">Nuevo administrador</h2>
      <p className="mt-1 text-sm text-muted-foreground">Las cuentas creadas aquí tienen el rol admin. Podrán ingresar con este correo y contraseña, o con Google si usan el mismo correo.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="space-y-1.5"><Label htmlFor="a-email">Email</Label><Input id="a-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="space-y-1.5"><Label htmlFor="a-pw">Contraseña</Label><Input id="a-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <Button type="submit" className="h-11 w-full rounded-full" disabled={busy}>{busy ? "Creando…" : "Crear administrador"}</Button>
      </form>
    </section>
  );
}
