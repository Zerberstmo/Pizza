// Supabase Edge Function: privilegierte Admin-Aktionen (service_role).
// Prüft, dass der Aufrufer ein aktiver Admin ist, bevor irgendetwas passiert.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  // 1) Aufrufer authentifizieren (JWT aus Authorization-Header).
  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await caller.auth.getUser();
  if (!userData.user) return json({ error: "Nicht angemeldet." }, 401);

  // 2) Admin-Check über service_role (RLS-frei).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: prof } = await admin.from("profiles").select("role, active").eq("id", userData.user.id).single();
  if (!prof || prof.role !== "admin" || !prof.active) return json({ error: "Kein Admin." }, 403);

  // 3) Aktion ausführen.
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "create") {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: body.email, password: body.password, email_confirm: true,
        user_metadata: { first_name: body.firstName ?? "", last_name: body.lastName ?? "", phone: body.phone ?? "" },
      });
      if (error) return json({ error: error.message }, 400);
      // Rolle/Details explizit setzen: der handle_new_user-Trigger erzwingt role='customer';
      // service_role darf sie via protect_profile_columns-Trigger ändern.
      const { error: pErr } = await admin.from("profiles").update({
        first_name: body.firstName ?? "", last_name: body.lastName ?? "", phone: body.phone ?? "",
        role: body.role ?? "customer", active: true,
      }).eq("id", created.user!.id);
      if (pErr) {
        // Rollback: keinen verwaisten Auth-User zurücklassen, wenn das Profil-Update scheitert.
        await admin.auth.admin.deleteUser(created.user!.id);
        return json({ error: pErr.message }, 400);
      }
      return json({ ok: true });
    }
    if (body.action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(body.userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (body.action === "reset") {
      const { error } = await admin.auth.admin.updateUserById(body.userId, { password: body.password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "Unbekannte Aktion." }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
