# Design: Soßen, Favoriten & Service-Modus (Teil-A-Erweiterung)

- **Datum:** 2026-07-10
- **Status:** genehmigt (User-Freigabe des Designs)
- **Kontext:** Erweiterung des fertigen Teil-A-Frontends (`Frontend/`, Vite + React 18 + TS + Tailwind v4 + shadcn, Bun). Mock-/localStorage-Datenschicht bleibt die Naht für Teil-B (Supabase).

## Ziel

Drei nutzergetriebene Erweiterungen, alle im bestehenden Muster (async Datenschicht, `AsyncBoundary`, `mutate`-und-persist, Hooks):

1. **Soßen** — admin-verwaltbare Soßenauswahl für eigene Pizzen; färbt den Pizzaboden in der Vorschau; im 10-€-Pauschalpreis enthalten.
2. **Favoriten** — bis zu 5 eigene (im Konfigurator gebaute) Pizzen speichern; wiederverwendbar auf Speisekarte und im Konfigurator.
3. **Service-Modus** — admin-steuerbar per globalem Schalter: „Vor Ort essen", „Abholen" oder beides.

## Nicht-Ziele / bewusste Grenzen

- **Kein Preis-Impact:** Preis bleibt pauschal **10 € pro Pizza**. `lib/pricing.ts` wird nicht angefasst.
- **Keine echte Auth / Server-Validierung:** bleibt Teil B. Favoriten sind gerätelokal (localStorage), keine Konto-Bindung.
- **Soße nur für eigene Pizzen:** Standard-Menü-Pizzen behalten ihre feste Rezeptur (Tomate) und bekommen keine Soßenauswahl.
- **Service-Modus ist ein globaler Schalter** (kein Wochentags-Plan). Zeitwahl für „Vor Ort" ist identisch zur Abholung (gleiche Vorlaufzeit + Öffnungszeiten).

---

## Feature 1 — Soßen

### Datenmodell (`types/index.ts`)
```ts
export interface Sauce {
  id: string;
  name: string;
  emoji: string;
  color: string;      // Bodenfarbe für die PizzaSVG-Vorschau
  available: boolean;
}
```
`CartItem` wird um `sauceId?: string` erweitert (nur eigene Pizzen setzen es; fehlt es → Tomate/Default).

### Seed (`lib/data/seed.ts`)
`SAUCES_DEFAULT` (erste = Default):

| id | name | emoji | color | available |
|----|------|-------|-------|-----------|
| tomate | Tomate | 🍅 | `#B03818` (heutiger Bodenton) | true |
| creme | Crème fraîche | 🥛 | `#ECE3C8` | true |
| bbq | BBQ | 🍖 | `#7A3B1E` | true |
| pesto | Pesto | 🌿 | `#4B7A2F` | true |
| keine | Ohne Soße | 🚫 | `#E8C070` (Teigton) | true |

### Datenschicht (`lib/data/store.ts`)
```ts
export const getSauces  = () => delay(read<Sauce[]>("pizza-sauces", SAUCES_DEFAULT));
export const saveSauces = (list: Sauce[]) => delay(write("pizza-sauces", list));
```
Default-Auflösung: eine Hilfsfunktion liefert bei fehlender/ungültiger `sauceId` die erste verfügbare Soße (Tomate). Wird für Anzeige (Warenkorb/Bestätigung) und Vorschau genutzt.

### Vorschau (`components/pizza/pizza-svg.tsx`)
`PizzaSVG` erhält optionale Prop `sauceColor?: string`. Der bisher fest rote Soßen-Layer (`#B03818`/`#9B2A14`) wird mit `sauceColor` eingefärbt (Fallback = heutiger Tomatenton, damit Standard-Pizzen/Aufrufe ohne Prop unverändert aussehen). Krusten- und Käse-Layer bleiben unverändert.

### Konfigurator (`pages/configurator/configurator-page.tsx`)
- Neue Komponente `components/pizza/sauce-picker.tsx`: Einfachauswahl (Chips oder Segmented) über `getSauces()` (nur `available`), lokaler State `sauceId`, Default = erste verfügbare Soße.
- `PizzaSVG` bekommt die Farbe der gewählten Soße.
- „In den Warenkorb" übergibt die `sauceId` an `addToCart` (Signatur erweitern, s. u.).

### Admin (`pages/admin/sauces-page.tsx`)
Nach Muster der Zutaten-Seite: Laden via `useAsync(getSauces)`, `mutate`(setState + `saveSauces`). Aktionen: anlegen (Emoji, Name, Farbe, aktiv), umbenennen/toggeln/löschen. Farbe als `<input type="color">` (nativ, kein Extra-Aufwand). Neuer Nav-Punkt in `admin-shell.tsx`, Route `/admin/sossen` (umlautfrei, konsistent zu `/admin/oeffnungszeiten`).

---

## Feature 2 — Favoriten (max. 5, nur eigene Pizzen)

### Datenmodell (`types/index.ts`)
```ts
export interface FavoritePizza {
  id: string;
  name: string;
  ingredientIds: string[];
  sauceId: string;
}
```

### Hook (`hooks/use-favorites.tsx`)
Muster wie `useCart` (localStorage `pizza-favorites`, Context-Provider in `app.tsx`):
```ts
interface FavoritesContextValue {
  favorites: FavoritePizza[];
  add(name: string, ingredientIds: string[], sauceId: string): boolean; // false wenn bereits 5
  remove(id: string): void;
  isFull: boolean;   // favorites.length >= 5
}
```
`add` blockiert bei 5 Einträgen (return `false`, kein Insert). Persistenz automatisch via `useEffect`.

### Konfigurator
- Button „Als Favorit speichern": aktiv ab ≥1 Zutat; bei `isFull` deaktiviert + Hinweis „Max. 5 Favoriten – lösche zuerst einen". Name-Eingabe (Default „Meine Pizza N", N = nächste freie Nummer).
- Neue Komponente `components/pizza/favorites-bar.tsx`: Leiste oben mit Favoriten-Chips; Antippen lädt `ingredientIds` + `sauceId` in den lokalen Konfigurator-State. Löschen per X am Chip.

### Speisekarte (`pages/menu/menu-page.tsx`)
- Abschnitt „Meine Favoriten" (nur wenn `favorites.length > 0`), oberhalb/unterhalb des Standard-Grids: je Favorit Mini-`PizzaSVG` (mit Soßenfarbe) + Name + „In den Warenkorb" (legt mit `ingredientIds` + `sauceId` an). Löschen per X.

---

## Feature 3 — Service-Modus (Vor Ort / Abholen)

### Datenmodell
```ts
export interface AppConfig {
  days: Record<string, boolean>;
  hours: Hours;
  leadTimeDays: number;
  service: { dineIn: boolean; takeaway: boolean };   // NEU
}
type ServiceMode = "dinein" | "takeaway";
```
`NewOrder` und `OrderData` erhalten `serviceMode: ServiceMode`. Der Order-`items`-Weg (mit `sauceId`) bleibt.

### Seed / Default
`DEFAULT_CONFIG.service = { dineIn: false, takeaway: true }` (= heutiger „Nur Abholung"-Zustand).

### Helper (`lib/slots.ts`)
```ts
export function availableServiceModes(config: AppConfig): ServiceMode[];
// [] wenn beide aus; sonst die aktiven Modi in fester Reihenfolge [dinein?, takeaway?]
```
Slot-Funktionen (`getSelectableDates`, `getAvailableTimes`) bleiben unverändert und gelten für beide Modi.

### Admin (`pages/admin/service-page.tsx`)
Neue Seite mit zwei `Switch` („Vor Ort essen", „Abholen"), Laden/Speichern über `useConfigEditor` (bestehender Hook). Neuer Nav-Punkt in `admin-shell.tsx`, Route `/admin/service`.

### Checkout (`pages/checkout/checkout-page.tsx`)
- `modes = availableServiceModes(config)`.
- `modes.length === 0` → Bestellung gesperrt (Hinweis „Aktuell keine Bestellungen möglich."), analog zum bestehenden `noDates`-Zustand.
- `modes.length === 2` → Auswahl (Segmented Control) „Vor Ort essen / Abholen"; lokaler State `serviceMode`, Default = erster verfügbarer Modus.
- `modes.length === 1` → Modus fest, Auswahl entfällt.
- Die bisherige „Abholung"-Karte + der Bestell-Button beschriften sich je Modus („Vor Ort essen" / „Abholung"; Button „… Vor Ort" / „… abholen").
- `canOrder` schließt einen gültigen `serviceMode` ein. `createOrder` erhält `serviceMode`.

### Bestätigung (`pages/confirmation/confirmation-page.tsx`)
Zeigt den Modus („Vor Ort essen" / „Abholung") zusätzlich zu Datum/Uhrzeit.

### Speisekarte-Header
`menu-page.tsx`: der feste Text „Nur Abholung" wird aus `config.service` abgeleitet: beide → „Vor Ort & Abholung", nur takeaway → „Nur Abholung", nur dine-in → „Nur Vor Ort", keiner → „Aktuell geschlossen". Erfordert `useAsync(getConfig)` auf der Speisekarte.

---

## Signatur-Änderungen (Verträge)

- `useCart().addToCart(pizzaName: string, ingredientIds: string[], sauceId?: string)` — `sauceId` optional; Standard-Menü-Pizzen rufen ohne auf.
- `createOrder(input: NewOrder)` — `input` enthält jetzt `serviceMode`; `items` tragen optional `sauceId`.
- `PizzaSVG({ selected, sauceColor? })`.

## Tests (bun:test + happy-dom)

- **`use-favorites`**: add bis 5, 6. blockiert (`add` → false, Länge bleibt 5), remove, Persistenz in localStorage.
- **Soße**: `getSauces` liefert Seed; Default-Auflösung (kein/ungültiger `sauceId` → Tomate).
- **`availableServiceModes`**: beide aus → `[]`; nur einer → `[mode]`; beide → `["dinein","takeaway"]`.
- Bestehende Tests (pricing, slots, store, useCart) bleiben grün; `store`-Test ggf. um `serviceMode` im `createOrder`-Input ergänzen.
- **E2E**: bestehender Happy-Path bleibt; Erweiterung optional (Umgebung ohne Browser blockiert, s. Teil-A-Doku).

## Betroffene Dateien

**Neu:** `hooks/use-favorites.tsx`, `components/pizza/sauce-picker.tsx`, `components/pizza/favorites-bar.tsx`, `pages/admin/sauces-page.tsx`, `pages/admin/service-page.tsx`, plus Tests (`hooks/__tests__/use-favorites.test.tsx`, `lib/__tests__/slots.test.ts`-Ergänzung, `lib/data/__tests__/store.test.ts`-Ergänzung).

**Geändert:** `types/index.ts`, `lib/data/seed.ts`, `lib/data/store.ts`, `lib/slots.ts`, `components/pizza/pizza-svg.tsx`, `hooks/use-cart.tsx`, `app.tsx` (FavoritesProvider), `router.tsx` (2 Admin-Routen), `components/layout/admin-shell.tsx` (Nav), `pages/configurator/configurator-page.tsx`, `pages/menu/menu-page.tsx`, `pages/checkout/checkout-page.tsx`, `pages/confirmation/confirmation-page.tsx`.

**Doku:** `Doku/Pizza/Changelog.md`, `Doku/Pizza/Frontend/README.md`, `Frontend/README.md` (Soßen/Favoriten/Service ergänzen).

## Definition of Done

- Build + alle Unit-Tests grün; keine neuen Altlasten.
- Soße im Konfigurator wählbar, färbt Vorschau, landet in Warenkorb + Bestätigung; admin-verwaltbar.
- Bis zu 5 Favoriten speicher-/lade-/löschbar in Konfigurator + Speisekarte; 6. blockiert.
- Service-Modus admin-schaltbar; Checkout zeigt Auswahl/festen Modus/Sperre korrekt; Bestätigung + Header spiegeln den Modus.
- Doku (Changelog/README) aktualisiert.
