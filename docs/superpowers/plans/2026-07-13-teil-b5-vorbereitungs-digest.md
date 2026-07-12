# Teil-B5 — Vorbereitungs-/Einkaufs-Digest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der 18-Uhr-`daily-digest`-Lauf schickt zusätzlich zum Tages-Digest eine Einkaufs-/Vorbereitungsliste für den nächsten Tag (aggregierte Zutaten/Soßen + Teiganzahl), falls es für morgen Bestellungen gibt.

**Architecture:** Erweiterung der B3-Edge-Function `daily-digest`: neue reine Funktion `formatPrepList` in `digest.ts` (getestet), ein zweiter, idempotenter Block in der Edge Function (`last_prep_date`-Merker), Namensauflösung über `ingredients`/`sauces`. Kein neuer Cron, keine `app_config`-Prüfung (Bestellungen für morgen ⇒ morgen offen, dank B4-Trigger).

**Tech Stack:** Supabase (Postgres, Edge Functions/Deno), CallMeBot, Bun, Vite, React 18, TS. Tests: bun:test.

## Global Constraints

- **Umgebung erreicht Supabase/CallMeBot NICHT.** Jeder Task verifiziert NUR `cd Frontend && bun run build` + `cd Frontend && bun test src`. Migration/Edge werden geschrieben, NICHT ausgeführt (Betreiber testet real).
- Bun. Build/Test aus `Frontend/`.
- **Taktung:** Vorabend, 18 Uhr Europe/Berlin (im bestehenden `daily-digest`-Lauf). Fest, nicht konfigurierbar.
- **Auslöser:** Bestellungen mit `pickup_date = morgen` (Berlin). 0 → keine Vorbereitungs-Nachricht.
- **Idempotenz:** zweiter Merker `notify_config.last_prep_date` (unabhängig von `last_digest_date`); bei CallMeBot-/DB-Fehler NICHT setzen (Retry im nächsten stündlichen Lauf).
- **Format:** `🧾 Einkauf/Vorbereitung für morgen, {dateLabel}` + `{n} Pizzen (= {n} Teige)` (Einzahl „1 Pizza (= 1 Teig)") + Abschnitte `Zutaten:` / `Soßen:` mit `  {Anzahl}× {Name}`, Anzahl absteigend dann Name aufsteigend; leere Abschnitte weglassen; unbekannte id → Fallback auf die id.
- **Deliberate Duplication:** `formatPrepList` existiert doppelt (getestete `digest.ts` + Deno-Copy in der Edge Function), wie schon `formatDigest` — Deno kann den `@/`-Graphen nicht importieren. Sync-Kommentar in beiden.
- **Referenz-Spec:** `docs/superpowers/specs/2026-07-13-teil-b5-vorbereitungs-digest-design.md`.
- Doku-Task (Task 4) am Ende; Build nach jedem Task grün. Implementer NICHT Fable.

---

## Dateistruktur (Ziel)

```
Frontend/src/lib/digest.ts                    (M) +PrepItem/PrepOrder/formatPrepList
Frontend/src/lib/__tests__/digest.test.ts     (M) +formatPrepList-Tests
supabase/migrations/0008_prep_digest.sql      (N) notify_config.last_prep_date
supabase/functions/daily-digest/index.ts      (M) Handler-Umbau: 2. Block + Deno-Copy formatPrepList
Doku/... , Changelog/README                   (M) Doku (Task 4)
```

---

### Task 1: `formatPrepList` + Tests (`digest.ts`)

**Files:**
- Modify: `Frontend/src/lib/digest.ts`
- Modify: `Frontend/src/lib/__tests__/digest.test.ts`

**Interfaces:**
- Produces:
  - `interface PrepItem { ingredientIds: string[]; sauceId?: string }`
  - `interface PrepOrder { items: PrepItem[] }`
  - `formatPrepList(orders: PrepOrder[], ingredientNames: Record<string,string>, sauceNames: Record<string,string>, dateLabel: string): string`

- [ ] **Step 1: Tests anhängen** (`Frontend/src/lib/__tests__/digest.test.ts`)

Den Import um die neuen Symbole erweitern und den Testblock ans Dateiende einfügen. Falls die bestehende Import-Zeile `type DigestOrder` importiert, ergänze `formatPrepList, type PrepOrder`:

```ts
import { formatPrepList, type PrepOrder } from "@/lib/digest";

const ingNames = { i_sal: "Salami", i_mush: "Champignons", i_pap: "Paprika" };
const sauNames = { s_tom: "Tomate", s_bbq: "BBQ" };

describe("formatPrepList", () => {
  it("leeres Array → leerer String", () => {
    expect(formatPrepList([], ingNames, sauNames, "Fr 13.07.")).toBe("");
  });
  it("aggregiert Zutaten/Soßen und zählt Teige", () => {
    const orders: PrepOrder[] = [
      { items: [ { ingredientIds: ["i_sal", "i_mush"], sauceId: "s_tom" }, { ingredientIds: ["i_sal"], sauceId: "s_bbq" } ] },
      { items: [ { ingredientIds: ["i_sal", "i_pap"], sauceId: "s_tom" } ] },
    ];
    const msg = formatPrepList(orders, ingNames, sauNames, "Fr 13.07.");
    expect(msg).toContain("🧾 Einkauf/Vorbereitung für morgen, Fr 13.07.");
    expect(msg).toContain("3 Pizzen (= 3 Teige)");
    expect(msg).toContain("3× Salami");
    expect(msg).toContain("1× Champignons");
    expect(msg).toContain("1× Paprika");
    expect(msg).toContain("2× Tomate");
    expect(msg).toContain("1× BBQ");
  });
  it("Sortierung: Menge desc, dann Name asc; leerer Soßen-Abschnitt weggelassen", () => {
    const orders: PrepOrder[] = [
      { items: [ { ingredientIds: ["i_pap", "i_mush"] }, { ingredientIds: ["i_mush"] } ] },
    ];
    const msg = formatPrepList(orders, ingNames, sauNames, "Fr 13.07.");
    expect(msg.indexOf("Champignons")).toBeLessThan(msg.indexOf("Paprika"));
    expect(msg).not.toContain("Soßen:");
  });
  it("unbekannte id → Fallback auf die id", () => {
    const orders: PrepOrder[] = [{ items: [{ ingredientIds: ["i_unknown"] }] }];
    expect(formatPrepList(orders, ingNames, sauNames, "Fr 13.07.")).toContain("1× i_unknown");
  });
  it("Einzahl bei genau einer Pizza", () => {
    const orders: PrepOrder[] = [{ items: [{ ingredientIds: ["i_sal"], sauceId: "s_tom" }] }];
    expect(formatPrepList(orders, ingNames, sauNames, "Fr 13.07.")).toContain("1 Pizza (= 1 Teig)");
  });
});
```

- [ ] **Step 2: Tests laufen lassen → FAIL**

Run: `cd Frontend && bun test src/lib/__tests__/digest.test.ts`
Expected: FAIL (`formatPrepList`/`PrepOrder` nicht exportiert).

- [ ] **Step 3: `formatPrepList` + Typen implementieren** (`Frontend/src/lib/digest.ts`, ans Ende anfügen)

```ts
export interface PrepItem { ingredientIds: string[]; sauceId?: string }
export interface PrepOrder { items: PrepItem[] }

// Aggregierte Einkaufs-/Vorbereitungsliste für einen Tag (Teil-B5). Rein & deterministisch;
// die Edge Function spiegelt diese Funktion als Deno-Copy — bei Änderungen synchron halten.
export function formatPrepList(
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
```

- [ ] **Step 4: Tests → PASS**

Run: `cd Frontend && bun test src/lib/__tests__/digest.test.ts`
Expected: alle grün.

- [ ] **Step 5: Voller Build + Suite grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; alle Tests grün.

- [ ] **Step 6: Commit**

```bash
git add Frontend/src/lib/digest.ts Frontend/src/lib/__tests__/digest.test.ts
git commit -m "feat(b5): formatPrepList (Einkaufs-/Vorbereitungsliste) mit Tests"
```

---

### Task 2: Migration `0008_prep_digest.sql`

**Files:**
- Create: `supabase/migrations/0008_prep_digest.sql`

> Reines SQL, berührt den Build nicht, hier nicht ausführbar.

- [ ] **Step 1: Migration schreiben** (`supabase/migrations/0008_prep_digest.sql`)

```sql
-- Teil-B5: zweiter Idempotenz-Merker für die Vorbereitungsliste (unabhängig von last_digest_date).
alter table public.notify_config add column if not exists last_prep_date date;
```

- [ ] **Step 2: Build → grün** (Sanity)

Run: `cd Frontend && bun run build`
Expected: unverändert grün.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_prep_digest.sql
git commit -m "feat(b5): Migration 0008 — notify_config.last_prep_date"
```

---

### Task 3: Edge Function — zweiter Block (Vorbereitungsliste)

**Files:**
- Modify: `supabase/functions/daily-digest/index.ts`

**Interfaces:**
- Consumes: `notify_config` (jetzt mit `last_prep_date`), `orders`, `ingredients(id,name)`, `sauces(id,name)`.

> Deno; berührt den Build nicht, hier nicht ausführbar. Review = Handler-Logik. Der Handler wird umgebaut, damit beide Blöcke (Tages-Digest + Vorbereitung) im selben 18-Uhr-Lauf unabhängig laufen; die `formatPrepList`-Copy muss `digest.ts` exakt spiegeln.

- [ ] **Step 1: `index.ts` durch die folgende Fassung ersetzen** (kompletter Datei-Inhalt)

```ts
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
      const [{ data: ingRows }, { data: sauceRows }] = await Promise.all([
        db.from("ingredients").select("id, name"),
        db.from("sauces").select("id, name"),
      ]);
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
```

- [ ] **Step 2: Build → grün** (Sanity — Edge Function berührt den Build nicht)

Run: `cd Frontend && bun run build`
Expected: unverändert grün.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/daily-digest/index.ts
git commit -m "feat(b5): daily-digest sendet zusätzlich Vorbereitungsliste für morgen"
```

---

### Task 4: Doku & Verifikation

**Files:**
- Modify: `Doku/Pizza/Changelog.md`, `Doku/Pizza/Entscheidungen/ADR-0003-whatsapp-callmebot.md`, `Frontend/README.md`, `Doku/Pizza/TODO.md`

> Doku gebündelt am Ende.

- [ ] **Step 1: Gesamt-Verifikation**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; Tests grün.

- [ ] **Step 2: Doku aktualisieren**

- `Doku/Pizza/Changelog.md` (2026-07-13, oben): „Teil-B5: Vorbereitungs-/Einkaufs-Digest — der 18-Uhr-`daily-digest`-Lauf schickt zusätzlich eine Liste für morgen (aggregierte Zutaten/Soßen je Anzahl Pizzen + Teiganzahl), falls Bestellungen für morgen existieren; idempotent über `notify_config.last_prep_date` (Migration 0008). Reine Logik `formatPrepList` getestet; Edge-Copy synchron. Nur Build/Tests verifiziert; Betreiber führt 0008 aus."
- `Doku/Pizza/Entscheidungen/ADR-0003-whatsapp-callmebot.md`: kurzen Hinweis ergänzen, dass `daily-digest` nun **zwei** Nachrichten sendet (Tages-Digest + Vorbereitungsliste für morgen).
- `Frontend/README.md` (Abschnitt „Bestellungen: … Digest"): ergänzen, dass zusätzlich eine Vorbereitungs-/Einkaufsliste für den nächsten Tag verschickt wird.
- `Doku/Pizza/TODO.md`: Zeile „Teil-B5 (Vorbereitungs-Digest) — erledigt"; Betreiber-Setup-Punkt um „Migration 0008" ergänzen.

- [ ] **Step 3: Commit**

```bash
git add Doku/ Frontend/README.md
git commit -m "docs(b5): Changelog/ADR-0003/README/TODO (Vorbereitungs-Digest)"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** `formatPrepList` + Tests (Aggregation/Sortierung/Fallback/Einzahl/leere Abschnitte/leer→"") → T1; `last_prep_date` → T2; zweiter Edge-Block (morgen-Orders, 0→kein Versand, Namensauflösung, Idempotenz, Fehler→kein Merker, Deno-Copy) → T3; Doku → T4. Nicht-Ziele (kein Chatbot, keine konfigurierbare Zeit, Tages-Digest unverändert im Verhalten) eingehalten.
- **Grün ohne Supabase:** T1 rein testbar; T2/T3 (SQL/Deno) berühren den Vite-Build nicht; T4 Doku + Verifikation.
- **Typ-Konsistenz:** `PrepItem`/`PrepOrder`/`formatPrepList` in T1 definiert und in T3 (Deno-Copy) feldgleich; `last_prep_date` in T2 angelegt und in T3 gelesen/geschrieben; `berlinNow` wird für morgen mit `now+86_400_000` wiederverwendet (liefert `todayIso`/`dateLabel` für morgen).
- **Verhalten Tages-Digest:** durch den Handler-Umbau unverändert (gleiche Bedingungen/Fehlerpfade); nur die frühen `return`s der Erfolgs-/Skip-Fälle werden zu `status.push` + Weiterlaufen, damit der zweite Block dran kommt. CallMeBot-/DB-Fehler brechen weiterhin früh ab (Retry).
- **Platzhalter:** keine.
- **Bewusste Duplizierung:** `formatPrepList` doppelt (digest.ts + Deno-Copy), Sync-Kommentar in beiden.
