import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  useLocation,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { AccountMenu } from "@/components/account-menu";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">La página no cargó</h1>
        <p className="mt-2 text-sm text-muted-foreground">Algo salió mal. Intenta de nuevo.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BecaMatch" },
      { name: "description", content: "Encuentra becas compatibles con tu perfil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Header() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const checkRole = async (userId: string | undefined) => {
      if (!userId) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    };
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      void checkRole(data.session?.user.id);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSignedIn(!!s);
      void checkRole(s?.user.id);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  const link = "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground whitespace-nowrap";
  const active = { className: "bg-secondary text-foreground" };
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="font-display text-xl font-bold text-primary">
          Beca<span className="text-accent">Match</span>
        </Link>
        <div className="flex items-center gap-1">
          {signedIn ? <AccountMenu isAdmin={isAdmin} /> : <Link to="/auth" className={link} activeProps={active}>Ingresar</Link>}
        </div>
        {signedIn && <div className="order-last flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {signedIn ? (
            <>
              <Link to="/mazo" className={link} activeProps={active}>Descubrir becas</Link>
              <Link to="/mis-becas" className={link} activeProps={active}>Mis becas</Link>
              <Link to="/asistente" search={{ beca: undefined }} className={link} activeProps={active}>Asistente IA</Link>
              <Link to="/perfil" className={link} activeProps={active}>Mi perfil</Link>
            </>
          ) : (
            <Link to="/auth" className={link} activeProps={active}>Ingresar</Link>
          )}
        </div>}
      </nav>
    </header>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      else queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Header />
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
