# Dashboard-Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Admin kann die Dashboard-Statistik auf einen weichen Reset-Zeitpunkt zurücksetzen (ab dann zählt das Dashboard), ohne Bestellungen, Historie oder Digest zu verändern.

**Architecture:** Eine neue Spalte `app_config.dashboard_reset_at` (nullable timestamptz) hält den Reset-Punkt. `getDashboardStats` filtert die Bestellungen serverseitig per `.gte("created_at", resetAt)`, wenn gesetzt; die Aggregation `computeDashboard` bleibt unangetastet. Eine neue Admin-Seite „Einstellungen" (`/admin/einstellungen`) setzt den Punkt per zweistufigem Inline-Confirm bzw. stellt auf all-time (`null`) zurück.

**Tech Stack:** TypeScript/React/Vite, Tailwind + shadcn/ui, **Bun** (`bun:test`), Supabase (Postgres/RLS), react-router.

**Spec:** `docs/superpowers/specs/2026-07-14-dashboard-reset-design.md`

## Global Constraints

- **Nicht destruktiv:** Reset setzt/löscht nur `dashboard_reset_at`. Bestellungen, Order-Historie, Bestell-Liste und WhatsApp-Digest bleiben unberührt.
- **`computeDashboard` bleibt unverändert** (bereits getestet) — nur die Datenbeschaffung filtert.
- **`null` = all-time** (Ausgangszustand, bisheriges Verhalten).
- **Reset-Zeitpunkt = „jetzt"** (`new Date().toISOString()`), clientseitig gesetzt; kein UI-Pfad in die Zukunft.
- **Fehlklick-Schutz:** zweistufiger Inline-Confirm (kein Modal, kein Passwort).
- **RLS unverändert:** `app_config` (Singleton `id = 1`) — Lesen für Authentifizierte, Schreiben nur Admin; bestehende Policies gelten.
- **Migration heißt `0018_dashboard_reset.sql`** (nächste freie Nummer nach `0017`).

## File Structure

| Datei | Verantwortung |
|---|---|
| `supabase/migrations/0018_dashboard_reset.sql` (neu) | Spalte `dashboard_reset_at` auf `app_config` |
| `Frontend/src/types/index.ts` (ändern) | `AppConfig.dashboardResetAt: string \| null` |
| `Frontend/src/lib/data/store.ts` (ändern) | `getConfig`/`saveConfig`-Mapping; neu `setDashboardResetAt`; `getDashboardStats` filtert |
| `Frontend/src/pages/admin/settings-page.tsx` (neu) | Admin-Seite „Einstellungen" mit Reset-Abschnitt |
| `Frontend/src/router.tsx` (ändern) | Route `einstellungen` |
| `Frontend/src/components/layout/admin-shell.tsx` (ändern) | Nav-Eintrag „Einstellungen" |
| `Frontend/src/pages/admin/dashboard-page.tsx` (ändern) | dezenter Hinweis „Statistik seit …" |
| `Doku/Pizza/Changelog.md`, `Doku/Pizza/TODO.md` (ändern) | Doku |

---

### Task 1: Migration 0018 — Spalte `dashboard_reset_at`

**Files:**
- Create: `supabase/migrations/0018_dashboard_reset.sql`

**Interfaces:**
- Produces (DB): Spalte `public.app_config.dashboard_reset_at timestamptz` (nullable).

> SQL ist hier nicht ausführbar → kein Auto-Test. Review + Betreiber-`db push`. Additiv, keine RLS-Änderung.

- [ ] **Step 1: Migration schreiben**

Datei `supabase/migrations/0018_dashboard_reset.sql` mit exakt diesem Inhalt:

```sql
-- Dashboard-Reset: weicher Reset-Punkt. null = all-time (bisheriges Verhalten).
-- Dashboard-Aggregation zählt Bestellungen ab diesem Zeitpunkt; Bestellungen/Digest/Historie unberührt.
alter table public.app_config add column if not exists dashboard_reset_at timestamptz;
```

- [ ] **Step 2: Review-Gate**

Prüfe: (a) `add column if not exists` (idempotent); (b) Typ `timestamptz`, nullable (kein `not null`, kein Default); (c) keine RLS-/Policy-Änderung, keine anderen Tabellen berührt.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add supabase/migrations/0018_dashboard_reset.sql
git commit -m "feat(db): 0018 app_config.dashboard_reset_at (weicher Dashboard-Reset)"
```

---

### Task 2: Typen + Store — Mapping, `setDashboardResetAt`, gefilterte Aggregation

**Files:**
- Modify: `Frontend/src/types/index.ts:71-76` (`AppConfig`)
- Modify: `Frontend/src/lib/data/store.ts:53-68` (`getConfig`, `saveConfig`, `getDashboardStats`)

**Interfaces:**
- Produces: `AppConfig.dashboardResetAt: string | null`; `setDashboardResetAt(at: string | null): Promise<void>`. Von Task 3 (Einstellungen) und Task 4 (Dashboard-Hinweis) konsumiert.

> Der Filter läuft serverseitig (`.gte`) — ein zusätzlicher Client-Helfer wäre redundant (Spec-Entscheidung), daher kein Unit-Test; Verifikation via `tsc` + `build` + Betreiber-Smoke-Test.

- [ ] **Step 1: `AppConfig`-Typ erweitern**

In `Frontend/src/types/index.ts` das Interface `AppConfig` (aktuell Zeilen 71–76) ersetzen durch:

```ts
export interface AppConfig {
  days: Record<string, boolean>;
  hours: Hours;
  leadTimeDays: number;
  service: { dineIn: boolean; takeaway: boolean };
  dashboardResetAt: string | null;
}
```

- [ ] **Step 2: `getConfig`/`saveConfig`-Mapping ergänzen**

In `Frontend/src/lib/data/store.ts` die beiden Funktionen (aktuell Zeilen 53–61) ersetzen durch:

```ts
export async function getConfig(): Promise<AppConfig> {
  const { data, error } = await supabase.from("app_config").select("*").eq("id", 1).single();
  if (error) throw error;
  return { days: data.days, hours: data.hours, leadTimeDays: data.lead_time_days, service: data.service, dashboardResetAt: data.dashboard_reset_at ?? null };
}
export async function saveConfig(config: AppConfig): Promise<void> {
  const { error } = await supabase.from("app_config").upsert({ id: 1, days: config.days, hours: config.hours, lead_time_days: config.leadTimeDays, service: config.service, dashboard_reset_at: config.dashboardResetAt });
  if (error) throw error;
}
```

> Wichtig: `saveConfig` schreibt `dashboard_reset_at` mit — so überschreiben die anderen Config-Seiten (Tage/Öffnungszeiten/Vorlaufzeit/Service) den Reset-Punkt nicht, weil sie via `getConfig` den vollständigen Stand laden.

- [ ] **Step 3: `setDashboardResetAt` ergänzen**

Direkt nach `saveConfig` (also nach der in Step 2 eingefügten `saveConfig`-Funktion) einfügen:

```ts
// Nur den Dashboard-Reset-Punkt setzen (partielles Update, rührt andere Config-Felder nicht an).
// at = ISO-String -> Reset auf diesen Zeitpunkt; at = null -> all-time.
export async function setDashboardResetAt(at: string | null): Promise<void> {
  const { error } = await supabase.from("app_config").update({ dashboard_reset_at: at }).eq("id", 1);
  if (error) throw error;
}
```

- [ ] **Step 4: `getDashboardStats` filtern**

Die Funktion `getDashboardStats` (aktuell Zeilen 64–68) ersetzen durch:

```ts
// Dashboard-Kennzahlen aus echten Bestellungen (Admin-RLS) aggregieren.
// Ab gesetztem dashboard_reset_at nur Bestellungen ab diesem Zeitpunkt (weicher Reset), sonst all-time.
export async function getDashboardStats(): Promise<DashboardStats> {
  const [config, ingredients] = await Promise.all([getConfig(), getIngredients()]);
  let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (config.dashboardResetAt) query = query.gte("created_at", config.dashboardResetAt);
  const { data, error } = await query;
  if (error) throw error;
  const orders = (data ?? []).map(rowToOrder);
  const names = Object.fromEntries(ingredients.map((i) => [i.id, i.name]));
  return computeDashboard(orders, names);
}
```

> `rowToOrder` und `computeDashboard` sind in derselben Datei bereits importiert/definiert — keine neuen Importe nötig. Prüfe das per `grep -n "rowToOrder\|computeDashboard" src/lib/data/store.ts`, falls unsicher.

- [ ] **Step 5: Typecheck + Build**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bunx tsc --noEmit && bun run build`
Expected: keine Typfehler; Build erfolgreich.

> Erwartung: `tsc` erzwingt jetzt, dass jede Stelle, die ein `AppConfig`-Objekt literal konstruiert, `dashboardResetAt` setzt. Die Config wird real nur über `getConfig` erzeugt (bereits gemappt). Falls `tsc` weitere Stellen meldet (z. B. Test-Fixtures wie `slots.test.ts`, die ein `AppConfig` literal bauen), ergänze dort `dashboardResetAt: null`.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/types/index.ts Frontend/src/lib/data/store.ts
git commit -m "feat(store): dashboardResetAt-Mapping + setDashboardResetAt + gefilterte getDashboardStats"
```

---

### Task 3: Admin-Seite „Einstellungen" + Route + Nav

**Files:**
- Create: `Frontend/src/pages/admin/settings-page.tsx`
- Modify: `Frontend/src/router.tsx`
- Modify: `Frontend/src/components/layout/admin-shell.tsx`

**Interfaces:**
- Consumes: `getConfig`, `setDashboardResetAt` (Task 2); `useAsync` (`{ data, loading, error, reload }`); `AsyncBoundary`.

> Muster wie die übrigen Admin-Config-Seiten. `AsyncBoundary` rendert bei `config` (Objekt) die Children (kein leeres Array). Die Seite ist bewusst als erweiterbare Einstellungsseite angelegt (aktuell nur der Reset-Abschnitt).

- [ ] **Step 1: `settings-page.tsx` anlegen**

Datei `Frontend/src/pages/admin/settings-page.tsx` mit exakt diesem Inhalt:

```tsx
import type React from "react";
import { useState } from "react";
import { Check, RotateCcw, Settings as SettingsIcon } from "lucide-react";
import { getConfig, setDashboardResetAt } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import type { AppConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Lesbarer Reset-Stand für die Anzeige.
function formatResetLabel(iso: string | null): string {
  if (!iso) return "seit Beginn (all-time)";
  const d = new Date(iso);
  return `seit ${d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr`;
}

// Admin: Einstellungen. Aktuell: Dashboard-Reset (weicher Reset-Punkt, nicht destruktiv).
export default function SettingsPage(): React.ReactElement {
  const { data, loading, error, reload } = useAsync(getConfig);
  const [confirm, setConfirm] = useState<null | "reset" | "clear">(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [saveError, setSaveError] = useState("");

  const apply = async (at: string | null) => {
    setBusy(true); setSaveError("");
    try {
      await setDashboardResetAt(at);
      setConfirm(null);
      setFlash(true); setTimeout(() => setFlash(false), 1800);
      reload();
    } catch {
      setSaveError("Konnte nicht gespeichert werden. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-bold text-lg flex items-center gap-2"><SettingsIcon size={18} /> Einstellungen</h2>
      <AsyncBoundary loading={loading} error={error} data={data}>
        {(cfg: AppConfig) => (
          <Card>
            <CardHeader><CardTitle className="text-sm">Dashboard zurücksetzen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Statistik zählt <span className="font-semibold text-foreground">{formatResetLabel(cfg.dashboardResetAt)}</span>.
                Bestellungen, Historie und Digest bleiben unberührt.
              </p>

              {confirm === "reset" ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Wirklich zurücksetzen?</span>
                  <Button size="sm" disabled={busy} onClick={() => apply(new Date().toISOString())}>Ja</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Abbrechen</Button>
                </div>
              ) : (
                <Button className="gap-1.5" disabled={busy} onClick={() => { setSaveError(""); setConfirm("reset"); }}>
                  <RotateCcw size={14} /> Dashboard zurücksetzen
                </Button>
              )}

              {cfg.dashboardResetAt && (confirm === "clear" ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Auf all-time zurückstellen?</span>
                  <Button size="sm" disabled={busy} onClick={() => apply(null)}>Ja</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Abbrechen</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => { setSaveError(""); setConfirm("clear"); }}>
                  Auf all-time zurückstellen
                </Button>
              ))}

              {flash && <p className="text-xs text-primary flex items-center gap-1"><Check size={12} /> Gespeichert</p>}
              {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            </CardContent>
          </Card>
        )}
      </AsyncBoundary>
    </div>
  );
}
```

- [ ] **Step 2: Route ergänzen**

In `Frontend/src/router.tsx`:

(a) Import bei den anderen Admin-Seiten-Importen ergänzen (z. B. direkt nach dem `LeadTimePage`-Import):
```ts
import SettingsPage from "@/pages/admin/settings-page";
```

(b) In den Admin-`children` (bei den anderen `{ path: … }`-Einträgen, z. B. nach `{ path: "benachrichtigungen", element: <NotificationsPage /> }`) ergänzen:
```tsx
      { path: "einstellungen", element: <SettingsPage /> },
```

- [ ] **Step 3: Nav-Eintrag ergänzen**

In `Frontend/src/components/layout/admin-shell.tsx`:

(a) Im `lucide-react`-Import (Zeile 4) `Settings` hinzufügen — die Zeile beginnt mit `import { BarChart2, Calendar, …`; ergänze `Settings` in der Liste, z. B. nach `MessageSquare`:
```ts
import { BarChart2, Calendar, Clock, Timer, Package, Droplet, Tag, Users, ChefHat, LogOut, Store, User, ClipboardList, MessageSquare, Settings, Star } from "lucide-react";
```

(b) Im `NAV`-Array als letzten Eintrag (nach „Benachrichtigungen") ergänzen:
```ts
  { to: "/admin/einstellungen",   icon: Settings, label: "Einstellungen" },
```

- [ ] **Step 4: Typecheck + Build**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bunx tsc --noEmit && bun run build`
Expected: keine Typfehler; Build erfolgreich.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/pages/admin/settings-page.tsx Frontend/src/router.tsx Frontend/src/components/layout/admin-shell.tsx
git commit -m "feat(admin): Einstellungen-Seite mit Dashboard-Reset (zweistufiger Confirm)"
```

---

### Task 4: Dashboard-Hinweis „Statistik seit …"

**Files:**
- Modify: `Frontend/src/pages/admin/dashboard-page.tsx`

**Interfaces:**
- Consumes: `getConfig` (Task 2).

> Dezenter Vermerk direkt unter der Überschrift, nur wenn ein Reset-Punkt gesetzt ist.

- [ ] **Step 1: `getConfig` importieren + Config laden**

In `Frontend/src/pages/admin/dashboard-page.tsx`:

(a) Den bestehenden Store-Import (Zeile 2, `import { getDashboardStats } from "@/lib/data/store";`) ersetzen durch:
```ts
import { getDashboardStats, getConfig } from "@/lib/data/store";
```

(b) In der Komponente direkt nach `const { data, loading, error } = useAsync(getDashboardStats);` (Zeile 17) ergänzen:
```ts
  const { data: cfg } = useAsync(getConfig);
```

- [ ] **Step 2: Hinweis unter der Überschrift rendern**

Die Überschrift (Zeile 21, `<h2 className="font-bold text-lg">Dashboard</h2>`) ersetzen durch:

```tsx
      <div>
        <h2 className="font-bold text-lg">Dashboard</h2>
        {cfg?.dashboardResetAt && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Statistik seit {new Date(cfg.dashboardResetAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </p>
        )}
      </div>
```

- [ ] **Step 3: Typecheck + Build**

Run: `cd "C:/Users/Anwender/Desktop/Website/Pizza/Frontend" && bunx tsc --noEmit && bun run build`
Expected: keine Typfehler; Build erfolgreich.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Frontend/src/pages/admin/dashboard-page.tsx
git commit -m "feat(admin): Dashboard zeigt Reset-Stichtag (Statistik seit …)"
```

---

### Task 5: Doku

**Files:**
- Modify: `Doku/Pizza/Changelog.md`
- Modify: `Doku/Pizza/TODO.md`

**Interfaces:** keine.

- [ ] **Step 1: Changelog**

In `Doku/Pizza/Changelog.md` unter `## 2026-07-18` als neuen obersten Punkt ergänzen: „**Dashboard-Reset (weicher Reset-Punkt):** Neue Admin-Seite `/admin/einstellungen` — der Admin setzt per zweistufigem Confirm einen Reset-Zeitpunkt (`app_config.dashboard_reset_at`, Migration `0018`), ab dem das Dashboard zählt; „Auf all-time zurückstellen" setzt ihn wieder auf `null`. Nicht destruktiv: Bestellungen, Historie und WhatsApp-Digest bleiben unberührt (`getDashboardStats` filtert `created_at >= reset`, `computeDashboard` unverändert). Dashboard zeigt den Stichtag „Statistik seit …". Betreiber: `bunx supabase db push` (0018)."

- [ ] **Step 2: TODO**

In `Doku/Pizza/TODO.md` einen erledigten Eintrag (Datum 2026-07-18) für „Dashboard-Reset-Button" ergänzen, mit Verweis auf Migration `0018` und die Betreiber-Schritte.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/Anwender/Desktop/Website/Pizza"
git add Doku/Pizza/
git commit -m "docs: Dashboard-Reset dokumentiert"
```

---

## Betreiber-Ausrollung (nach Merge nach `main`)

1. `bunx supabase db push` — spielt `0018` ein (Spalte `dashboard_reset_at`).
2. Frontend-Deploy (Vercel Auto-Deploy auf `main`).
3. Smoke-Test: `/admin/einstellungen` → „Dashboard zurücksetzen" → „Ja". Dashboard zeigt „Statistik seit …" und zählt ab jetzt; Bestell-Liste + Digest unverändert. „Auf all-time zurückstellen" stellt den ursprünglichen Stand wieder her.
