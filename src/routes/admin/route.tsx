import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "login", next: "admin" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    return { user: data.user, isAdmin: !!isAdmin };
  },
  head: () => ({
    meta: [
      { title: "Panel administrativo — BecaMatch" },
      { name: "description", content: "Gestión de becas, conversaciones de WhatsApp y administradores." },
      { property: "og:title", content: "Panel administrativo — BecaMatch" },
      { property: "og:description", content: "Panel de administración de BecaMatch." },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin } = Route.useRouteContext();
  if (!isAdmin)
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-muted-foreground">Esta vista es solo para administradores. Tu cuenta no tiene el rol admin.</p>
      </main>
    );
  const tab = "rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground";
  const active = { className: "bg-secondary text-foreground" };
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-bold">Administración</h1>
        <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent">Datos de demostración</span>
      </div>
      <nav className="mt-4 flex flex-wrap gap-1">
        <Link to="/admin" activeOptions={{ exact: true }} className={tab} activeProps={active}>Becas</Link>
        <Link to="/admin/solicitudes" className={tab} activeProps={active}>Solicitudes</Link>
        <Link to="/admin/whatsapp" className={tab} activeProps={active}>WhatsApp</Link>
        <Link to="/admin/usuarios" className={tab} activeProps={active}>Administradores</Link>
      </nav>
      <Outlet />
    </main>
  );
}
