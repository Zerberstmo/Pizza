// Supabase Edge Function (Teil-B3/B5): täglicher WhatsApp-Digest + Vorbereitungsliste via CallMeBot.
// Von pg_cron stündlich getriggert; sendet nur um 18 Uhr Europe/Berlin.
// formatDigest/formatPrepList sind Copies von Frontend/src/lib/digest.ts (dort getestet) — synchron halten.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface DigestOrder {
  pickupTime: string; customerName: string; customerPhone: string;
  items: { pizzaName: string }[]; total: number;
  serviceMode: "dinein" | "takeaway"; notes: string;
}
interface PrepItem { ingredientIds: string[]; sauceId?: string }
interface PrepOrder { items: PrepItem[] }

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

// Copy von digest.ts formatPrepList — synchron halten.
function formatPrepList(
  orders: PrepOrder[],
  ingredientNames: Record<string, string>,
  sauceNames: Record<string, string>,
  dateLabel: string,
): string {
  if (orders.length === 0) return "";
  let doughCount = 0;
  const ing: Record<string, number> = {};
  const sau: Record<string, number> = {};
  for (const o of orders) {
    for (const it of o.items) {
      doughCount++;
      for (const id of it.ingredientIds) ing[id] = (ing[id] ?? 0) + 1;
      if (it.sauceId) sau[it.sauceId] = (sau[it.sauceId] ?? 0) + 1;
    }
  }
  const section = (title: string, counts: Record<string, number>, names: Record<string, string>): string => {
    const entries = Object.entries(counts);
    if (entries.length === 0) return "";
    const lines = entries
      .map(([id, c]) => ({ name: names[id] ?? id, c }))
      .sort((a, b) => b.c - a.c || a.name.localeCompare(b.name))
      .map((e) => `  ${e.c}× ${e.name}`);
    return `\n\n${title}:\n${lines.join("\n")}`;
  };
  const doughLabel = `${doughCount} ${doughCount === 1 ? "Pizza" : "Pizzen"} (= ${doughCount} ${doughCount === 1 ? "Teig" : "Teige"})`;
  const header = `🧾 Einkauf/Vorbereitung für morgen, ${dateLabel}\n${doughLabel}`;
  return header + section("Zutaten", ing, ingredientNames) + section("Soßen", sau, sauceNames);
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

function callmebotUrl(phone: string, apikey: string, text: string): string {
  return `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}`
    + `&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(apikey)}`;
}

Deno.serve(async () => {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Config lesen; ohne Empfänger/Key oder disabled → nichts tun.
  const { data: cfg, error: cfgErr } = await db.from("notify_config").select("*").eq("id", 1).single();
  if (cfgErr) return new Response(`config error: ${cfgErr.message}`, { status: 500 });
  if (!cfg || !cfg.enabled || !cfg.recipient_phone || !cfg.callmebot_apikey) {
    return new Response("skip: disabled/unconfigured");
  }

  // Stunden-Gate (nur 18 Uhr Berlin) — gilt für beide Blöcke.
  const now = new Date();
  const { todayIso, hour, dateLabel } = berlinNow(now);
  if (hour !== 18) return new Response("skip: not 18:00 Berlin");

  const status: string[] = [];

  // ── 1) Tages-Digest: heutige Abholungen ──
  if (cfg.last_digest_date === todayIso) {
    status.push("digest: already sent");
  } else {
    const { data: rows, error } = await db.from("orders").select("*").eq("pickup_date", todayIso);
    if (error) return new Response(`db error: ${error.message}`, { status: 500 });
    const orders: DigestOrder[] = (rows ?? [])
      .map((r) => ({
        pickupTime: r.pickup_time, customerName: r.customer_name, customerPhone: r.customer_phone,
        items: r.items ?? [], total: Number(r.total),
        serviceMode: r.service_mode, notes: r.notes ?? "",
      }))
      .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));
    if (orders.length === 0) {
      await db.from("notify_config").update({ last_digest_date: todayIso }).eq("id", 1);
      status.push("digest: no pickups");
    } else {
      const msg = formatDigest(orders, dateLabel);
      let res: Response;
      try { res = await fetch(callmebotUrl(cfg.recipient_phone, cfg.callmebot_apikey, msg)); }
      catch (e) { return new Response(`callmebot fetch failed: ${e}`, { status: 502 }); }
      if (!res.ok) return new Response(`callmebot error: ${res.status}`, { status: 502 });
      const { error: markErr } = await db.from("notify_config").update({ last_digest_date: todayIso }).eq("id", 1);
      if (markErr) return new Response(`digest sent but mark failed: ${markErr.message}`, { status: 500 });
      status.push(`digest: sent ${orders.length}`);
    }
  }

  // ── 2) Vorbereitungsliste: morgige Abholungen (nur falls vorhanden) ──
  const tomorrow = berlinNow(new Date(now.getTime() + 86_400_000)); // +24h → morgen (Berlin)
  if (cfg.last_prep_date === tomorrow.todayIso) {
    status.push("prep: already sent");
  } else {
    const { data: prepRows, error: prepErr } = await db.from("orders").select("items").eq("pickup_date", tomorrow.todayIso);
    if (prepErr) return new Response(`prep db error: ${prepErr.message}`, { status: 500 });
    const prepOrders: PrepOrder[] = (prepRows ?? []).map((r) => ({ items: r.items ?? [] }));
    const doughCount = prepOrders.reduce((s, o) => s + o.items.length, 0);
    if (doughCount === 0) {
      status.push("prep: nothing for tomorrow"); // Merker NICHT setzen
    } else {
      const [{ data: ingRows, error: ingErr }, { data: sauceRows, error: sauceErr }] = await Promise.all([
        db.from("ingredients").select("id, name"),
        db.from("sauces").select("id, name"),
      ]);
      // Namen-Fehler: abbrechen OHNE zu senden/markieren, sonst ginge die Nachricht mit rohen IDs raus
      // und last_prep_date würde den Retry verhindern.
      if (ingErr || sauceErr) return new Response(`prep names error: ${ingErr?.message ?? sauceErr?.message}`, { status: 500 });
      const ingredientNames = Object.fromEntries((ingRows ?? []).map((r) => [r.id, r.name]));
      const sauceNames = Object.fromEntries((sauceRows ?? []).map((r) => [r.id, r.name]));
      const prepMsg = formatPrepList(prepOrders, ingredientNames, sauceNames, tomorrow.dateLabel);
      let prepRes: Response;
      try { prepRes = await fetch(callmebotUrl(cfg.recipient_phone, cfg.callmebot_apikey, prepMsg)); }
      catch (e) { return new Response(`prep fetch failed: ${e}`, { status: 502 }); }
      if (!prepRes.ok) return new Response(`prep callmebot error: ${prepRes.status}`, { status: 502 });
      const { error: pMarkErr } = await db.from("notify_config").update({ last_prep_date: tomorrow.todayIso }).eq("id", 1);
      if (pMarkErr) return new Response(`prep sent but mark failed: ${pMarkErr.message}`, { status: 500 });
      status.push(`prep: sent ${doughCount} Teige`);
    }
  }

  return new Response(status.join(" | "));
});
