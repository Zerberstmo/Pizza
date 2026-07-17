// Supabase Edge Function: Sofort-WhatsApp bei Bestellungen mit Sonderartikel.
// Zwei Aufrufwege:
//   1) DB-Trigger (pg_net) mit { "order_id": "#42" } -> genau diese Bestellung
//   2) pg_cron ohne Payload -> Sicherheitsnetz: alle Sonderartikel-Bestellungen der letzten 2 h,
//      die noch kein special_notified_at haben
// formatSpecialAlert ist eine Copy von Frontend/src/lib/special-alert.ts (dort getestet) — synchron halten!
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Zeitfenster des Sicherheitsnetzes: waren Benachrichtigungen länger aus und werden wieder
// eingeschaltet, soll kein Schwall alter Nachrichten rausgehen — Altes altert aus dem Fenster.
const RETRY_WINDOW_MS = 2 * 60 * 60 * 1000;

interface AlertItem {
  kind?: string; name?: string; emoji?: string; pizzaName?: string; quantity?: number;
}
interface SpecialAlertOrder {
  id: string; createdTime: string; customerName: string; customerPhone: string;
  items: AlertItem[]; total: number; serviceMode: "dinein" | "takeaway"; notes: string;
}

function euro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

// Copy von special-alert.ts formatSpecialAlert — synchron halten.
function formatSpecialAlert(o: SpecialAlertOrder): string {
  const specials = o.items.filter((it) => it.kind === "special");
  const pizzas = o.items.filter((it) => it.kind !== "special");
  const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
  const lines = [
    "⭐ Sonderartikel-Bestellung",
    `${o.id} · ${o.createdTime} · ${o.customerName} · ${o.customerPhone}`,
    ...specials.map((it) => `  ${it.emoji ?? "⭐"} ${it.name ?? "?"} × ${it.quantity ?? 1}`),
    ...pizzas.map((it) => `  • ${it.pizzaName ?? "?"} × ${it.quantity ?? 1}`),
    `Gesamt ${euro(o.total)} · ${service}`,
  ];
  if (o.notes.trim()) lines.push(`Notiz: ${o.notes.trim()}`);
  return lines.join("\n");
}

// Uhrzeit "HH:MM" in Europe/Berlin (DST-sicher via IANA-Zone).
function berlinTime(iso: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso));
}

function callmebotUrl(phone: string, apikey: string, text: string): string {
  return `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}`
    + `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
}

Deno.serve(async (req) => {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Config lesen; ohne Empfänger/Key oder disabled → nichts tun und NICHT markieren.
  const { data: cfg, error: cfgErr } = await db.from("notify_config").select("*").eq("id", 1).single();
  if (cfgErr) return new Response(`config error: ${cfgErr.message}`, { status: 500 });
  if (!cfg || !cfg.enabled || !cfg.recipient_phone || !cfg.callmebot_apikey) {
    return new Response("skip: disabled/unconfigured");
  }

  // Trigger schickt { order_id }, Cron ruft ohne Payload.
  let orderId: string | null = null;
  try {
    const body = await req.json();
    orderId = typeof body?.order_id === "string" ? body.order_id : null;
  } catch {
    orderId = null;
  }

  let q = db.from("orders").select("*").is("special_notified_at", null).neq("status", "storniert");
  q = orderId
    ? q.eq("id", orderId)
    : q.gte("created_at", new Date(Date.now() - RETRY_WINDOW_MS).toISOString());

  const { data: rows, error } = await q;
  if (error) return new Response(`db error: ${error.message}`, { status: 500 });

  const targets = (rows ?? []).filter((r) =>
    (r.items ?? []).some((it: AlertItem) => it.kind === "special")
  );
  if (targets.length === 0) return new Response("skip: nothing to notify");

  let sent = 0;
  for (const r of targets) {
    const msg = formatSpecialAlert({
      id: r.id, createdTime: berlinTime(r.created_at), customerName: r.customer_name,
      customerPhone: r.customer_phone, items: r.items ?? [], total: Number(r.total),
      serviceMode: r.service_mode, notes: r.notes ?? "",
    });
    let res: Response;
    try {
      res = await fetch(callmebotUrl(cfg.recipient_phone, cfg.callmebot_apikey, msg));
    } catch {
      continue; // nicht markieren -> Sicherheitsnetz holt es nach
    }
    if (!res.ok) continue; // dito
    // Senden, DANN markieren. Ein Claim vor dem Versand würde bei einem Sendefehler
    // die Bestellung als erledigt markieren und genau den Retry verhindern, den wir wollen.
    await db.from("orders").update({ special_notified_at: new Date().toISOString() }).eq("id", r.id);
    sent++;
  }
  return new Response(`sent: ${sent}/${targets.length}`);
});
