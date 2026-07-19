// Supabase Edge Function: privilegierte Admin-Aktionen (service_role).
// Prüft, dass der Aufrufer ein aktiver Admin ist, bevor irgendetwas passiert.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

// CORS: nur das Frontend (Produktion + lokale Entwicklung + Vercel-Preview-Deploys) statt "*".
const ALLOWED_ORIGINS = [
  "https://pizza-self-pi.vercel.app", // Produktions-Frontend
  "http://localhost:5173",            // lokale Entwicklung (Vite)
];
const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+-zerberstmos\.vercel\.app$/; // Vercel-Preview-Deploys

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && (ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const asStr = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const isEmail = (s: string): boolean => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
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

  // 3) Aktion ausführen (mit Eingabe-Validierung als Defense-in-Depth).
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "create") {
      const email = asStr(body.email);
      const password = asStr(body.password);
      const firstName = asStr(body.firstName);
      const lastName = asStr(body.lastName);
      const phone = asStr(body.phone);
      const role = body.role === "admin" ? "admin" : "customer";
      if (!isEmail(email)) return json({ error: "Ungültige E-Mail." }, 400);
      if (password.length < 6) return json({ error: "Passwort zu kurz (min. 6 Zeichen)." }, 400);

      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName, phone },
      });
      if (error) return json({ error: error.message }, 400);
      // Rolle/Details explizit setzen: der handle_new_user-Trigger erzwingt role='customer';
      // service_role darf sie via protect_profile_columns-Trigger ändern.
      const { error: pErr } = await admin.from("profiles").update({
        first_name: firstName, last_name: lastName, phone, role, active: true,
      }).eq("id", created.user!.id);
      if (pErr) {
        // Rollback: keinen verwaisten Auth-User zurücklassen, wenn das Profil-Update scheitert.
        await admin.auth.admin.deleteUser(created.user!.id);
        return json({ error: pErr.message }, 400);
      }
      return json({ ok: true });
    }
    if (body.action === "delete") {
      const userId = asStr(body.userId);
      if (!userId) return json({ error: "userId fehlt." }, 400);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (body.action === "reset") {
      const userId = asStr(body.userId);
      const password = asStr(body.password);
      if (!userId) return json({ error: "userId fehlt." }, 400);
      if (password.length < 6) return json({ error: "Passwort zu kurz (min. 6 Zeichen)." }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "Unbekannte Aktion." }, 400);
  } catch (e) {
    console.error("admin-users action failed", e);
    return json({ error: "Interner Fehler." }, 500);
  }
});
