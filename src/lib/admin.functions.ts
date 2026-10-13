import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

/** Creates an administrator account. Only callable by an existing admin (role checked server-side). */
export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { ok: false as const, error: "Solo un administrador puede crear administradores." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
    });
    if (error || !created.user) return { ok: false as const, error: error?.message ?? "No se pudo crear la cuenta." };
    const uid = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid).eq("role", "student");
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "admin" });
    if (rErr) return { ok: false as const, error: "Cuenta creada, pero no se pudo asignar el rol admin." };
    return { ok: true as const, email: data.email };
  });
