# Admin-Desktop Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die fünf Admin-Konfig-Formularseiten zu einem responsiven „Einstellungen"-Hub zusammenfassen, die Admin-Navigation von 13 auf 9 Einträge kürzen und das Dashboard die Desktop-Breite nutzen lassen.

**Architecture:** Reines Frontend. Fünf Karten-Komponenten unter `components/admin/settings/` kapseln je ein Formular; die Hub-Seite (`settings-page.tsx`) komponiert sie in einem Grid und hält **einen** gemeinsamen `useConfigEditor` für die drei AppConfig-Karten (verhindert Lost-Update). Router leitet die vier alten Routen auf den Hub um; die vier alten Seiten-Dateien werden gelöscht.

**Tech Stack:** TypeScript, React, react-router, Tailwind, shadcn/ui, Bun (Package-Manager + Build). Kein Backend, keine Migration, kein Betreiber-Deploy.

## Global Constraints

- **Kein Backend/keine Migration.** Nur `Frontend/`-Dateien ändern.
- **Verifikation je Task:** `bunx tsc --noEmit` grün UND `bun run build` grün. (Das Projekt hat keine Komponenten-Unit-Tests; die Refactors führen keine neue testbare Pure-Logik ein — der Build/Typecheck ist das Gate, wie in Phase 1+2.)
- **Kein horizontaler Überlauf** auf Handy (`<md`) oder Desktop.
- **Formular-Logik bleibt identisch** — Felder, Validierung, Speicher-Aufrufe unverändert, nur umgehängt.
- Alle Befehle laufen aus `C:/Users/Anwender/Desktop/Website/Pizza/Frontend`.
- Commit-Messages enden mit:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: Dashboard nutzt die Desktop-Breite

Eigenständig und ohne Abhängigkeit zum Hub — daher zuerst.

**Files:**
- Modify: `Frontend/src/pages/admin/dashboard-page.tsx`

**Interfaces:**
- Consumes: nichts.
- Produces: nichts (rein präsentational).

- [ ] **Step 1: Kennzahl-Kacheln 4-spaltig auf `xl`**

In `dashboard-page.tsx` den Kachel-Grid-Wrapper ändern:

```tsx
// vorher:
<div className="grid grid-cols-2 gap-3">
// nachher:
<div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
```

- [ ] **Step 2: Die beiden Chart-Karten ab `lg` nebeneinander**

Die zwei `<Card>`-Blöcke „Beliebteste Pizzen" und „Beliebteste Zutaten" gemeinsam in einen Grid-Wrapper fassen. Aus:

```tsx
              <Card>
                <CardHeader><CardTitle className="text-sm">Beliebteste Pizzen</CardTitle></CardHeader>
                ...
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Beliebteste Zutaten</CardTitle></CardHeader>
                ...
              </Card>
```

wird:

```tsx
              <div className="grid gap-5 lg:grid-cols-2 items-start">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Beliebteste Pizzen</CardTitle></CardHeader>
                  ...
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Beliebteste Zutaten</CardTitle></CardHeader>
                  ...
                </Card>
              </div>
```

(Karten-Inhalt unverändert; nur der umschließende `<div>` kommt dazu.)

- [ ] **Step 3: Typecheck + Build**

Run (aus `Frontend/`): `bunx tsc --noEmit && bun run build`
Expected: beide grün, keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/admin/dashboard-page.tsx
git commit -m "feat(admin): Dashboard nutzt Desktop-Breite (Kacheln 4-spaltig, Charts nebeneinander)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Selbst-versorgende Karten — NotificationsCard + DashboardResetCard

Reiner Umzug bestehender Seiten-Logik in eigenständige Karten-Komponenten. Beide laden ihre Daten selbst.

**Files:**
- Create: `Frontend/src/components/admin/settings/notifications-card.tsx`
- Create: `Frontend/src/components/admin/settings/dashboard-reset-card.tsx`

**Interfaces:**
- Consumes: `getNotifyConfig`, `saveNotifyConfig`, `getConfig`, `setDashboardResetAt` aus `@/lib/data/store`; `useAsync`; `AsyncBoundary`.
- Produces:
  - `NotificationsCard(): React.ReactElement` — keine Props.
  - `DashboardResetCard(): React.ReactElement` — keine Props.

- [ ] **Step 1: `notifications-card.tsx` anlegen**

Inhalt (Logik 1:1 aus `pages/admin/notifications-page.tsx`, in eine Karte mit CardHeader-Titel gepackt, Speichern-Button in die Karte gezogen):

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { getNotifyConfig, saveNotifyConfig } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import type { NotifyConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// WhatsApp-Digest-Empfänger (Teil-B3): Nummer + CallMeBot-API-Key + An/Aus. Selbst-versorgend.
export function NotificationsCard(): React.ReactElement {
  const { data, loading, error } = useAsync(getNotifyConfig);
  const [cfg, setCfg] = useState<NotifyConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setCfg(data); }, [data]);

  const save = async () => {
    if (!cfg) return;
    await saveNotifyConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Benachrichtigungen</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Täglich 18 Uhr eine WhatsApp mit allen heutigen Abholungen. Empfänger muss sich einmalig bei CallMeBot registrieren (liefert den API-Key).</p>
      </CardHeader>
      <CardContent className="pt-0">
        <AsyncBoundary loading={loading} error={error} data={cfg}>
          {(c: NotifyConfig) => (
            <>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold text-sm">Digest aktiv</p>
                  <p className={"text-xs mt-0.5 " + (c.enabled ? "text-green-400" : "text-muted-foreground")}>{c.enabled ? "Wird gesendet" : "Pausiert"}</p>
                </div>
                <Switch checked={c.enabled} onCheckedChange={(v) => setCfg({ ...c, enabled: v })} />
              </div>
              <Separator />
              <div className="space-y-1.5 py-3">
                <Label htmlFor="phone">Empfänger-Nummer (WhatsApp)</Label>
                <Input id="phone" type="tel" placeholder="+49170..." value={c.recipientPhone}
                  onChange={(e) => setCfg({ ...c, recipientPhone: e.target.value })} />
              </div>
              <Separator />
              <div className="space-y-1.5 py-3">
                <Label htmlFor="key">CallMeBot API-Key</Label>
                <Input id="key" value={c.callmebotApikey}
                  onChange={(e) => setCfg({ ...c, callmebotApikey: e.target.value })} />
              </div>
              <Button className="w-full gap-2 mt-2" onClick={save}>{saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}</Button>
            </>
          )}
        </AsyncBoundary>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: `dashboard-reset-card.tsx` anlegen**

Inhalt (Logik 1:1 aus dem heutigen `pages/admin/settings-page.tsx`, ohne die äußere Seiten-`<div>`/Überschrift):

```tsx
import type React from "react";
import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
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

// Dashboard-Reset (weicher Reset-Punkt, nicht destruktiv). Selbst-versorgend.
export function DashboardResetCard(): React.ReactElement {
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
    <Card>
      <CardHeader><CardTitle className="text-sm">Dashboard zurücksetzen</CardTitle></CardHeader>
      <AsyncBoundary loading={loading} error={error} data={data}>
        {(cfg: AppConfig) => (
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
        )}
      </AsyncBoundary>
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck + Build**

Run (aus `Frontend/`): `bunx tsc --noEmit && bun run build`
Expected: beide grün. (Die Karten sind noch nicht importiert — das ist erwartet und erzeugt keinen Fehler.)

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/components/admin/settings/notifications-card.tsx Frontend/src/components/admin/settings/dashboard-reset-card.tsx
git commit -m "feat(admin): NotificationsCard + DashboardResetCard fuer Einstellungen-Hub

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Geteilte Config-Karten — ServiceCard, HoursCard, LeadTimeCard

Präsentationale Karten, die den geteilten Config-Zustand per Props erhalten (kein eigener `useConfigEditor` → kein Lost-Update).

**Files:**
- Create: `Frontend/src/components/admin/settings/service-card.tsx`
- Create: `Frontend/src/components/admin/settings/hours-card.tsx`
- Create: `Frontend/src/components/admin/settings/lead-time-card.tsx`

**Interfaces:**
- Consumes: `AppConfig` aus `@/types`; `getAvailableTimes` aus `@/lib/slots` (HoursCard); `getSelectableDates`, `formatDateLabel` aus `@/lib/slots` + `getOpenDays` aus `@/lib/data/store` + `useAsync` (LeadTimeCard); `SelectInput`.
- Produces — jede Karte hat dieselbe Props-Form:
  ```ts
  type ConfigCardProps = {
    cfg: AppConfig;
    setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
    save: () => void;
    saved: boolean;
  };
  ```
  - `ServiceCard(props: ConfigCardProps): React.ReactElement`
  - `HoursCard(props: ConfigCardProps): React.ReactElement`
  - `LeadTimeCard(props: ConfigCardProps): React.ReactElement`

- [ ] **Step 1: `service-card.tsx` anlegen**

```tsx
import type React from "react";
import { Check } from "lucide-react";
import type { AppConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConfigCardProps = {
  cfg: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
  save: () => void;
  saved: boolean;
};

// Service-Modus: globaler Schalter Vor Ort / Abholen. Geteilter Config-Zustand vom Hub.
export function ServiceCard({ cfg, setConfig, save, saved }: ConfigCardProps): React.ReactElement {
  const toggle = (key: "dineIn" | "takeaway") =>
    setConfig((c) => (c ? { ...c, service: { ...c.service, [key]: !c.service[key] } } : c));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Service</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Wie bestellt werden kann. Beide aus = keine Bestellungen.</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-semibold text-sm">Vor Ort essen</p>
            <p className={"text-xs mt-0.5 " + (cfg.service.dineIn ? "text-green-400" : "text-muted-foreground")}>{cfg.service.dineIn ? "Aktiv" : "Aus"}</p>
          </div>
          <Switch checked={cfg.service.dineIn} onCheckedChange={() => toggle("dineIn")} />
        </div>
        <Separator />
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-semibold text-sm">Abholen</p>
            <p className={"text-xs mt-0.5 " + (cfg.service.takeaway ? "text-green-400" : "text-muted-foreground")}>{cfg.service.takeaway ? "Aktiv" : "Aus"}</p>
          </div>
          <Switch checked={cfg.service.takeaway} onCheckedChange={() => toggle("takeaway")} />
        </div>
        <Button className="w-full gap-2 mt-3" onClick={save}>{saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}</Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: `hours-card.tsx` anlegen**

```tsx
import type React from "react";
import { Check } from "lucide-react";
import { getAvailableTimes } from "@/lib/slots";
import type { AppConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConfigCardProps = {
  cfg: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
  save: () => void;
  saved: boolean;
};

// Öffnungszeiten: nur Uhrzeiten in diesem Zeitraum erscheinen im Bestellformular.
export function HoursCard({ cfg, setConfig, save, saved }: ConfigCardProps): React.ReactElement {
  const setHours = (patch: Partial<AppConfig["hours"]>) =>
    setConfig((c) => (c ? { ...c, hours: { ...c.hours, ...patch } } : c));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Öffnungszeiten</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Nur Uhrzeiten in diesem Zeitraum erscheinen im Bestellformular.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="hf">Öffnet um</Label>
          <Input id="hf" type="time" value={cfg.hours.from} onChange={(e) => setHours({ from: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ht">Schließt um</Label>
          <Input id="ht" type="time" value={cfg.hours.to} onChange={(e) => setHours({ to: e.target.value })} />
        </div>
        <div className="bg-primary/8 border border-primary/15 rounded-lg px-4 py-3">
          <p className="text-sm font-bold text-primary">{cfg.hours.from} – {cfg.hours.to} Uhr</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getAvailableTimes(cfg.hours).length} Zeitslots à 15 Minuten
          </p>
        </div>
        <Button className="w-full gap-2" onClick={save}>{saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}</Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: `lead-time-card.tsx` anlegen**

```tsx
import type React from "react";
import { Check, Timer } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { getOpenDays } from "@/lib/data/store";
import { getSelectableDates, formatDateLabel } from "@/lib/slots";
import type { AppConfig } from "@/types";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConfigCardProps = {
  cfg: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
  save: () => void;
  saved: boolean;
};

const OPTIONS = Array.from({ length: 15 }, (_, i) => ({ value: String(i), label: `${i} Tag${i === 1 ? "" : "e"}` }));

// Vorlaufzeit: frühester Abholtag = heute + Vorlaufzeit.
export function LeadTimeCard({ cfg, setConfig, save, saved }: ConfigCardProps): React.ReactElement {
  const { data: openDays } = useAsync(getOpenDays);
  const setLeadTime = (v: string) =>
    setConfig((c) => (c ? { ...c, leadTimeDays: Number(v) } : c));
  const earliest = getSelectableDates(openDays ?? [], cfg.leadTimeDays, new Date())[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Vorlaufzeit</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Frühester Abholtag = heute + Vorlaufzeit.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5"><Timer size={11} /> Vorlaufzeit in Tagen</Label>
          <SelectInput value={String(cfg.leadTimeDays)} onChange={setLeadTime} options={OPTIONS} />
        </div>
        <div className="bg-primary/8 border border-primary/15 rounded-lg px-4 py-3">
          <p className="text-sm font-bold text-primary">
            {cfg.leadTimeDays === 0 ? "Bestellung noch für heute möglich" : `${cfg.leadTimeDays} Tag${cfg.leadTimeDays === 1 ? "" : "e"} Vorlauf`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {earliest ? `Frühester Abholtag: ${formatDateLabel(earliest)}` : "Kein Abholtag verfügbar (Bestelltage prüfen)."}
          </p>
        </div>
        <Button className="w-full gap-2" onClick={save}>{saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}</Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Typecheck + Build**

Run (aus `Frontend/`): `bunx tsc --noEmit && bun run build`
Expected: beide grün.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/admin/settings/service-card.tsx Frontend/src/components/admin/settings/hours-card.tsx Frontend/src/components/admin/settings/lead-time-card.tsx
git commit -m "feat(admin): ServiceCard/HoursCard/LeadTimeCard (geteilter Config-Zustand)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Einstellungen-Hub — `settings-page.tsx` neu

Die Seite wird vom reinen Reset-Formular zum Hub, der alle fünf Karten in einem Grid komponiert und **einen** gemeinsamen `useConfigEditor` hält.

**Files:**
- Modify (vollständig ersetzen): `Frontend/src/pages/admin/settings-page.tsx`

**Interfaces:**
- Consumes: `useConfigEditor` aus `@/hooks/use-config-editor` (liefert `{ config, setConfig, loading, error, saved, save }`); die fünf Karten aus `@/components/admin/settings/*`; `AsyncBoundary`; `AppConfig`.
- Produces: Default-Export `SettingsPage(): React.ReactElement` (Route `/admin/einstellungen`, unverändert im Router).

- [ ] **Step 1: `settings-page.tsx` komplett ersetzen**

```tsx
import type React from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { useConfigEditor } from "@/hooks/use-config-editor";
import type { AppConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { ServiceCard } from "@/components/admin/settings/service-card";
import { HoursCard } from "@/components/admin/settings/hours-card";
import { LeadTimeCard } from "@/components/admin/settings/lead-time-card";
import { NotificationsCard } from "@/components/admin/settings/notifications-card";
import { DashboardResetCard } from "@/components/admin/settings/dashboard-reset-card";

// Admin-Einstellungen-Hub: fünf Konfig-Karten in einem responsiven Raster.
// Service/Öffnungszeiten/Vorlaufzeit teilen sich EINEN useConfigEditor (kein Lost-Update);
// Benachrichtigungen + Dashboard-Reset sind selbst-versorgend.
export default function SettingsPage(): React.ReactElement {
  const { config, setConfig, loading, error, saved, save } = useConfigEditor();

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-bold text-lg flex items-center gap-2"><SettingsIcon size={18} /> Einstellungen</h2>
      <AsyncBoundary loading={loading} error={error} data={config}>
        {(cfg: AppConfig) => (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 items-start">
            <ServiceCard cfg={cfg} setConfig={setConfig} save={save} saved={saved} />
            <HoursCard cfg={cfg} setConfig={setConfig} save={save} saved={saved} />
            <LeadTimeCard cfg={cfg} setConfig={setConfig} save={save} saved={saved} />
            <NotificationsCard />
            <DashboardResetCard />
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + Build**

Run (aus `Frontend/`): `bunx tsc --noEmit && bun run build`
Expected: beide grün.

- [ ] **Step 3: Manuelle Sichtprüfung**

Run (aus `Frontend/`): `bun run dev`, dann als Admin `/admin/einstellungen` öffnen.
Expected:
- Fünf Karten sichtbar; Desktop breit → 3 pro Reihe, `md` → 2, Handy → 1 (gestapelt).
- Öffnungszeiten ändern + Speichern, dann Vorlaufzeit ändern + Speichern → **beide** Änderungen bleiben nach Reload erhalten (kein Lost-Update).
- Benachrichtigungen speichern, Dashboard-Reset + „auf all-time zurückstellen" funktionieren.
- Kein horizontaler Überlauf.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/pages/admin/settings-page.tsx
git commit -m "feat(admin): Einstellungen-Hub — fuenf Konfig-Karten im Raster

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Navigation kürzen, Routen umleiten, alte Seiten löschen

Die vier zusammengeführten Seiten aus Nav + Router entfernen, alte Routen auf den Hub umleiten, die vier Seiten-Dateien löschen.

**Files:**
- Modify: `Frontend/src/components/layout/admin-shell.tsx`
- Modify: `Frontend/src/router.tsx`
- Delete: `Frontend/src/pages/admin/hours-page.tsx`
- Delete: `Frontend/src/pages/admin/lead-time-page.tsx`
- Delete: `Frontend/src/pages/admin/service-page.tsx`
- Delete: `Frontend/src/pages/admin/notifications-page.tsx`

**Interfaces:**
- Consumes: `Navigate` aus `react-router` (im Router bereits importiert).
- Produces: nichts Neues.

- [ ] **Step 1: NAV-Einträge in `admin-shell.tsx` entfernen**

Diese vier Zeilen aus dem `NAV`-Array löschen:

```tsx
  { to: "/admin/oeffnungszeiten", icon: Clock,     label: "Öffnungszeiten" },
  { to: "/admin/vorlaufzeit",     icon: Timer,     label: "Vorlaufzeit"    },
  { to: "/admin/service",         icon: Store,     label: "Service"       },
  { to: "/admin/benachrichtigungen", icon: MessageSquare, label: "Benachrichtigungen" },
```

Danach hat `NAV` neun Einträge: Bestellungen, Dashboard, Bestelltage, Zutaten, Soßen, Gutscheine, Sonderartikel, Nutzer, Einstellungen.

- [ ] **Step 2: Ungenutzte Icon-Importe in `admin-shell.tsx` entfernen**

In der `lucide-react`-Importzeile die nun ungenutzten `Clock`, `Timer`, `Store`, `MessageSquare` streichen. Aus:

```tsx
import { BarChart2, Calendar, Clock, Timer, Package, Droplet, Tag, Users, ChefHat, LogOut, Store, User, ClipboardList, MessageSquare, Settings, Star } from "lucide-react";
```

wird:

```tsx
import { BarChart2, Calendar, Package, Droplet, Tag, Users, ChefHat, LogOut, User, ClipboardList, Settings, Star } from "lucide-react";
```

- [ ] **Step 3: Router — vier Routen durch Redirects ersetzen**

In `router.tsx` die vier `children`-Einträge

```tsx
      { path: "oeffnungszeiten", element: <HoursPage /> },
      { path: "vorlaufzeit", element: <LeadTimePage /> },
      { path: "service", element: <ServicePage /> },
      ...
      { path: "benachrichtigungen", element: <NotificationsPage /> },
```

durch Redirects auf den Hub ersetzen (Reihenfolge im `children`-Array egal, `benachrichtigungen` liegt weiter unten):

```tsx
      { path: "oeffnungszeiten", element: <Navigate to="/admin/einstellungen" replace /> },
      { path: "vorlaufzeit", element: <Navigate to="/admin/einstellungen" replace /> },
      { path: "service", element: <Navigate to="/admin/einstellungen" replace /> },
      ...
      { path: "benachrichtigungen", element: <Navigate to="/admin/einstellungen" replace /> },
```

- [ ] **Step 4: Ungenutzte Seiten-Importe in `router.tsx` entfernen**

Diese vier Importzeilen löschen:

```tsx
import HoursPage from "@/pages/admin/hours-page";
import LeadTimePage from "@/pages/admin/lead-time-page";
import ServicePage from "@/pages/admin/service-page";
import NotificationsPage from "@/pages/admin/notifications-page";
```

(`Navigate` bleibt — wird bereits vom Index-Redirect genutzt. `SettingsPage`-Import bleibt.)

- [ ] **Step 5: Die vier alten Seiten-Dateien löschen**

```bash
git rm Frontend/src/pages/admin/hours-page.tsx Frontend/src/pages/admin/lead-time-page.tsx Frontend/src/pages/admin/service-page.tsx Frontend/src/pages/admin/notifications-page.tsx
```

- [ ] **Step 6: Typecheck + Build**

Run (aus `Frontend/`): `bunx tsc --noEmit && bun run build`
Expected: beide grün (keine verwaisten Importe, keine toten Referenzen).

- [ ] **Step 7: Manuelle Sichtprüfung**

Run (aus `Frontend/`): `bun run dev`, als Admin einloggen.
Expected:
- Seitenleiste (Desktop) und Tab-Leiste (Handy) zeigen **9** Einträge; Öffnungszeiten/Vorlaufzeit/Service/Benachrichtigungen sind weg.
- `/admin/oeffnungszeiten`, `/admin/vorlaufzeit`, `/admin/service`, `/admin/benachrichtigungen` direkt aufrufen → leiten sofort auf `/admin/einstellungen` um (kein 404).

- [ ] **Step 8: Commit**

```bash
git add Frontend/src/components/layout/admin-shell.tsx Frontend/src/router.tsx
git commit -m "feat(admin): Nav 13->9, alte Konfig-Routen leiten auf Einstellungen-Hub

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Doku aktualisieren (CLAUDE.md-Grundregel)

Die Grundregel des Projekts: keine implementierte Funktion ohne Doku. Kurz TODO + Changelog pflegen.

**Files:**
- Modify: `Doku/Pizza/TODO.md` (P3-Zeile „PC-/Desktop-Layout" — Phase 3 als erledigt markieren)
- Modify: `Doku/Pizza/Changelog.md` (neuer Eintrag via Template `Templates/_changelog-entry.md`)

**Interfaces:**
- Consumes: nichts.
- Produces: nichts (nur Doku).

- [ ] **Step 1: TODO-Zeile aktualisieren**

In `Doku/Pizza/TODO.md` die Zeile zum PC-/Desktop-Layout ergänzen: Admin Phase 3 (Einstellungen-Hub + Dashboard-Breite) erledigt am 2026-07-22; Spec `docs/superpowers/specs/2026-07-22-admin-desktop-phase3-design.md`, Plan `docs/superpowers/plans/2026-07-22-admin-desktop-phase3.md`. „Offen" reduziert sich auf **Kunden-Desktop**.

- [ ] **Step 2: Changelog-Eintrag ergänzen**

Zuerst `Doku/Pizza/Templates/_changelog-entry.md` lesen und dem Format folgen. Neuer Eintrag (Datum 2026-07-22): Einstellungen-Hub fasst Service/Öffnungszeiten/Vorlaufzeit/Benachrichtigungen/Reset in ein Karten-Raster; Nav 13→9; alte Routen leiten um; Dashboard nutzt Desktop-Breite. Reines Frontend, kein Betreiber-Deploy.

- [ ] **Step 3: Commit**

```bash
git add Doku/Pizza/TODO.md Doku/Pizza/Changelog.md
git commit -m "docs: Admin-Desktop Phase 3 in TODO + Changelog

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Abschluss

Nach Task 6: Branch mit `superpowers:finishing-a-development-branch` abschließen (Merge/PR nach `main`). Kein Betreiber-Deploy nötig (reines Frontend; Vercel deployt `main` automatisch).
