# Ganz-Repo Code-Audit — Pizza

**Datum:** 2026-07-23
**Scope:** `Frontend/src` (~6.400 LOC, 105 Dateien) + `supabase/functions` (3) + `supabase/migrations` (21)
**Modus:** read-only. Keine Änderung ohne separate Freigabe + Plan.

## Gesamteinschätzung

Das Codebase ist **überraschend gesund**: klare Ordnerstruktur, kleine fokussierte
Dateien (größte 399 LOC), eine dünne konsistente Datenschicht (`store.ts` als einzige
Supabase-Zugriffsstelle mit durchgängigem Row↔Domain-Mapper-Muster), gut getrennte
Pure-Helper (`lib/*` mit 142 Unit-Tests) und eine schlanke Dependency-Liste (16 Runtime-Deps,
kein erkennbarer Ballast). **Ein großflächiger Umbau ist nicht gerechtfertigt** und wäre
bei fehlenden Komponenten-Tests reines Regressionsrisiko.

Der Wert liegt in **wenigen gezielten Eingriffen**. Unten priorisiert nach Nutzen/Risiko.

---

## P1 — Hoher Nutzen, klar abgegrenzt

### 1. Code-Splitting: Admin-Seiten lazy laden (Performance)
`Frontend/src/router.tsx` importiert **alle** Seiten eager (Zeilen 14–26), inkl. der ~13
Admin-Seiten. Kunden laden nie das Admin-UI, bekommen es aber im Initial-Bundle — daher
die 784-kB-Chunk-Warnung beim Build.
**Fix:** Admin-Seiten (und ggf. `AdminLayout`) über `React.lazy` + `<Suspense>` laden.
Halbiert grob das Kunden-Initial-Bundle. Risiko niedrig, rein additiv.

### 2. `setState` während des Renders im Checkout (Korrektheit/Readability)
`Frontend/src/pages/checkout/checkout-page.tsx:65-68` ruft `setServiceMode(...)` direkt im
Render-Body auf (`if (modes.length>0 && !serviceMode) setServiceMode(...)`). Das ist ein
React-Anti-Pattern — löst einen zusätzlichen Render + potenzielle Warnungen aus und macht
den Default-Modus zu verstecktem Seiteneffekt.
**Fix:** In einen `useEffect` (Abhängigkeit `modes`/`specialsOnly`) verschieben oder den
Default rein abgeleitet (`serviceMode ?? modes[0]`) berechnen, ohne State-Write im Render.

---

## P2 — Mittlerer Nutzen

### 3. `checkout-page.tsx` in Abschnitts-Komponenten zerlegen (Struktur)
Mit 399 LOC die größte Datei; vereint Warenkorb-Liste, Kundendaten, Abhol-Auswahl,
Bemerkungen, Gutschein und Preisübersicht in einem `return`. Analog zum gerade gebauten
Einstellungen-Hub ließe sich das in `components/checkout/` aufteilen
(`CartItemsCard`, `CustomerCard`, `PickupCard`, `VoucherCard`, `PriceSummaryCard`) — die
Seite hält State/Logik, die Karten sind präsentational. Verbessert Lesbarkeit + Testbarkeit.
Risiko: mittel (viel JSX-Bewegung, kein Test-Netz) → in kleinen Batches mit Build-Gate.

### 4. DB-Row-Typisierung statt `any` (Readability/Robustheit)
`store.ts:190` (`rowToOrder(r: any)`) und die inline-`(r) => …`-Mapper hantieren mit
untypisierten Supabase-Rows. Fehler in Spaltennamen fallen erst zur Laufzeit auf.
**Fix:** Entweder generierte Supabase-Typen (`supabase gen types typescript`) einbinden oder
je Tabelle ein schmaler `Row`-Typ. Dünner Eingriff, hoher Sicherheitsgewinn. Kein `any` mehr.

---

## P3 — Niedriger Nutzen / optional

### 5. `store.ts` nach Domänen splitten (Struktur, optional)
244 LOC, alle Domänen (Menü, Config, Orders, Special-Items, Users, Notify, Open-Days) in
einer Datei. Cohäsiv (bewusst „eine Zugriffsstelle"), aber wächst. Optionaler Split in
`lib/data/{orders,config,special-items,users}.ts` mit `store.ts` als Barrel. Nur wenn die
Datei weiter wächst — aktuell YAGNI-grenzwertig, **nicht dringend**.

### 6. Toten Code verifizieren (Bloat)
Kein offensichtlicher Ballast gefunden, aber nicht bewiesen. Empfehlung: einmal
`bunx knip` (oder `ts-prune`) laufen lassen, um ungenutzte Exports/Dateien/Deps
faktenbasiert zu bestätigen, statt zu raten. `FavoritePizza`-Typ, `getMenu`-Statik und
`seed.ts` gezielt gegenchecken.

---

## Ausdrücklich NICHT tun

- **Kein Blind-Rewrite** ganzer Bereiche. Das Codebase trägt das nicht als Nutzen, nur als Risiko.
- **Keine neuen Abstraktions-Ebenen** „auf Vorrat" (Repository-Pattern, generische CRUD-Fabrik
  über `store.ts` etc.) — das aktuelle explizite Muster ist lesbar und passt zur Größe.
- **Keine Dependency-Wechsel** (motion, radix) ohne konkreten Anlass.

## Vorgeschlagene Reihenfolge (kleine Batches, je Build + `bun test` als Gate)

1. **#1 Code-Splitting** (isoliert, sofortiger Perf-Gewinn)
2. **#2 Checkout-setState-Fix** (kleiner Korrektheits-Fix)
3. **#4 Row-Typisierung** (Sicherheit, dünn)
4. **#6 knip-Lauf** → ergibt ggf. konkrete Lösch-Liste
5. **#3 Checkout-Zerlegung** (größter Batch, zuletzt, subagent-driven)
6. **#5 store-Split** nur bei Bedarf

Jeder Punkt ist ein eigenes Sub-Projekt (eigener Branch → Merge nach `main`).
