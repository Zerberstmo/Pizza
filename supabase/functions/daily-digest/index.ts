// Supabase Edge Function (Teil-B3): täglicher WhatsApp-Digest via CallMeBot.
// Von pg_cron stündlich getriggert; sendet nur um 18 Uhr Europe/Berlin.
// formatDigest ist eine Copy von Frontend/src/lib/digest.ts (dort getestet) — synchron halten.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface DigestOrder {
  pickupTime: string; customerName: string; customerPhone: string;
  items: { pizzaName: string }[]; total: number;
  serviceMode: "dinein" | "takeaway"; notes: string;
}

function euro(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function formatDigest(orders: DigestOrder[], dateLabel: string): string {
  if (orders.length === 0) return "";
  const sum = orders.reduce((s, o) => s + o.total, 0);
  const countLabel = `${orders.length} ${orders.length === 1 ? "Bestellung" : "Bestellungen"}`;
  const header = `🍕 Abholungen heute, ${dateLabel}\n${countLabel} · gesamt ${euro(sum)}`;
  const blocks = orders.map((o) => {
    const pc = o.items.length;
    const pizzaLabel = `${pc} ${pc === 1 ? "Pizza" : "Pizzen"}`;
    const service = o.serviceMode === "dinein" ? "Vor Ort" : "Abholen";
    const lines = [
      `${o.pickupTime} · ${o.customerName} · ${o.customerPhone}`,
      `  ${pizzaLabel} · ${euro(o.total)} · ${service}`,
      ...o.items.map((it) => `  • ${it.pizzaName}`),
    ];
    if (o.notes.trim()) lines.push(`  Notiz: ${o.notes.trim()}`);
    return lines.join("\n");
  });
  return `${header}\n\n${blocks.join("\n\n")}`;
}

// Berlin-Datum/Stunde/Label aus "jetzt" ableiten (DST-sicher via IANA-Zeitzone).
function berlinNow(now: Date): { todayIso: string; hour: number; dateLabel: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hour12: false,
    }).formatToParts(now).map((x) => [x.type, x.value]),
  );
  const wd = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "short" }).format(now);
  return {
    todayIso: `${p.year}-${p.month}-${p.day}`,
    hour: parseInt(p.hour, 10),
    dateLabel: `${wd} ${p.day}.${p.month}.`,
  };
}

Deno.serve(async () => {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1) Config lesen; ohne Empfänger/Key oder disabled → nichts tun.
  const { data: cfg } = await db.from("notify_config").select("*").eq("id", 1).single();
  if (!cfg || !cfg.enabled || !cfg.recipient_phone || !cfg.callmebot_apikey) {
    return new Response("skip: disabled/unconfigured");
  }

  // 2) Stunden-Gate (nur 18 Uhr Berlin).
  const { todayIso, hour, dateLabel } = berlinNow(new Date());
  if (hour !== 18) return new Response("skip: not 18:00 Berlin");

  // 3) Idempotenz: heute schon gesendet?
  if (cfg.last_digest_date === todayIso) return new Response("skip: already sent today");

  // 4) Heutige Abholungen laden.
  const { data: rows, error } = await db.from("orders").select("*").eq("pickup_date", todayIso);
  if (error) return new Response(`db error: ${error.message}`, { status: 500 });

  const orders: DigestOrder[] = (rows ?? [])
    .map((r) => ({
      pickupTime: r.pickup_time, customerName: r.customer_name, customerPhone: r.customer_phone,
      items: r.items ?? [], total: Number(r.total),
      serviceMode: r.service_mode, notes: r.notes ?? "",
    }))
    .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));

  // 5) 0 Bestellungen → nicht senden, aber Datum markieren (kein Retry).
  if (orders.length === 0) {
    await db.from("notify_config").update({ last_digest_date: todayIso }).eq("id", 1);
    return new Response("skip: no pickups today");
  }

  // 6) Senden. Bei CallMeBot-Fehler last_digest_date NICHT setzen → nächster Lauf (bis 18:59) versucht erneut.
  const message = formatDigest(orders, dateLabel);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cfg.recipient_phone)}`
    + `&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(cfg.callmebot_apikey)}`;
  const res = await fetch(url);
  if (!res.ok) return new Response(`callmebot error: ${res.status}`, { status: 502 });

  await db.from("notify_config").update({ last_digest_date: todayIso }).eq("id", 1);
  return new Response(`sent: ${orders.length} Bestellungen`);
});
