# Teil-B1 — Supabase-Fundament + Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Voller Cutover des Teil-A-Frontends von localStorage-Mocks auf ein echtes Supabase-Backend (E-Mail-Auth, RLS, alle Domänendaten + Bestellungen), hinter den bestehenden async-Signaturen.

**Architecture:** `@supabase/supabase-js` direkt hinter der async-Naht (`store.ts`/`use-auth.tsx`), Signaturen bleiben gleich. RLS trägt die Sicherheit; eine Edge Function (`admin-users`) nur für privilegierte Admin-Aktionen (service_role). SQL-Migrationen unter `supabase/`.

**Tech Stack:** Bun, Vite 6, React 18, TypeScript, Tailwind v4, shadcn, react-router 7, **@supabase/supabase-js**, Supabase (Postgres + Auth + Edge Functions/Deno). Tests: bun:test (nur reine Logik).

## Global Constraints

- **Umgebung kann NICHT zu Supabase verbinden.** Jeder Task verifiziert hier NUR `cd Frontend && bun run build` (Typecheck) + die reinen Logik-Tests (`bun test src`). SQL/Edge-Function-Dateien werden geschrieben, nicht ausgeführt. Echtes Ausführen (Migrationen, Klick-Test) macht der Nutzer.
- **Kein Task darf ein laufendes Supabase brauchen, um grün zu sein.**
- **Package-Manager: Bun.** `bun add @supabase/supabase-js`. Build: `bun run build`. Aus `Frontend/`.
- **Keys:** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in `Frontend/.env.local` (gitignored, öffentlich). **service_role NIE im Frontend/Repo, NIE mit `VITE_`-Präfix** — nur Edge Function (Supabase injiziert ihn automatisch).
- **Rollen:** `Role = "customer" | "admin"`. Auth ist **E-Mail + Passwort**. Kein öffentliches Registrieren (Admin legt an via Edge Function). Bootstrap-Admin „Mo" via Dashboard.
- **DB `snake_case`, TS-Typen `camelCase`** — Mapping in `store.ts` (`rowTo*`/`*ToRow`); `@/types`-Interfaces bleiben (bis auf `User`) unverändert.
- **`orders.items` = JSONB.** Preis-/Vorlauf-Validierung bleibt client-seitig (Härtung = B4). Dashboard-Stats bleiben Mock.
- **Referenz-Spec:** `docs/superpowers/specs/2026-07-11-teil-b1-supabase-fundament-design.md`.

---

## Dateistruktur (Ziel)

```
Frontend/
├── .env.example                          (N)
├── src/lib/supabase.ts                    (N) Client-Singleton
├── src/lib/data/store.ts                  (M) alle Queries → Supabase
├── src/lib/data/seed.ts                   (M) Domänen-/USERS-Defaults raus (in Migrationen)
├── src/lib/auth.ts                        (M) usernameTaken → emailTaken
├── src/hooks/use-auth.tsx                  (M) Supabase Auth
├── src/types/index.ts                     (M) User: email statt username/password
├── src/pages/login/login-page.tsx         (M) E-Mail + „Passwort vergessen"
├── src/pages/profile/profile-page.tsx     (M) E-Mail, Passwort via Supabase
├── src/pages/auth/reset-password-page.tsx (N) Passwort-Reset-Ziel
├── src/pages/admin/users-page.tsx         (M) E-Mail + Edge-Function-Aufrufe
├── src/router.tsx                          (M) /passwort-reset
supabase/
├── migrations/0001_schema_rls.sql         (N) Tabellen + RLS + is_admin()
├── migrations/0002_seed.sql               (N) Domänen-Defaults
└── functions/admin-users/index.ts         (N) create/delete/reset (service_role)
```

---

### Task 1: Supabase-Client, Env & Dependency

**Files:**
- Modify: `Frontend/package.json` (dependency)
- Create: `Frontend/src/lib/supabase.ts`
- Create: `Frontend/.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `export const supabase` (SupabaseClient) aus `@/lib/supabase`.

- [ ] **Step 1: Dependency installieren**

Run: `cd Frontend && bun add @supabase/supabase-js`
Expected: Paket in `package.json` unter `dependencies`, `bun.lock` aktualisiert.

- [ ] **Step 2: `.gitignore` ergänzen** (Repo-Root `.gitignore`): unter „Umgebungsvariablen / Secrets" sicherstellen, dass `.env.local` ignoriert ist (bereits `.env.*` vorhanden — prüfen; falls nicht, Zeile `Frontend/.env.local` ergänzen). Zusätzlich am Ende ergänzen:
```
# Supabase
supabase/.temp/
supabase/.branches/
```

- [ ] **Step 3: `.env.example` anlegen** (`Frontend/.env.example`)
```
# Supabase — Werte aus Dashboard → Project Settings → API. Kopiere diese Datei nach .env.local und fülle sie.
# Öffentlich (dürfen im Client-Bundle landen):
VITE_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=DEIN-ANON-KEY
# ACHTUNG: den service_role-Key NIEMALS hier oder mit VITE_-Präfix ablegen — er gehört nur in die Edge Function.
```

- [ ] **Step 4: Client anlegen** (`Frontend/src/lib/supabase.ts`)
```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // Fällt nur zur Laufzeit ohne .env.local auf; der Build bleibt grün.
  console.warn("Supabase: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen (.env.local).");
}

export const supabase = createClient(url ?? "", anonKey ?? "");
```

- [ ] **Step 5: Vite-Env-Typen** — sicherstellen, dass `import.meta.env` typt. Falls `Frontend/src/vite-env.d.ts` fehlt, anlegen:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 6: Build → grün**

Run: `cd Frontend && bun run build`
Expected: `tsc -b && vite build` ohne Fehler (Client wird noch nicht konsumiert).

- [ ] **Step 7: Commit**
```bash
git add Frontend/package.json Frontend/bun.lock Frontend/src/lib/supabase.ts Frontend/.env.example Frontend/src/vite-env.d.ts .gitignore
git commit -m "feat(b1): Supabase-Client + .env.example + Dependency"
```

---

### Task 2: Schema + RLS-Migration

**Files:**
- Create: `supabase/migrations/0001_schema_rls.sql`

> Reine SQL-Datei; berührt den Frontend-Build **nicht** (Vite importiert `supabase/` nicht). Review = SQL-Korrektheit.

- [ ] **Step 1: Migration schreiben** (`supabase/migrations/0001_schema_rls.sql`)
```sql
-- Teil-B1: Schema + RLS. Auszuführen via Supabase CLI (supabase db push) oder SQL-Editor.

-- ── profiles (1:1 zu auth.users) ─────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  phone      text not null default '',
  role       text not null default 'customer' check (role in ('customer','admin')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Bei jedem neuen auth.users-Eintrag automatisch ein profiles anlegen,
-- Werte aus raw_user_meta_data übernehmen (setzt die Edge Function beim Anlegen).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'first_name',''),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce(new.raw_user_meta_data->>'role','customer')
  );
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rollen-Helper: SECURITY DEFINER umgeht RLS → keine Rekursion in profiles-Policies.
create function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active);
$$;

-- ── Domänentabellen ──────────────────────────────────────────
create table public.ingredients (
  id text primary key, name text not null, emoji text not null,
  category text not null, available boolean not null default true, description text not null default ''
);
create table public.sauces (
  id text primary key, name text not null, emoji text not null,
  color text not null, available boolean not null default true
);
create table public.vouchers (
  id text primary key, name text not null, code text not null,
  type text not null check (type in ('percent','fixed','ingredient')),
  value numeric not null default 0, ingredient_name text,
  expires_at date not null, active boolean not null default true,
  max_uses int not null default 0, uses int not null default 0
);
create table public.app_config (
  id int primary key default 1 check (id = 1),
  days jsonb not null, hours jsonb not null, lead_time_days int not null, service jsonb not null
);
create table public.orders (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  items jsonb not null,
  subtotal numeric not null, discount numeric not null, total numeric not null,
  free_ingredient text,
  service_mode text not null,
  pickup_date text not null, pickup_time text not null,
  notes text not null default '',
  voucher_code text,
  status text not null default 'eingegangen',
  created_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.ingredients enable row level security;
alter table public.sauces      enable row level security;
alter table public.vouchers    enable row level security;
alter table public.app_config  enable row level security;
alter table public.orders      enable row level security;

-- profiles: eigene Zeile lesen/ändern (role/active bleiben clientseitig unberührt; harte Absicherung = B4/Trigger optional); Admins alles.
create policy profiles_select_self_or_admin on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_self_or_admin on public.profiles for update
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- Menü/Config: alle Authentifizierten lesen, nur Admins schreiben.
create policy ingredients_read on public.ingredients for select using (auth.role() = 'authenticated');
create policy ingredients_admin on public.ingredients for all using (public.is_admin()) with check (public.is_admin());
create policy sauces_read on public.sauces for select using (auth.role() = 'authenticated');
create policy sauces_admin on public.sauces for all using (public.is_admin()) with check (public.is_admin());
create policy vouchers_read on public.vouchers for select using (auth.role() = 'authenticated');
create policy vouchers_admin on public.vouchers for all using (public.is_admin()) with check (public.is_admin());
create policy config_read on public.app_config for select using (auth.role() = 'authenticated');
create policy config_admin on public.app_config for all using (public.is_admin()) with check (public.is_admin());

-- orders: Kunde legt eigene an + liest eigene; Admins lesen/ändern alle.
create policy orders_insert_own on public.orders for insert with check (user_id = auth.uid());
create policy orders_select_own on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy orders_admin_update on public.orders for update using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Build → grün** (Sanity — SQL berührt den Build nicht)

Run: `cd Frontend && bun run build`
Expected: unverändert grün.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0001_schema_rls.sql
git commit -m "feat(b1): Supabase-Schema + RLS-Migration (profiles, Domäne, orders)"
```

---

### Task 3: Seed-Migration (Domänen-Defaults)

**Files:**
- Create: `supabase/migrations/0002_seed.sql`

> Werte 1:1 aus `Frontend/src/lib/data/seed.ts` (`INGREDIENTS_DEFAULT`, `SAUCES_DEFAULT`, `VOUCHERS_INIT`, `DEFAULT_CONFIG`). Der Implementer liest `seed.ts` und überträgt die Daten exakt.

- [ ] **Step 1: Seed-Migration schreiben** (`supabase/migrations/0002_seed.sql`)

Struktur (der Implementer füllt die Zeilen exakt aus `seed.ts`):
```sql
-- Domänen-Defaults (idempotent via on conflict do nothing).
insert into public.ingredients (id, name, emoji, category, available, description) values
  ('mozzarella','Mozzarella','🧀','Käse',true,'Frischer ital. Mozzarella'),
  -- … alle Einträge aus INGREDIENTS_DEFAULT (Reihenfolge egal), inkl. artischocken available=false …
  ('peperoncini','Peperoncini','🫑','Gemüse',true,'Milde eingelegte Peperoncini')
on conflict (id) do nothing;

insert into public.sauces (id, name, emoji, color, available) values
  ('tomate','Tomate','🍅','#B03818',true),
  ('creme','Crème fraîche','🥛','#ECE3C8',true),
  ('bbq','BBQ','🍖','#7A3B1E',true),
  ('pesto','Pesto','🌿','#4B7A2F',true),
  ('keine','Ohne Soße','🚫','#E8C070',true)
on conflict (id) do nothing;

insert into public.vouchers (id, name, code, type, value, ingredient_name, expires_at, active, max_uses, uses) values
  ('v1','Willkommen','WELCOME10','percent',10,null,'2026-12-31',true,100,23),
  ('v2','Sommer','SOMMER15','percent',15,null,'2026-08-31',true,50,12),
  ('v3','Festrabatt','PIZZA5','fixed',5,null,'2026-09-30',false,200,87),
  ('v4','Special','WEED420','ingredient',0,'Weed 🌿','2026-12-31',true,50,4)
on conflict (id) do nothing;

insert into public.app_config (id, days, hours, lead_time_days, service) values
  (1,
   '{"Montag":true,"Dienstag":true,"Mittwoch":false,"Donnerstag":true,"Freitag":true,"Samstag":true,"Sonntag":false}'::jsonb,
   '{"from":"11:00","to":"21:00"}'::jsonb,
   3,
   '{"dineIn":false,"takeaway":true}'::jsonb)
on conflict (id) do nothing;
```
> **Wichtig:** Der Implementer überträgt ALLE Zutaten aus `INGREDIENTS_DEFAULT` (nicht nur die zwei Beispielzeilen) — exakt id/name/emoji/category/available/description.

- [ ] **Step 2: Build → grün** — Run: `cd Frontend && bun run build` — Expected: grün.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0002_seed.sql
git commit -m "feat(b1): Seed-Migration (Zutaten/Soßen/Gutscheine/Config)"
```

---

### Task 4: Edge Function `admin-users`

**Files:**
- Create: `supabase/functions/admin-users/index.ts`

> Deno/Supabase-Edge-Runtime. Berührt den Frontend-Build nicht. Nutzt die von Supabase injizierten Env-Vars `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (kein manuelles Secret nötig).

**Interfaces:**
- Produces (aufgerufen via `supabase.functions.invoke("admin-users", { body })`):
  - `{ action: "create", email, password, firstName, lastName, phone, role }` → `{ ok: true }` | `{ error }`
  - `{ action: "delete", userId }` → `{ ok: true }`
  - `{ action: "reset", userId, password }` → `{ ok: true }`

- [ ] **Step 1: Function schreiben** (`supabase/functions/admin-users/index.ts`)
```ts
// Supabase Edge Function: privilegierte Admin-Aktionen (service_role).
// Prüft, dass der Aufrufer ein aktiver Admin ist, bevor irgendetwas passiert.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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

  // 3) Aktion ausführen.
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "create") {
      const { error } = await admin.auth.admin.createUser({
        email: body.email, password: body.password, email_confirm: true,
        user_metadata: { first_name: body.firstName ?? "", last_name: body.lastName ?? "", phone: body.phone ?? "", role: body.role ?? "customer" },
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (body.action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(body.userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    if (body.action === "reset") {
      const { error } = await admin.auth.admin.updateUserById(body.userId, { password: body.password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }
    return json({ error: "Unbekannte Aktion." }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
```

- [ ] **Step 2: Build → grün** — Run: `cd Frontend && bun run build` — Expected: grün (Deno-Datei außerhalb des Vite-Builds).

- [ ] **Step 3: Commit**
```bash
git add supabase/functions/admin-users/index.ts
git commit -m "feat(b1): Edge Function admin-users (create/delete/reset, service_role)"
```

---

### Task 5: `store.ts` — Domänendaten auf Supabase

**Files:**
- Modify: `Frontend/src/lib/data/store.ts`

**Interfaces:**
- Consumes: `supabase` aus `@/lib/supabase`; Typen aus `@/types`.
- Produces (Signaturen unverändert): `getMenu`, `getIngredients`, `getSauces`, `getVouchers`, `getConfig`, `getDashboardStats`, `saveIngredients`, `saveSauces`, `saveVouchers`, `saveConfig`, `createOrder`.

> `getUsers`/`saveUsers`/`verifyLogin` bleiben in DIESEM Task **unverändert** (localStorage-Mock) — sie werden erst in Task 6 (Auth-Cutover) ersetzt. So bleibt der Build grün.

- [ ] **Step 1: Domänen-Funktionen umbauen**

Ersetze die Domänen-Getter/Setter + `createOrder` durch Supabase-Queries mit snake↔camel-Mapping. `getDashboardStats` bleibt Mock. Die Datei behält oben die Mock-Helfer (`read`/`write`/`delay`) nur so lange, wie `getUsers`/`saveUsers`/`verifyLogin` sie brauchen.
```ts
import type { AppConfig, IngredientItem, NewOrder, OrderData, PizzaTemplate, VoucherDef, Sauce, User } from "@/types";
import { TEMPLATES, USERS_DEFAULT, WEEK_DATA, PIE_DATA } from "./seed";
import { computeSubtotal, computeDiscount, computeTotal, validateVoucher } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
// Hinweis: INGREDIENTS_DEFAULT/SAUCES_DEFAULT/VOUCHERS_INIT/DEFAULT_CONFIG werden NICHT mehr importiert
// (Daten kommen jetzt aus Supabase). noUnusedLocals=true → ungenutzte Imports brächen den Build.

// ── localStorage-Mock nur noch für die (in Task 6 ersetzte) Auth ──
const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 120));
function read<T>(key: string, fallback: T): T { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; }
function write<T>(key: string, val: T): void { localStorage.setItem(key, JSON.stringify(val)); }

const genId = () => `#${Math.floor(10000 + Math.random() * 90000)}`;

// ── Menü/Zutaten/Soßen/Gutscheine/Config → Supabase ──
export async function getMenu(): Promise<PizzaTemplate[]> {
  // Menü-Templates bleiben statisch (nicht admin-verwaltet in Teil-A). TEIL-B-später: eigene Tabelle.
  return TEMPLATES.slice(0, 4);
}

export async function getIngredients(): Promise<IngredientItem[]> {
  const { data, error } = await supabase.from("ingredients").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, category: r.category, available: r.available, description: r.description }));
}
export async function saveIngredients(list: IngredientItem[]): Promise<void> {
  const rows = list.map((i) => ({ id: i.id, name: i.name, emoji: i.emoji, category: i.category, available: i.available, description: i.description }));
  const { error } = await supabase.from("ingredients").upsert(rows);
  if (error) throw error;
}

export async function getSauces(): Promise<Sauce[]> {
  const { data, error } = await supabase.from("sauces").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, color: r.color, available: r.available }));
}
export async function saveSauces(list: Sauce[]): Promise<void> {
  const { error } = await supabase.from("sauces").upsert(list.map((s) => ({ id: s.id, name: s.name, emoji: s.emoji, color: s.color, available: s.available })));
  if (error) throw error;
}

export async function getVouchers(): Promise<VoucherDef[]> {
  const { data, error } = await supabase.from("vouchers").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, code: r.code, type: r.type, value: Number(r.value), ingredientName: r.ingredient_name ?? undefined, expiresAt: r.expires_at, active: r.active, maxUses: r.max_uses, uses: r.uses }));
}
export async function saveVouchers(list: VoucherDef[]): Promise<void> {
  const rows = list.map((v) => ({ id: v.id, name: v.name, code: v.code, type: v.type, value: v.value, ingredient_name: v.ingredientName ?? null, expires_at: v.expiresAt, active: v.active, max_uses: v.maxUses, uses: v.uses }));
  const { error } = await supabase.from("vouchers").upsert(rows);
  if (error) throw error;
}

export async function getConfig(): Promise<AppConfig> {
  const { data, error } = await supabase.from("app_config").select("*").eq("id", 1).single();
  if (error) throw error;
  return { days: data.days, hours: data.hours, leadTimeDays: data.lead_time_days, service: data.service };
}
export async function saveConfig(config: AppConfig): Promise<void> {
  const { error } = await supabase.from("app_config").upsert({ id: 1, days: config.days, hours: config.hours, lead_time_days: config.leadTimeDays, service: config.service });
  if (error) throw error;
}

export const getDashboardStats = () => delay({ week: WEEK_DATA, toppings: PIE_DATA }); // TEIL-B-später: echte Aggregation

// ── Bestellung → Supabase insert (Preislogik client-seitig; Härtung = B4) ──
export async function createOrder(input: NewOrder): Promise<OrderData> {
  const vouchers = await getVouchers();
  const applied = input.voucherCode
    ? (() => { const r = validateVoucher(input.voucherCode!, vouchers, new Date()); return r.ok ? r.voucher : null; })()
    : null;
  const subtotal = computeSubtotal(input.items.length);
  const discount = computeDiscount(subtotal, applied);
  const { data: sess } = await supabase.auth.getUser();
  const order: OrderData = {
    id: genId(), items: input.items, subtotal, discount, total: computeTotal(subtotal, discount),
    freeIngredient: applied?.type === "ingredient" ? applied.ingredientName : undefined,
    customer: input.customer, notes: input.notes, pickupDate: input.pickupDate, pickupTime: input.pickupTime,
    serviceMode: input.serviceMode ?? "takeaway", voucherCode: applied?.code,
  };
  const { error } = await supabase.from("orders").insert({
    id: order.id, user_id: sess.user?.id ?? null, items: order.items,
    subtotal: order.subtotal, discount: order.discount, total: order.total,
    free_ingredient: order.freeIngredient ?? null, service_mode: order.serviceMode,
    pickup_date: order.pickupDate, pickup_time: order.pickupTime, notes: order.notes,
    voucher_code: order.voucherCode ?? null, status: "eingegangen",
  });
  if (error) throw error;
  return order;
}

// ── (TASK 6 ersetzt diese Mock-Auth) ──
export const getUsers = () => delay(read<User[]>("pizza-users", USERS_DEFAULT));
export const saveUsers = (list: User[]) => delay(write("pizza-users", list));
export async function verifyLogin(username: string, password: string): Promise<User | null> {
  const users = read<User[]>("pizza-users", USERS_DEFAULT);
  return delay(users.find((x) => x.username === username && x.password === password && x.active) ?? null);
}
```
> `OrderData.customer` bleibt im Typ; wir speichern es nicht separat in der DB-Spalte (Name/Telefon stecken in der Bestellung über den `user_id`-Bezug bzw. `items`/Anzeige). Falls die Bestätigung `order.customer` braucht, bleibt es im zurückgegebenen Objekt erhalten (aus `input.customer`).

- [ ] **Step 2: Build → grün**

Run: `cd Frontend && bun run build`
Expected: grün. (`getUsers`/`saveUsers`/`verifyLogin` + `USERS_DEFAULT` noch vorhanden → keine offenen Referenzen.)

- [ ] **Step 3: Reine Tests → grün** — Run: `cd Frontend && bun test src` — Expected: unverändert grün (Store-Tests, die localStorage prüften, existieren für Domänendaten nicht mehr als Unit-Test; `users.test.ts` prüft weiterhin die Mock-Auth und bleibt hier grün).

- [ ] **Step 4: Commit**
```bash
git add Frontend/src/lib/data/store.ts
git commit -m "feat(b1): store Domänendaten + Bestellungen auf Supabase"
```

---

### Task 6: Auth-Cutover (E-Mail) — Typen, useAuth, Seiten, Store-Users

**Files:**
- Modify: `Frontend/src/types/index.ts`
- Modify: `Frontend/src/lib/auth.ts`
- Modify: `Frontend/src/hooks/use-auth.tsx`
- Modify: `Frontend/src/lib/data/store.ts`
- Modify: `Frontend/src/lib/data/seed.ts`
- Modify: `Frontend/src/pages/login/login-page.tsx`
- Modify: `Frontend/src/pages/profile/profile-page.tsx`
- Modify: `Frontend/src/pages/admin/users-page.tsx`
- Delete: `Frontend/src/hooks/__tests__/use-auth.test.tsx`, `Frontend/src/lib/data/__tests__/users.test.ts`
- Modify: `Frontend/src/lib/__tests__/auth.test.ts`

> **Atomarer Cutover (ein Commit):** die `User`-Typänderung bricht sonst alle Konsumenten. Erst grün, wenn alle Dateien umgestellt sind.

**Interfaces:**
- Produces:
```ts
interface User { id: string; email: string; firstName: string; lastName: string; phone: string; role: Role; active: boolean }
// useAuth:
login(email: string, password: string): Promise<{ user: User | null; error: string | null }>
logout(): Promise<void>
updateOwnProfile(patch: Partial<Pick<User,"firstName"|"lastName"|"phone">>): Promise<void>
updatePassword(newPassword: string): Promise<void>
requestPasswordReset(email: string): Promise<void>
// store:
getProfiles(): Promise<User[]>
setProfileActive(id: string, active: boolean): Promise<void>
adminCreateUser(input: { email; password; firstName; lastName; phone; role: Role }): Promise<string | null> // null=ok, sonst Fehlertext
adminDeleteUser(id: string): Promise<void>
adminResetPassword(id: string, password: string): Promise<void>
// lib/auth:
emailTaken(users: User[], email: string): boolean
```

- [ ] **Step 1: `types/index.ts` — `User` umstellen**

Ersetze das `User`-Interface (username/password raus, email rein):
```ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: Role;
  active: boolean;
}
```

- [ ] **Step 2: `lib/auth.ts` — `usernameTaken` → `emailTaken`**
```ts
export function emailTaken(users: User[], email: string): boolean {
  return users.some((u) => u.email.toLowerCase() === email.toLowerCase());
}
```
(`redirectFor` bleibt unverändert.)

- [ ] **Step 3: `lib/__tests__/auth.test.ts` anpassen** — `usernameTaken`-Tests auf `emailTaken` umstellen und die Test-User auf das neue `User`-Shape (email statt username/password):
```ts
import { emailTaken, redirectFor } from "@/lib/auth";
import type { User } from "@/types";
const admin: User = { id: "1", email: "mo@pizza.de", firstName: "", lastName: "", phone: "", role: "admin", active: true };
const cust: User  = { id: "2", email: "kim@pizza.de", firstName: "", lastName: "", phone: "", role: "customer", active: true };
// … usernameTaken-Block ersetzen:
describe("emailTaken", () => {
  it("erkennt vergebene E-Mail (case-insensitiv)", () => expect(emailTaken([admin], "MO@pizza.de")).toBe(true));
  it("freie E-Mail", () => expect(emailTaken([admin], "kim@pizza.de")).toBe(false));
});
// … die redirectFor-Tests: admin/cust-Objekte oben verwenden (role unverändert), Rest bleibt.
```

- [ ] **Step 4: `hooks/use-auth.tsx` — Supabase Auth**
```tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@/types";
import { supabase } from "@/lib/supabase";

interface AuthContextValue {
  currentUser: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<{ user: User | null; error: string | null }>;
  logout(): Promise<void>;
  updateOwnProfile(patch: Partial<Pick<User, "firstName" | "lastName" | "phone">>): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

// Baut aus Auth-User-id + profiles-Zeile den App-User. Liefert null, wenn inaktiv.
async function loadProfile(id: string, email: string): Promise<User | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!data || !data.active) return null;
  return { id, email, firstName: data.first_name, lastName: data.last_name, phone: data.phone, role: data.role, active: data.active };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      const u = s?.user ? await loadProfile(s.user.id, s.user.email ?? "") : null;
      if (active) { setCurrentUser(u); setLoading(false); }
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const u = session?.user ? await loadProfile(session.user.id, session.user.email ?? "") : null;
      if (active) setCurrentUser(u);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { user: null, error: "E-Mail oder Passwort falsch." };
    const u = await loadProfile(data.user.id, data.user.email ?? "");
    if (!u) { await supabase.auth.signOut(); return { user: null, error: "Konto ist deaktiviert." }; }
    setCurrentUser(u);
    return { user: u, error: null };
  };

  const logout = async () => { await supabase.auth.signOut(); setCurrentUser(null); };

  const updateOwnProfile = async (patch: Partial<Pick<User, "firstName" | "lastName" | "phone">>) => {
    if (!currentUser) return;
    const row: Record<string, string> = {};
    if (patch.firstName !== undefined) row.first_name = patch.firstName;
    if (patch.lastName !== undefined) row.last_name = patch.lastName;
    if (patch.phone !== undefined) row.phone = patch.phone;
    const { error } = await supabase.from("profiles").update(row).eq("id", currentUser.id);
    if (error) throw error;
    setCurrentUser({ ...currentUser, ...patch });
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  const requestPasswordReset = async (email: string) => {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/passwort-reset` });
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout, updateOwnProfile, updatePassword, requestPasswordReset }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 5: `store.ts` — Mock-Auth raus, Profile-Funktionen rein**

Entferne `getUsers`/`saveUsers`/`verifyLogin` + die jetzt ungenutzten Mock-Helfer (`read`/`write`) und `USERS_DEFAULT` aus dem Import. `delay` bleibt für `getDashboardStats`. Ergänze:
```ts
import { supabase } from "@/lib/supabase";
// (USERS_DEFAULT aus dem ./seed-Import entfernen)

export async function getProfiles(): Promise<User[]> {
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) throw error;
  // E-Mail liegt in auth.users; für die Liste zeigen wir sie via RPC/Join nicht — Teil-A-Liste nutzt Name/Telefon/Rolle.
  return (data ?? []).map((r) => ({ id: r.id, email: r.email ?? "", firstName: r.first_name, lastName: r.last_name, phone: r.phone, role: r.role, active: r.active }));
}
export async function setProfileActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) throw error;
}
async function invokeAdmin(body: Record<string, unknown>): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) return error.message;
  if (data && (data as { error?: string }).error) return (data as { error: string }).error;
  return null;
}
export const adminCreateUser = (input: { email: string; password: string; firstName: string; lastName: string; phone: string; role: User["role"] }) =>
  invokeAdmin({ action: "create", ...input });
export const adminDeleteUser = (id: string) => invokeAdmin({ action: "delete", userId: id }).then((e) => { if (e) throw new Error(e); });
export const adminResetPassword = (id: string, password: string) => invokeAdmin({ action: "reset", userId: id, password }).then((e) => { if (e) throw new Error(e); });
```
> **E-Mail in der Profil-Liste:** `profiles` hält keine E-Mail (die liegt in `auth.users`). Für die Admin-Liste ergänzt der Implementer eine SQL-View oder eine `email`-Spalte, die der Trigger aus `new.email` mitschreibt. **Einfachste Lösung (im Plan gewählt):** in Migration 0001 der `profiles`-Tabelle eine Spalte `email text` geben und im Trigger `new.email` mitschreiben. Der Implementer ergänzt in Task 6 diese Spalte per neuer Migration `supabase/migrations/0003_profiles_email.sql`:
```sql
alter table public.profiles add column if not exists email text not null default '';
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone, role)
  values (new.id, coalesce(new.email,''),
    coalesce(new.raw_user_meta_data->>'first_name',''),
    coalesce(new.raw_user_meta_data->>'last_name',''),
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce(new.raw_user_meta_data->>'role','customer'));
  return new;
end; $$;
```

- [ ] **Step 6: `login-page.tsx` — E-Mail + „Passwort vergessen"**

Ersetze das Benutzername-Feld durch ein E-Mail-Feld; `attempt` nutzt das neue `login`-Ergebnis; ergänze einen „Passwort vergessen?"-Link, der `requestPasswordReset(email)` ruft und eine Bestätigung zeigt.
```tsx
  const { login, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string>("");
  const [info, setInfo] = useState<string>("");

  const attempt = async () => {
    const { user, error } = await login(email.trim(), pw);
    if (user) navigate(user.role === "admin" ? "/admin/dashboard" : "/", { replace: true });
    else { setErr(error ?? "Login fehlgeschlagen."); setTimeout(() => setErr(""), 2500); }
  };
  const forgot = async () => {
    if (!email.trim()) { setErr("Bitte E-Mail eingeben."); setTimeout(() => setErr(""), 2500); return; }
    await requestPasswordReset(email.trim());
    setInfo("Falls das Konto existiert, wurde eine E-Mail zum Zurücksetzen gesendet.");
    setTimeout(() => setInfo(""), 4000);
  };
```
Feld: `<Input id="em" type="email" placeholder="du@example.de" value={email} onChange={(e)=>setEmail(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&attempt()} />`, Label „E-Mail"; Fehler `{err && …}`; unter dem Anmelden-Button: `<button onClick={forgot} className="text-xs text-muted-foreground hover:text-foreground">Passwort vergessen?</button>` und `{info && <p className="text-xs text-green-400">{info}</p>}`.

- [ ] **Step 7: `profile-page.tsx` — E-Mail (read-only) + Passwort via Supabase**

`currentUser.email` statt `username` (read-only anzeigen). Speichern der Profilfelder via `updateOwnProfile({firstName,lastName,phone})`; Passwortänderung via `updatePassword(pw)` (nur wenn `pw` gesetzt und `pw===pw2`). Beispiel `save`:
```tsx
  const { currentUser, updateOwnProfile, updatePassword, logout } = useAuth();
  const save = async () => {
    if (pw && pw !== pw2) { setMsg("Passwörter stimmen nicht überein."); return; }
    await updateOwnProfile({ firstName, lastName, phone });
    if (pw) await updatePassword(pw);
    setPw(""); setPw2(""); setMsg("Gespeichert."); setTimeout(() => setMsg(""), 2000);
  };
```
Das „Benutzername"-Feld wird zu „E-Mail": `<Input value={currentUser?.email ?? ""} disabled />`. `doLogout` bleibt (`await logout(); navigate("/login")`).

- [ ] **Step 8: `users-page.tsx` — E-Mail + Edge-Function**

Form-Feld „Benutzername" → „E-Mail" (`type="email"`); `EMPTY` bekommt `email` statt `username`. Validierung nutzt `emailTaken(list, form.email)`. Laden via `getProfiles()` (statt `getUsers`). Anlegen via `adminCreateUser(...)` (zeigt Fehlertext bei Rückgabe); nach Erfolg neu laden. Aktiv-Toggle via `setProfileActive(id, next)`. Löschen via `adminDeleteUser(id)`. Passwort-Reset via `adminResetPassword(id, resetPw)`. Liste zeigt `u.email` statt `u.username`. Selbstschutz `isSelf` bleibt (`u.id === currentUser?.id`).
```tsx
import { getProfiles, setProfileActive, adminCreateUser, adminDeleteUser, adminResetPassword } from "@/lib/data/store";
import { emailTaken } from "@/lib/auth";
const EMPTY = { email: "", firstName: "", lastName: "", phone: "", password: "", role: "customer" as Role };
// … const { data, loading, error } = useAsync(getProfiles);
const addUser = async () => {
  if (!list) return;
  if (!form.email.trim() || !form.password.trim()) { setFormErr("E-Mail und Passwort sind Pflicht."); return; }
  if (emailTaken(list, form.email.trim())) { setFormErr("Diese E-Mail existiert bereits."); return; }
  const errMsg = await adminCreateUser({ email: form.email.trim(), password: form.password, firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim(), role: form.role });
  if (errMsg) { setFormErr(errMsg); return; }
  setForm(EMPTY); setFormErr(""); setShowForm(false);
  const fresh = await getProfiles(); setList(fresh);
};
```
> Aktiv/Löschen/Reset arbeiten jetzt einzeln gegen die DB/Function (kein `saveUsers(list)` mehr). Nach jeder Aktion `setList(await getProfiles())` oder lokal patchen. Die `mutate(next)`-Bulk-Logik entfällt.

- [ ] **Step 9: Mock-Auth-Tests löschen**
```bash
git rm Frontend/src/hooks/__tests__/use-auth.test.tsx Frontend/src/lib/data/__tests__/users.test.ts
```

- [ ] **Step 10: `seed.ts` — `USERS_DEFAULT` entfernen** (wird nicht mehr importiert). Domänen-Konstanten (`INGREDIENTS_DEFAULT` etc.) bleiben vorerst (von `getMenu`/Referenz genutzt bzw. für die Seed-Migration-Vorlage) — nur `USERS_DEFAULT` streichen.

- [ ] **Step 11: Verifizieren**

Run: `cd Frontend && grep -rIn "username\|verifyLogin\|\.password" src/pages src/hooks src/lib/auth.ts || echo "sauber"`
Expected: keine Treffer auf das alte Auth-Modell (bis auf ggf. Kommentare) → `sauber`.
Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; reine Logik-Tests grün (auth/pricing/slots/sauces). Die zwei gelöschten Mock-Auth-Tests sind weg.

- [ ] **Step 12: Commit**
```bash
git add Frontend/src supabase/migrations/0003_profiles_email.sql
git commit -m "feat(b1): Auth-Cutover auf Supabase (E-Mail), Mock-Auth entfernt"
```

---

### Task 7: Passwort-Reset-Seite

**Files:**
- Create: `Frontend/src/pages/auth/reset-password-page.tsx`
- Modify: `Frontend/src/router.tsx`

**Interfaces:**
- Consumes: `useAuth().updatePassword`.

- [ ] **Step 1: Reset-Seite** (`Frontend/src/pages/auth/reset-password-page.tsx`)
```tsx
import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// Ziel des Passwort-Reset-Links. Supabase stellt beim Öffnen eine Recovery-Session her,
// sodass updateUser({password}) hier funktioniert.
export default function ResetPasswordPage(): React.ReactElement {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    if (!pw || pw !== pw2) { setMsg("Passwörter stimmen nicht überein."); return; }
    try { await updatePassword(pw); setMsg("Passwort geändert. Weiter zum Login…"); setTimeout(() => navigate("/login", { replace: true }), 1500); }
    catch { setMsg("Reset-Link abgelaufen oder ungültig. Bitte erneut anfordern."); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-black text-center">Neues Passwort</h1>
        <Card><CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5"><Label htmlFor="p1">Neues Passwort</Label>
            <Input id="p1" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="p2">Bestätigen</Label>
            <Input id="p2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
          <Button className="w-full gap-2" onClick={submit}><Check size={15} /> Speichern</Button>
        </CardContent></Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Route ergänzen** (`router.tsx`): Import `ResetPasswordPage` und als **öffentliche** Route (wie `/login`):
```tsx
  { path: "/passwort-reset", element: <ResetPasswordPage /> },
```

- [ ] **Step 3: Build → grün** — Run: `cd Frontend && bun run build` — Expected: grün.

- [ ] **Step 4: Commit**
```bash
git add Frontend/src/pages/auth Frontend/src/router.tsx
git commit -m "feat(b1): Passwort-Reset-Seite + Route"
```

---

### Task 8: SETUP-Doku, ADR & Gesamt-Verifikation

**Files:**
- Create: `Doku/Pizza/SETUP-Supabase.md`, `Doku/Pizza/Entscheidungen/ADR-0006-supabase-cutover.md`
- Modify: `Doku/Pizza/Changelog.md`, `Doku/Pizza/TODO.md`, `Frontend/README.md`

- [ ] **Step 1: Gesamt-Verifikation**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; reine Logik-Tests grün.

- [ ] **Step 2: SETUP-Anleitung** (`Doku/Pizza/SETUP-Supabase.md`): Schritt-für-Schritt:
  1. Supabase-Projekt anlegen (supabase.com).
  2. Migrationen ausführen: Supabase CLI (`supabase link`, `supabase db push`) **oder** SQL-Editor: Inhalt von `0001`, `0002`, `0003` in Reihenfolge einfügen/ausführen.
  3. Edge Function deployen: `supabase functions deploy admin-users`.
  4. Bootstrap-Admin: Dashboard → Authentication → Add user (E-Mail + Passwort für „Mo"), dann SQL: `update public.profiles set role='admin' where email='<mo-email>';`.
  5. `Frontend/.env.example` → `.env.local` kopieren, `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (Dashboard → Settings → API) eintragen.
  6. `cd Frontend && bun run dev` → mit Mos E-Mail einloggen → Klick-Test (Menü lädt aus DB, Bestellung landet in `orders`, Admin legt Nutzer an).
  **Sicherheitshinweis:** service_role-Key nie ins Repo/Frontend; RLS ist die Grenze; Preis-/Vorlauf-Validierung ist noch client-seitig (B4 härtet sie).

- [ ] **Step 3: ADR-0006** (Template `Doku/Pizza/Templates/_adr.md`): „Cutover Teil-A-Mocks → Supabase (B1)". Problem, Optionen (supabase-js hinter der Naht / eigenes Backend-API / weiter mocken), Entscheidung supabase-js + RLS + eine Edge Function, Begründung (Naht zahlt sich aus, minimaler Neucode), Nachteile (nicht in dieser Umgebung testbar; Client-Validierung bis B4), Auswirkungen (Auth E-Mail statt Benutzername; B2–B4 folgen).

- [ ] **Step 4: Changelog + README + TODO**

`Doku/Pizza/Changelog.md` (oben, 2026-07-11): „Teil-B1: Supabase-Cutover — E-Mail-Auth, RLS, alle Domänendaten + Bestellungen aus Supabase; Edge Function `admin-users`; Passwort-Reset. localStorage-Mock (inkl. Klartext-Passwörter) entfernt. Hier nur Build/Typecheck verifiziert; Ausführung gegen Supabase durch Betreiber."
`Frontend/README.md`: Abschnitt „Supabase (Teil-B1)" — `.env.local`-Keys, Verweis auf `Doku/Pizza/SETUP-Supabase.md`, Hinweis „Auth jetzt E-Mail-basiert".
`Doku/Pizza/TODO.md`: „Teil-B1 (Supabase-Fundament + Auth) — erledigt"; B2/B3/B4 als offen belassen; neue Zeile „Supabase-Setup durch Betreiber ausführen + Klick-Test".

- [ ] **Step 5: Commit**
```bash
git add Doku/ Frontend/README.md
git commit -m "docs(b1): SETUP-Supabase, ADR-0006, Changelog/README/TODO"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** Client/Env → T1; Schema/RLS/is_admin → T2; Seed → T3; Edge Function (admin create/delete/reset) → T4; store Domänen+orders → T5; Auth E-Mail (Typen/useAuth/Seiten/store-Profiles) + Mock-Entfernung → T6; profiles.email-Spalte → T6/0003; Passwort-Reset → T6 (Anfordern) + T7 (Setzen); SETUP/ADR/Doku + Verifikation → T8. Nicht-Ziele (Realtime/WhatsApp/Server-Validierung/Dashboard-Aggregation) bewusst ausgelassen.
- **Grün ohne Supabase:** jeder Task verifiziert nur `bun run build` + reine Tests; SQL/Edge-Dateien sind nicht Teil des Vite-Builds; supabase-js typt ohne Verbindung. T1–T5 halten die alte Mock-Auth lauffähig; T6 stellt atomar um.
- **Typ-/Signatur-Konsistenz:** `User` (T6) mit `email` durchgängig in useAuth/Seiten/store/auth.ts; `getProfiles/setProfileActive/adminCreateUser/adminDeleteUser/adminResetPassword` (T6) in users-page (T6) genutzt; `login`-Rückgabe `{user,error}` (T6) in login-page (T6) genutzt; `emailTaken` (T6) in auth.test + users-page. `supabase` (T1) in store (T5/T6) + useAuth (T6).
- **Reihenfolge:** Auth-Umbau (T6) erst nach Client (T1) + store-Domäne (T5); `verifyLogin`/`getUsers`/`USERS_DEFAULT` existieren bis inkl. T5 unverändert → Build grün; T6 entfernt sie atomar.
- **Platzhalter:** Seed-Zeilen (T3) sind bewusst als „vollständig aus seed.ts übertragen" markiert (Daten, kein Logik-Platzhalter); reset-page-Tippfehler in Step 1 ist im Hinweis korrigiert.
