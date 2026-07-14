# Zutaten bearbeiten + Kategorie „Sonstiges" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Im Admin bestehende Zutaten bearbeiten können und beliebige Kategorien (insb. „Sonstiges") vergeben können.

**Architecture:** Reines Frontend. Ein reiner Helfer `mergeCategories` vereint ein festes Grundset (inkl. „Sonstiges") mit den datengetriebenen Kategorien; die Admin-Seite `ingredients-page.tsx` bekommt ein gemeinsames Add-/Edit-Formular (State `editingId`) und ein Kategorie-Dropdown mit „Neue Kategorie…"-Freitext. Keine DB-/Schema-Änderung (`category` ist bereits freier `text`, `saveIngredients` upsertet).

**Tech Stack:** TypeScript/React 18, Vite, Tailwind, lucide-react, Tests via `bun:test`. Package-Manager: **Bun**.

## Global Constraints

- Package-Manager **Bun** (`bun run`, `bun test`) — kein npm/yarn.
- Tests via `bun:test` (`import { describe, it, expect } from "bun:test"`), Dateien unter `src/**/__tests__/*.test.ts`.
- **Keine** Migration/Schema-Änderung, **kein** ADR, **kein** SETUP-Eintrag — reines Frontend, deployt über `main`-Push (Vercel Auto-Deploy).
- `BASE_CATEGORIES = ["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges"]` (exakt diese Werte/Reihenfolge).
- Beim Bearbeiten bleiben `id` **und** `available` der Zutat erhalten (`available` hat einen eigenen Toggle, ist nicht Teil des Formulars).
- Speichern bleibt fire-and-forget (`void saveIngredients(next)`) — konsistent zum Bestand, keine Fehleranzeige ergänzen.
- Submit ist deaktiviert, solange Name **oder** Kategorie leer ist (schützt vor leerer Freitext-Kategorie).
- Sentinel-Wert für „Neue Kategorie…": `"__new__"`.

---

### Task 1: Helfer `mergeCategories` + Tests

**Files:**
- Create: `Frontend/src/lib/ingredient-categories.ts`
- Test: `Frontend/src/lib/__tests__/ingredient-categories.test.ts`

**Interfaces:**
- Consumes: `IngredientItem` aus `@/types`.
- Produces:
  - `BASE_CATEGORIES: string[]` = `["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges"]`
  - `mergeCategories(items: IngredientItem[], base?: string[]): string[]` — Vereinigung aus `base` (Default `BASE_CATEGORIES`) + den in `items` vorkommenden Kategorien, ohne Dubletten; Reihenfolge: erst `base`, dann neue (erste Sichtung gewinnt).

- [ ] **Step 1: Failing test schreiben**

Create `Frontend/src/lib/__tests__/ingredient-categories.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { mergeCategories, BASE_CATEGORIES } from "@/lib/ingredient-categories";
import type { IngredientItem } from "@/types";

const ing = (category: string): IngredientItem => ({ id: category, name: category, emoji: "🍕", category, available: true, description: "" });

describe("mergeCategories", () => {
  it("ohne Zutaten → nur BASE_CATEGORIES", () => {
    expect(mergeCategories([], BASE_CATEGORIES)).toEqual(["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges"]);
  });
  it("neue datengetriebene Kategorie kommt hinten dran (keine Dublette)", () => {
    expect(mergeCategories([ing("Dessert")], BASE_CATEGORIES)).toEqual(["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges", "Dessert"]);
  });
  it("bereits im Grundset vorhandene Kategorie erzeugt keine Dublette", () => {
    expect(mergeCategories([ing("Käse"), ing("Gemüse")], BASE_CATEGORIES)).toEqual(["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges"]);
  });
  it("mehrere neue Kategorien: erste Sichtung gewinnt, keine Dubletten", () => {
    expect(mergeCategories([ing("Dessert"), ing("Getränke"), ing("Dessert")], BASE_CATEGORIES)).toEqual(["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges", "Dessert", "Getränke"]);
  });
  it("Default-Parameter nutzt BASE_CATEGORIES", () => {
    expect(mergeCategories([])).toEqual(BASE_CATEGORIES);
  });
});
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `cd Frontend && bun test src/lib/__tests__/ingredient-categories.test.ts`
Expected: FAIL („Cannot find module '@/lib/ingredient-categories'").

- [ ] **Step 3: Helfer implementieren**

Create `Frontend/src/lib/ingredient-categories.ts`:

```ts
import type { IngredientItem } from "@/types";

// Festes Grundset an Kategorien (immer im Dropdown/Tab verfügbar, auch ohne passende Zutat).
export const BASE_CATEGORIES = ["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges"];

// Vereinigung aus base + den in items vorkommenden Kategorien, ohne Dubletten.
// Reihenfolge: erst base (in Reihenfolge), dann neue datengetriebene (erste Sichtung gewinnt).
export function mergeCategories(items: IngredientItem[], base: string[] = BASE_CATEGORIES): string[] {
  const result = [...base];
  for (const it of items) {
    if (!result.includes(it.category)) result.push(it.category);
  }
  return result;
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `cd Frontend && bun test src/lib/__tests__/ingredient-categories.test.ts`
Expected: PASS (5 Tests grün).

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/lib/ingredient-categories.ts Frontend/src/lib/__tests__/ingredient-categories.test.ts
git commit -m "feat(admin): mergeCategories-Helfer + BASE_CATEGORIES (inkl. Sonstiges)"
```

---

### Task 2: `ingredients-page.tsx` — Bearbeiten + Kategorie-Dropdown

**Files:**
- Modify (komplett ersetzen): `Frontend/src/pages/admin/ingredients-page.tsx`

**Interfaces:**
- Consumes: `mergeCategories`, `BASE_CATEGORIES` aus `@/lib/ingredient-categories` (Task 1); `getIngredients`, `saveIngredients`; `IngredientItem`; bestehende UI-Komponenten.

- [ ] **Step 1: Datei komplett ersetzen**

`Frontend/src/pages/admin/ingredients-page.tsx` vollständig ersetzen durch:

```tsx
import type React from "react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Pencil } from "lucide-react";
import { getIngredients, saveIngredients } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";
import type { IngredientItem } from "@/types";
import { mergeCategories, BASE_CATEGORIES } from "@/lib/ingredient-categories";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const uid = () => Math.random().toString(36).slice(2, 9);
const NEW_CAT = "__new__";
const EMPTY_FORM = { name: "", emoji: "🍕", category: "Gemüse", description: "" };

// Admin: Zutatenverwaltung — Anlegen, Bearbeiten, Verfügbar-Toggle, Löschen. Persistiert via saveIngredients.
export default function IngredientsPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getIngredients);
  const [list, setList] = useState<IngredientItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCatMode, setNewCatMode] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { if (data) setList(data); }, [data]);

  // Lokalen State setzen UND persistieren (fire-and-forget, wie im Bestand).
  const mutate = (next: IngredientItem[]) => {
    setList(next);
    void saveIngredients(next);
  };

  // Formular im Anlege-Modus öffnen/schließen (setzt einen evtl. Edit-Zustand zurück).
  const toggleAddForm = () => {
    if (showForm) { setShowForm(false); setEditingId(null); setNewCatMode(false); }
    else { setEditingId(null); setForm(EMPTY_FORM); setNewCatMode(false); setShowForm(true); }
  };

  // Bearbeiten starten: Formular mit den Werten der Zutat vorausfüllen.
  const startEdit = (ing: IngredientItem) => {
    setForm({ name: ing.name, emoji: ing.emoji, category: ing.category, description: ing.description });
    setEditingId(ing.id);
    setNewCatMode(false);
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); setNewCatMode(false); setForm(EMPTY_FORM); };

  // Anlegen oder Speichern (je nach editingId).
  const submit = () => {
    if (!list || !form.name.trim() || !form.category.trim()) return;
    const next = editingId
      ? list.map((i) => i.id === editingId
          ? { ...i, name: form.name.trim(), emoji: form.emoji, category: form.category.trim(), description: form.description.trim() }
          : i)
      : [...list, { id: uid(), name: form.name.trim(), emoji: form.emoji, category: form.category.trim(), description: form.description.trim(), available: true }];
    mutate(next);
    setForm(EMPTY_FORM); setEditingId(null); setNewCatMode(false); setShowForm(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Zutaten</h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={toggleAddForm}>
          <Plus size={12} /> Neue Zutat
        </Button>
      </div>

      <AsyncBoundary loading={loading} error={error} data={list}>
        {(items: IngredientItem[]) => {
          const catList = mergeCategories(items, BASE_CATEGORIES);
          const selectValue = newCatMode ? NEW_CAT : form.category;
          const canSubmit = !!form.name.trim() && !!form.category.trim();
          return (
            <>
              {/* Formular (Anlegen + Bearbeiten) */}
              <AnimatePresence>
                {showForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <Card className="border-primary/20">
                      <CardHeader><CardTitle className="text-sm">{editingId ? "Zutat bearbeiten" : "Neue Zutat hinzufügen"}</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <Label>Emoji</Label>
                            <Input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} className="text-center text-xl" maxLength={2} />
                          </div>
                          <div className="col-span-2 space-y-1.5">
                            <Label>Name</Label>
                            <Input placeholder="z.B. Balsamico" value={form.name}
                              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Kategorie</Label>
                          <SelectInput value={selectValue}
                            onChange={(v) => {
                              if (v === NEW_CAT) { setNewCatMode(true); setForm((f) => ({ ...f, category: "" })); }
                              else { setNewCatMode(false); setForm((f) => ({ ...f, category: v })); }
                            }}
                            options={[...catList.map((c) => ({ value: c, label: c })), { value: NEW_CAT, label: "＋ Neue Kategorie…" }]} />
                          {newCatMode && (
                            <Input placeholder="Name der neuen Kategorie" value={form.category}
                              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label>Beschreibung</Label>
                          <Input placeholder="Kurze Beschreibung..." value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={submit} disabled={!canSubmit}>
                            {editingId ? "Speichern" : <><Plus size={13} /> Hinzufügen</>}
                          </Button>
                          <Button variant="ghost" onClick={cancelForm}>Abbrechen</Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              <Tabs defaultValue={catList[0]}>
                <TabsList className="w-full">
                  {catList.map((c) => <TabsTrigger key={c} value={c} className="flex-1 text-xs">{c}</TabsTrigger>)}
                </TabsList>
                {catList.map((cat) => (
                  <TabsContent key={cat} value={cat} className="space-y-2 mt-3">
                    {items.filter((i) => i.category === cat).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">Keine Zutaten in dieser Kategorie.</p>
                    )}
                    {items.filter((i) => i.category === cat).map((ing) => (
                      <Card key={ing.id} className={cn(!ing.available && "opacity-40")}>
                        <CardContent className="py-3 px-4 flex items-center gap-3">
                          <span className="text-2xl">{ing.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{ing.name}</p>
                            <p className="text-xs text-muted-foreground">{ing.description || "—"}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => startEdit(ing)}>
                              <Pencil size={12} />
                            </Button>
                            <Switch checked={ing.available}
                              onCheckedChange={() => mutate(items.map((i) => i.id === ing.id ? { ...i, available: !i.available } : i))} />
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => mutate(items.filter((i) => i.id !== ing.id))}>
                              <X size={12} />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
```

- [ ] **Step 2: Build + Suite grün**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build erfolgreich; Tests grün (inkl. der 5 neuen aus Task 1).

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/pages/admin/ingredients-page.tsx
git commit -m "feat(admin): Zutaten bearbeiten (Stift-Icon/gemeinsames Formular) + Kategorie inkl. Neue-Kategorie-Freitext"
```

---

### Task 3: Dokumentation

**Files:**
- Modify: `Doku/Pizza/Changelog.md` (neuer Abschnitt `## 2026-07-14` oben)
- Modify: `Doku/Pizza/TODO.md` (zwei Ideen-Zeilen → erledigt)

- [ ] **Step 1: Changelog-Eintrag**

In `Doku/Pizza/Changelog.md` direkt nach der Zeile `<!-- Neue Einträge oben einfügen -->` (also **über** dem bestehenden `## 2026-07-13`) einen neuen Abschnitt einfügen:

```markdown
## 2026-07-14

- **Zutaten bearbeiten + Kategorie „Sonstiges":** Admin kann bestehende Zutaten jetzt bearbeiten
  (Stift-Icon je Karte → gemeinsames Add-/Edit-Formular; `id` und Verfügbar-Status bleiben erhalten).
  Das Kategorie-Dropdown enthält ein festes Grundset inkl. **„Sonstiges"** (`BASE_CATEGORIES`) plus die
  datengetriebenen Kategorien und eine „＋ Neue Kategorie…"-Option (Freitext; leer → Speichern
  deaktiviert). Neue Kategorien erscheinen automatisch als Admin-Tab und im Kunden-Konfigurator (beide
  datengetrieben). Reiner Helfer `mergeCategories` (`lib/ingredient-categories.ts`) getestet (bun:test).
  Reines Frontend, keine Migration.
```

- [ ] **Step 2: TODO aktualisieren**

In `Doku/Pizza/TODO.md` die beiden Ideen-Zeilen ersetzen.

Zeile `| P3 | **Idee: Zutaten bearbeiten** — bestehende Zutaten im Admin editieren (aktuell wohl nur Anlegen/Toggle). Kleines CRUD-Add. | offen (Ideenstatus) | — |` ersetzen durch:

```markdown
| P3 | ~~Zutaten bearbeiten~~ | erledigt (2026-07-14) — Stift-Icon/gemeinsames Formular, `id`+`available` bleiben | — |
```

Zeile `| P3 | **Idee: Zutaten-Kategorie „Sonstiges"** (z. B. Schoko) — neue `category` ergänzen (vermutlich Code-Konstante). Passt mit Dessert-/Süß-Pizzen. | offen (Ideenstatus) | — |` ersetzen durch:

```markdown
| P3 | ~~Zutaten-Kategorie „Sonstiges"~~ | erledigt (2026-07-14) — `BASE_CATEGORIES` inkl. Sonstiges + „Neue Kategorie…"-Freitext; datengetrieben in Admin+Konfigurator | — |
```

- [ ] **Step 3: Commit**

```bash
git add Doku/Pizza/Changelog.md Doku/Pizza/TODO.md
git commit -m "docs: Zutaten bearbeiten + Kategorie Sonstiges (Changelog/TODO)"
```

---

## Verifikation gesamt

- `cd Frontend && bun test src` → alle Tests grün (inkl. `ingredient-categories.test.ts`).
- `cd Frontend && bun run build` → erfolgreich.
- Manueller Klicktest (nach Merge/Deploy): Zutat bearbeiten (Stift), Kategorie „Sonstiges" wählen, „Neue Kategorie…" mit Freitext anlegen, neuer Tab erscheint, Zutat taucht im Konfigurator in der neuen Gruppe auf.
