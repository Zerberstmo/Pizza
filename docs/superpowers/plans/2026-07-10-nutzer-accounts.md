# Nutzer-Accounts (Login, Profil, Admin-Nutzerverwaltung) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein rollenbasiertes Account-System (Login-Gate, Profil-Selbstbearbeitung, Admin-Nutzerverwaltung) als localStorage-Mock, das die bisherige `useAdminAuth`-Passwort-Anmeldung ersetzt.

**Architecture:** `User`-Entität in der async localStorage-Datenschicht (`store.ts`, Naht → Teil-B Supabase). `useAuth`-Context hält den angemeldeten Nutzer (sessionStorage). Reine Guard-/Validierungs-Helfer (`lib/auth.ts`) sind getestet; Wrapper-Komponenten (`RequireCustomer`/`RequireAdmin`/`RequireAuth`) gaten die Routen nach Rolle. Erst wird das neue System additiv aufgebaut, dann in einem atomaren Cutover-Task umgeschaltet und die alte Mock-Auth gelöscht.

**Tech Stack:** Bun, Vite 6, React 18, TypeScript, Tailwind v4, shadcn/ui, react-router 7, motion, lucide-react. Tests: **bun:test** (`bun test src`) + happy-dom + @testing-library/react.

## Global Constraints

- **Package-Manager & Runner: ausschließlich Bun.** Test: `bun test src` (NICHT Vitest). Build: `bun run build`. Alle Befehle aus `Frontend/` (`cd Frontend`).
- **Sicherheit:** Passwörter liegen im Mock **im Klartext** in `localStorage` — nur für Teil-A vertretbar, **nicht betriebssicher**. Jede betroffene Stelle trägt einen `TEIL-B TODO`-Kommentar. Teil-B ersetzt alles durch Supabase-Auth.
- **Alle Daten laufen über `lib/data/store.ts`** (async). Seiten importieren keine Seed-Konstanten direkt.
- **Rollen:** `type Role = "customer" | "admin"`. Start-Admin im Seed: `username: "Mo"`, `password: "pizza"`, `role: "admin"`.
- **Kein öffentliches Registrieren** (nur Admin legt Nutzer an). Kein E-Mail-Reset. **Benutzername unveränderlich** (nur Admin vergibt ihn).
- **Build muss nach jedem Task grün sein.** `useAdminAuth`/`verifyAdminPassword`/`ADMIN_PASSWORD`/`pages/admin/login-page.tsx` werden erst in Task 5 entfernt.
- Dateinamen `kebab-case`, Komponenten `PascalCase`. Preis-/Bestell-Logik unverändert.
- **Referenz-Spec:** `docs/superpowers/specs/2026-07-10-nutzer-accounts-design.md`.

---

## Dateistruktur (Ziel)

```
Frontend/src/
├── types/index.ts                          (M) Role, User
├── lib/
│   ├── auth.ts                             (N) usernameTaken(), redirectFor()
│   └── data/{seed.ts, store.ts}            (M) USERS_DEFAULT (Mo); getUsers/saveUsers/verifyLogin; (T5) ADMIN_PASSWORD/verifyAdminPassword entfernt
├── hooks/
│   ├── use-auth.tsx                         (N) AuthProvider + useAuth
│   └── use-admin-auth.ts                    (T5 DELETE)
├── components/layout/
│   ├── require-auth.tsx                     (N) RequireAuth/RequireCustomer/RequireAdmin
│   ├── bottom-nav.tsx                       (T5 M) Admin-Tab → Profil
│   └── admin-shell.tsx                      (T5 M) useAuth statt useAdminAuth + Nutzer-Nav + Profil-Link
├── pages/
│   ├── login/login-page.tsx                (N) Login (Benutzername+Passwort)
│   ├── profile/profile-page.tsx            (N) Mein Profil
│   ├── admin/users-page.tsx                (N) Nutzerverwaltung
│   ├── admin/login-page.tsx                (T5 DELETE)
│   └── checkout/checkout-page.tsx          (T6 M) Vorausfüllung aus currentUser
├── app.tsx                                 (T3 M) AuthProvider
└── router.tsx                              (T4/T5 M) /login, /profil, Guards, Cutover
```

---

### Task 1: Datenmodell, Seed & Store (User, verifyLogin)

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/data/seed.ts`
- Modify: `src/lib/data/store.ts`
- Test: `src/lib/data/__tests__/users.test.ts` (neu)

**Interfaces:**
- Produces:
```ts
type Role = "customer" | "admin";
interface User { id: string; username: string; password: string; firstName: string; lastName: string; phone: string; role: Role; active: boolean }
export const USERS_DEFAULT: User[];
export function getUsers(): Promise<User[]>;
export function saveUsers(list: User[]): Promise<void>;
export function verifyLogin(username: string, password: string): Promise<User | null>;
```

- [ ] **Step 1: Typen ergänzen** in `src/types/index.ts` (am Dateiende):
```ts
export type Role = "customer" | "admin";

export interface User {
  id: string;
  username: string;   // Login-Kennung, eindeutig, admin-vergeben, unveränderlich
  password: string;   // TEIL-B TODO: Klartext nur im Mock → Supabase-Hash
  firstName: string;
  lastName: string;
  phone: string;
  role: Role;
  active: boolean;
}
```

- [ ] **Step 2: Seed ergänzen** in `src/lib/data/seed.ts`.

Typ-Import um `User` erweitern (bestehende `import type { … } from "@/types";`-Zeile). Danach ergänzen (der bestehende `ADMIN_PASSWORD`-Export bleibt vorerst unberührt — er wird erst in Task 5 entfernt):
```ts
// TEIL-B TODO: Nutzer + Passwörter kommen in Teil-B aus Supabase-Auth (gehasht, serverseitig).
export const USERS_DEFAULT: User[] = [
  { id: "u1", username: "Mo", password: "pizza", firstName: "Mo", lastName: "", phone: "", role: "admin", active: true },
];
```

- [ ] **Step 3: Failing test `users.test.ts`**
```ts
import { describe, it, expect, beforeEach } from "bun:test";
import { getUsers, saveUsers, verifyLogin } from "@/lib/data/store";
import type { User } from "@/types";

beforeEach(() => localStorage.clear());

const mo: User = { id: "u1", username: "Mo", password: "pizza", firstName: "Mo", lastName: "", phone: "", role: "admin", active: true };

describe("users store", () => {
  it("getUsers returns seed by default", async () => {
    expect((await getUsers())[0].username).toBe("Mo");
  });
  it("verifyLogin: korrekt → User", async () => {
    expect((await verifyLogin("Mo", "pizza"))?.username).toBe("Mo");
  });
  it("verifyLogin: falsches Passwort → null", async () => {
    expect(await verifyLogin("Mo", "falsch")).toBeNull();
  });
  it("verifyLogin: unbekannter Benutzer → null", async () => {
    expect(await verifyLogin("Nöö", "pizza")).toBeNull();
  });
  it("verifyLogin: inaktiver Nutzer → null", async () => {
    await saveUsers([{ ...mo, active: false }]);
    expect(await verifyLogin("Mo", "pizza")).toBeNull();
  });
});
```

- [ ] **Step 4: Run → FAIL**

Run: `cd Frontend && bun test src/lib/data/__tests__/users.test.ts`
Expected: FAIL (`getUsers`/`verifyLogin` nicht exportiert).

- [ ] **Step 5: Store implementieren** in `src/lib/data/store.ts`.

Typ-Import um `User` erweitern; `./seed`-Import um `USERS_DEFAULT` erweitern. Bei den anderen `get*`/`save*` einfügen:
```ts
export const getUsers = () => delay(read<User[]>("pizza-users", USERS_DEFAULT));
export const saveUsers = (list: User[]) => delay(write("pizza-users", list));

// TEIL-B TODO: durch Supabase-Auth ersetzen (serverseitige Prüfung, gehashte Passwörter).
export async function verifyLogin(username: string, password: string): Promise<User | null> {
  const users = read<User[]>("pizza-users", USERS_DEFAULT);
  const u = users.find((x) => x.username === username && x.password === password && x.active);
  return delay(u ?? null);
}
```

- [ ] **Step 6: Run → PASS**

Run: `cd Frontend && bun test src/lib/data/__tests__/users.test.ts`
Expected: PASS.

- [ ] **Step 7: Build + Commit**

Run: `cd Frontend && bun run build` → grün (`verifyAdminPassword`/`ADMIN_PASSWORD` sind noch da, brechen nichts).
```bash
git add Frontend/src/types Frontend/src/lib/data
git commit -m "feat(frontend): User-Typ, Seed (Mo) & Store (getUsers/saveUsers/verifyLogin)"
```

---

### Task 2: Reine Guard-/Validierungs-Helfer (`lib/auth.ts`)

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `User` aus `@/types`.
- Produces:
```ts
export function usernameTaken(users: User[], username: string): boolean;
export type GuardKind = "auth" | "customer" | "admin";
export function redirectFor(user: User | null, kind: GuardKind): string | null; // null = Zugriff erlaubt
```

- [ ] **Step 1: Failing test `auth.test.ts`**
```ts
import { describe, it, expect } from "bun:test";
import { usernameTaken, redirectFor } from "@/lib/auth";
import type { User } from "@/types";

const admin: User = { id: "1", username: "Mo", password: "p", firstName: "", lastName: "", phone: "", role: "admin", active: true };
const cust: User  = { id: "2", username: "Kim", password: "p", firstName: "", lastName: "", phone: "", role: "customer", active: true };

describe("usernameTaken", () => {
  it("erkennt vergebenen Namen", () => expect(usernameTaken([admin], "Mo")).toBe(true));
  it("freier Name", () => expect(usernameTaken([admin], "Kim")).toBe(false));
});

describe("redirectFor", () => {
  it("nicht eingeloggt → /login", () => {
    expect(redirectFor(null, "auth")).toBe("/login");
    expect(redirectFor(null, "customer")).toBe("/login");
    expect(redirectFor(null, "admin")).toBe("/login");
  });
  it("customer darf Kundenbereich, nicht Admin", () => {
    expect(redirectFor(cust, "customer")).toBeNull();
    expect(redirectFor(cust, "admin")).toBe("/");
    expect(redirectFor(cust, "auth")).toBeNull();
  });
  it("admin darf Adminbereich, nicht Kundenbereich", () => {
    expect(redirectFor(admin, "admin")).toBeNull();
    expect(redirectFor(admin, "customer")).toBe("/admin/dashboard");
    expect(redirectFor(admin, "auth")).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL** — Run: `cd Frontend && bun test src/lib/__tests__/auth.test.ts` — Expected: FAIL (Modul fehlt).

- [ ] **Step 3: `lib/auth.ts` implementieren**
```ts
import type { User } from "@/types";

export function usernameTaken(users: User[], username: string): boolean {
  return users.some((u) => u.username === username);
}

export type GuardKind = "auth" | "customer" | "admin";

// Liefert den Ziel-Pfad für einen Redirect oder null, wenn der Zugriff erlaubt ist.
export function redirectFor(user: User | null, kind: GuardKind): string | null {
  if (!user) return "/login";
  if (kind === "admin" && user.role !== "admin") return "/";
  if (kind === "customer" && user.role !== "customer") return "/admin/dashboard";
  return null;
}
```

- [ ] **Step 4: Run → PASS** — Run: `cd Frontend && bun test src/lib/__tests__/auth.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add Frontend/src/lib/auth.ts Frontend/src/lib/__tests__/auth.test.ts
git commit -m "feat(frontend): reine Auth-Helfer usernameTaken + redirectFor (getestet)"
```

---

### Task 3: `useAuth`-Hook + AuthProvider

**Files:**
- Create: `src/hooks/use-auth.tsx`
- Modify: `src/app.tsx`
- Test: `src/hooks/__tests__/use-auth.test.tsx`

**Interfaces:**
- Consumes: `getUsers`, `saveUsers`, `verifyLogin` (store); `User` aus `@/types`.
- Produces:
```ts
function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element
function useAuth(): {
  currentUser: User | null;
  loading: boolean;
  login(username: string, password: string): Promise<User | null>;
  logout(): void;
  updateOwnProfile(patch: Partial<Pick<User, "firstName" | "lastName" | "phone" | "password">>): Promise<void>;
}
```

- [ ] **Step 1: Failing test `use-auth.test.tsx`**
```tsx
import { describe, it, expect, beforeEach } from "bun:test";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
beforeEach(() => localStorage.clear());

describe("useAuth", () => {
  it("startet ohne angemeldeten Nutzer", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentUser).toBeNull();
  });
  it("login mit Mo/pizza setzt currentUser + sessionStorage", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.login("Mo", "pizza"); });
    expect(result.current.currentUser?.username).toBe("Mo");
    expect(sessionStorage.getItem("pizza-auth")).toBe("u1");
  });
  it("logout löscht currentUser", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.login("Mo", "pizza"); });
    act(() => result.current.logout());
    expect(result.current.currentUser).toBeNull();
    expect(sessionStorage.getItem("pizza-auth")).toBeNull();
  });
  it("updateOwnProfile persistiert und lässt username/role unangetastet", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.login("Mo", "pizza"); });
    await act(async () => { await result.current.updateOwnProfile({ phone: "0123" }); });
    expect(result.current.currentUser?.phone).toBe("0123");
    expect(result.current.currentUser?.username).toBe("Mo");
    expect(result.current.currentUser?.role).toBe("admin");
    expect(localStorage.getItem("pizza-users")).toContain("0123");
  });
});
```

- [ ] **Step 2: Run → FAIL** — Run: `cd Frontend && bun test src/hooks/__tests__/use-auth.test.tsx` — Expected: FAIL (Modul fehlt).

- [ ] **Step 3: `use-auth.tsx` implementieren**
```tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@/types";
import { getUsers, saveUsers, verifyLogin } from "@/lib/data/store";

// Mock-Auth über sessionStorage (speichert die user.id). TEIL-B TODO: Supabase-Auth.
const KEY = "pizza-auth";

interface AuthContextValue {
  currentUser: User | null;
  loading: boolean;
  login(username: string, password: string): Promise<User | null>;
  logout(): void;
  updateOwnProfile(patch: Partial<Pick<User, "firstName" | "lastName" | "phone" | "password">>): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Beim Start: gespeicherte id gegen die Nutzerliste auflösen.
  useEffect(() => {
    const id = sessionStorage.getItem(KEY);
    if (!id) { setLoading(false); return; }
    let active = true;
    getUsers().then((users) => {
      if (!active) return;
      setCurrentUser(users.find((u) => u.id === id && u.active) ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const login = async (username: string, password: string): Promise<User | null> => {
    const u = await verifyLogin(username, password);
    if (u) {
      sessionStorage.setItem(KEY, u.id);
      setCurrentUser(u);
    }
    return u;
  };

  const logout = () => {
    sessionStorage.removeItem(KEY);
    setCurrentUser(null);
  };

  const updateOwnProfile = async (patch: Partial<Pick<User, "firstName" | "lastName" | "phone" | "password">>) => {
    if (!currentUser) return;
    const users = await getUsers();
    const next = users.map((u) => (u.id === currentUser.id ? { ...u, ...patch } : u));
    await saveUsers(next);
    setCurrentUser({ ...currentUser, ...patch });
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, logout, updateOwnProfile }}>
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

- [ ] **Step 4: `AuthProvider` in `app.tsx` einhängen** (ganz außen).

Aktuelles `app.tsx` verschachtelt `CartProvider > FavoritesProvider > div > RouterProvider`. Ergänze den Import und lege `AuthProvider` außen herum:
```tsx
import { RouterProvider } from "react-router";
import { AuthProvider } from "@/hooks/use-auth";
import { CartProvider } from "@/hooks/use-cart";
import { FavoritesProvider } from "@/hooks/use-favorites";
import { router } from "@/router";

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <FavoritesProvider>
          <div className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <RouterProvider router={router} />
          </div>
        </FavoritesProvider>
      </CartProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 5: Run → PASS + Build**

Run: `cd Frontend && bun test src/hooks/__tests__/use-auth.test.tsx && bun run build`
Expected: Test PASS, Build grün.

- [ ] **Step 6: Commit**
```bash
git add Frontend/src/hooks/use-auth.tsx Frontend/src/hooks/__tests__/use-auth.test.tsx Frontend/src/app.tsx
git commit -m "feat(frontend): useAuth + AuthProvider (Mock-Session) mit Tests"
```

---

### Task 4: Guards, Login-Seite & Profil-Seite (additiv)

**Files:**
- Create: `src/components/layout/require-auth.tsx`
- Create: `src/pages/login/login-page.tsx`
- Create: `src/pages/profile/profile-page.tsx`
- Modify: `src/router.tsx`

**Interfaces:**
- Consumes: `useAuth`, `redirectFor`/`GuardKind`.
- Produces: `RequireAuth`, `RequireCustomer`, `RequireAdmin` (Wrapper); Routen `/login`, `/profil`.

> **Additiv:** In diesem Task wird nichts entfernt und nichts umgeschaltet. Das alte Admin-Login unter `/admin` bleibt vorerst bestehen. Der Cutover passiert in Task 5.

- [ ] **Step 1: `require-auth.tsx` erstellen**
```tsx
import type React from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { redirectFor, type GuardKind } from "@/lib/auth";

function Guard({ kind, children }: { kind: GuardKind; children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lädt…</div>;
  const to = redirectFor(currentUser, kind);
  return to ? <Navigate to={to} replace /> : <>{children}</>;
}

export const RequireAuth = ({ children }: { children: React.ReactNode }) => <Guard kind="auth">{children}</Guard>;
export const RequireCustomer = ({ children }: { children: React.ReactNode }) => <Guard kind="customer">{children}</Guard>;
export const RequireAdmin = ({ children }: { children: React.ReactNode }) => <Guard kind="admin">{children}</Guard>;
```

- [ ] **Step 2: `login-page.tsx` erstellen** (`src/pages/login/`)
```tsx
import type React from "react";
import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { LogIn, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(false);

  const attempt = async () => {
    const user = await login(username.trim(), pw);
    if (user) {
      navigate(user.role === "admin" ? "/admin/dashboard" : "/", { replace: true });
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 1800);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-3xl">🍕</span>
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black">Anmelden</h1>
          <p className="text-muted-foreground text-sm mt-1">Bitte melde dich an, um zu bestellen.</p>
        </div>
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="un">Benutzername</Label>
              <Input id="un" placeholder="z.B. Mo" value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && attempt()} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">Passwort</Label>
              <div className="relative">
                <Input id="pw" type={show ? "text" : "password"} placeholder="••••••"
                  className={cn("pr-11", err && "border-destructive")}
                  value={pw} onChange={(e) => setPw(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && attempt()} />
                <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-9 w-9" onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
              </div>
              {err && <p className="text-destructive text-xs flex items-center gap-1.5"><AlertCircle size={11} /> Falscher Benutzername oder Passwort</p>}
            </div>
            <Button className="w-full gap-2" onClick={attempt}><LogIn size={15} /> Anmelden</Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3: `profile-page.tsx` erstellen** (`src/pages/profile/`, eigenständig, ohne BottomNav)
```tsx
import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage(): React.ReactElement {
  const navigate = useNavigate();
  const { currentUser, updateOwnProfile, logout } = useAuth();
  const [firstName, setFirstName] = useState(currentUser?.firstName ?? "");
  const [lastName, setLastName] = useState(currentUser?.lastName ?? "");
  const [phone, setPhone] = useState(currentUser?.phone ?? "");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");

  const save = async () => {
    if (pw && pw !== pw2) { setMsg("Passwörter stimmen nicht überein."); return; }
    const patch: { firstName: string; lastName: string; phone: string; password?: string } = { firstName, lastName, phone };
    if (pw) patch.password = pw;
    await updateOwnProfile(patch);
    setPw(""); setPw2("");
    setMsg("Gespeichert.");
    setTimeout(() => setMsg(""), 2000);
  };

  const doLogout = () => { logout(); navigate("/login", { replace: true }); };

  return (
    <div className="min-h-screen pb-10">
      <div className="sticky top-0 z-40 bg-background/92 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ArrowLeft size={17} />
        </Button>
        <span className="font-bold text-sm">Mein Profil</span>
      </div>

      <div className="px-4 mt-5 space-y-4">
        <Card>
          <CardHeader><CardTitle>Konto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Benutzername</Label>
              <Input value={currentUser?.username ?? ""} disabled />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">Vorname</Label>
                <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Nachname</Label>
                <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Telefon</Label>
              <Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Passwort ändern</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="np">Neues Passwort</Label>
              <Input id="np" type="password" placeholder="leer lassen = unverändert" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np2">Bestätigen</Label>
              <Input id="np2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {msg && <p className="text-xs text-center text-muted-foreground">{msg}</p>}
        <Button className="w-full gap-2" onClick={save}><Check size={15} /> Speichern</Button>
        <Button variant="ghost" className="w-full text-muted-foreground gap-2" onClick={doLogout}><LogOut size={14} /> Abmelden</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Routen additiv ergänzen** in `src/router.tsx`.

Importe ergänzen:
```tsx
import LoginPage from "@/pages/login/login-page";
import ProfilePage from "@/pages/profile/profile-page";
import { RequireAuth } from "@/components/layout/require-auth";
```
Zwei Routen am Anfang des Arrays (vor dem `AppLayout`-Eintrag) einfügen:
```tsx
  { path: "/login", element: <LoginPage /> },
  { path: "/profil", element: <RequireAuth><ProfilePage /></RequireAuth> },
```

- [ ] **Step 5: Build + manuell**

Run: `cd Frontend && bun run build` → grün. `bun run dev`: `/login` anmelden mit `Mo`/`pizza` → Redirect nach `/admin/dashboard`; `/profil` zeigt das Profil (Benutzername schreibgeschützt); Abmelden führt zu `/login`. (Der alte `/admin`-Passwort-Login existiert in diesem Task noch parallel — das ist erwartet.) Abbrechen.

- [ ] **Step 6: Commit**
```bash
git add Frontend/src/components/layout/require-auth.tsx Frontend/src/pages/login Frontend/src/pages/profile Frontend/src/router.tsx
git commit -m "feat(frontend): Login-/Profil-Seite + Rollen-Guards (additiv)"
```

---

### Task 5: Cutover — Gate erzwingen & alte Mock-Auth entfernen

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/components/layout/admin-shell.tsx`
- Modify: `src/components/layout/bottom-nav.tsx`
- Modify: `src/lib/data/store.ts`
- Modify: `src/lib/data/seed.ts`
- Delete: `src/hooks/use-admin-auth.ts`
- Delete: `src/pages/admin/login-page.tsx`

**Interfaces:**
- Consumes: `RequireCustomer`, `RequireAdmin` (Task 4), `useAuth` (Task 3).

> **Atomarer Cutover:** alle Änderungen dieses Tasks gehören in **einen** Commit, damit der Build grün bleibt (die Löschungen brechen sonst noch referenzierende Dateien).

- [ ] **Step 1: `router.tsx` umstellen**

Import `AdminLoginPage` **entfernen**; `RequireCustomer`/`RequireAdmin` importieren (Import-Zeile aus Task 4 erweitern):
```tsx
import { RequireAuth, RequireCustomer, RequireAdmin } from "@/components/layout/require-auth";
```
Kunden-Layout mit `RequireCustomer` umschließen, die alte `{ path: "/admin", element: <AdminLoginPage /> }`-Zeile **löschen**, Admin-Layout mit `RequireAdmin` umschließen:
```tsx
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/profil", element: <RequireAuth><ProfilePage /></RequireAuth> },
  {
    element: <RequireCustomer><AppLayout /></RequireCustomer>,
    children: [
      { path: "/", element: <MenuPage /> },
      { path: "/konfigurator", element: <ConfiguratorPage /> },
      { path: "/warenkorb", element: <CheckoutPage /> },
      { path: "/bestaetigung", element: <ConfirmationPage /> },
    ],
  },
  {
    path: "/admin",
    element: <RequireAdmin><AdminLayout /></RequireAdmin>,
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "tage", element: <DaysPage /> },
      { path: "oeffnungszeiten", element: <HoursPage /> },
      { path: "vorlaufzeit", element: <LeadTimePage /> },
      { path: "service", element: <ServicePage /> },
      { path: "zutaten", element: <IngredientsPage /> },
      { path: "sossen", element: <SaucesPage /> },
      { path: "gutscheine", element: <VouchersPage /> },
    ],
  },
]);
```

- [ ] **Step 2: `admin-shell.tsx` auf `useAuth` umstellen**

Import `useAdminAuth` → `useAuth` ersetzen; `Navigate`-Import wird nicht mehr gebraucht (Guard übernimmt den Redirect) — entferne `Navigate` aus dem `react-router`-Import. `User`-Icon für den Profil-Link importieren. Der interne `if (!isAdmin)`-Check entfällt (die Route ist bereits durch `RequireAdmin` geschützt). Header zeigt Benutzernamen + Profil-Link:
```tsx
import { NavLink, Outlet, useNavigate } from "react-router";
import { motion } from "motion/react";
import { BarChart2, Calendar, Clock, Timer, Package, Droplet, Tag, Users, ChefHat, LogOut, Store, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
```
`NAV`-Array um den Nutzer-Punkt erweitern (nach „gutscheine"):
```tsx
  { to: "/admin/nutzer",          icon: Users,     label: "Nutzer"         },
```
Komponentenkopf + Header:
```tsx
export default function AdminLayout(): React.ReactElement {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={16} className="text-primary" />
          <span className="font-black text-sm">Pizza Admin</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/profil")} className="text-xs text-muted-foreground gap-1.5 h-7">
            <User size={11} /> {currentUser?.username}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-muted-foreground gap-1.5 h-7">
            <LogOut size={11} /> Abmelden
          </Button>
        </div>
      </header>
      {/* … restlicher Body (Tab-Nav + <main><Outlet/></main>) unverändert … */}
```
> Der Rest der Komponente (Tab-Navigation über `NAV.map`, `<main>` mit `motion.div` + `<Outlet/>`) bleibt exakt wie bisher.

- [ ] **Step 3: `bottom-nav.tsx` — Admin-Tab → Profil**

Icon-Import: `Settings` entfernen, `CircleUser` ergänzen (`import { Home, ChefHat, ShoppingCart, CircleUser } from "lucide-react";`). Den letzten `NavLink` (bisher `to="/admin"` mit `Settings`, Label „Admin") ersetzen durch:
```tsx
        <NavLink to="/profil" className={({ isActive }) => cn(base, isActive ? active : idle)}>
          <CircleUser size={21} strokeWidth={2} />
          <span className="text-[10px] font-semibold">Profil</span>
        </NavLink>
```

- [ ] **Step 4: Alte Auth aus Store/Seed entfernen**

In `src/lib/data/store.ts`: die Zeile `export const verifyAdminPassword = …` **löschen** und `ADMIN_PASSWORD` aus dem `./seed`-Import entfernen.
In `src/lib/data/seed.ts`: den `export const ADMIN_PASSWORD = …`-Eintrag **löschen**.

- [ ] **Step 5: Alte Dateien löschen**
```bash
git rm Frontend/src/hooks/use-admin-auth.ts Frontend/src/pages/admin/login-page.tsx
```

- [ ] **Step 6: Verifizieren — kein Rest der alten Auth**

Run: `cd Frontend && grep -rIn "useAdminAuth\|verifyAdminPassword\|ADMIN_PASSWORD" src || echo "sauber"`
Expected: `sauber`.
Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; alle Tests grün (35 + neue aus T1–T3).

- [ ] **Step 7: Manuell**

Run: `cd Frontend && bun run dev`. Ohne Login führt `/` → `/login`. `Mo`/`pizza` → Admin-Panel; Header zeigt „Mo" + Abmelden. Direkter Aufruf `/admin/dashboard` ohne Login → `/login`. Abbrechen.

- [ ] **Step 8: Commit**
```bash
git add Frontend/src/router.tsx Frontend/src/components/layout/admin-shell.tsx Frontend/src/components/layout/bottom-nav.tsx Frontend/src/lib/data/store.ts Frontend/src/lib/data/seed.ts
git commit -m "feat(frontend): Cutover auf rollenbasiertes Login-Gate, alte Mock-Admin-Auth entfernt"
```

---

### Task 6: Checkout-Vorausfüllung aus dem Profil

**Files:**
- Modify: `src/pages/checkout/checkout-page.tsx`

**Interfaces:**
- Consumes: `useAuth().currentUser`.

- [ ] **Step 1: `customer`-State aus `currentUser` vorbelegen**

Import ergänzen: `import { useAuth } from "@/hooks/use-auth";`. In der Komponente `currentUser` holen und den bestehenden `customer`-State-Initializer ersetzen:
```tsx
  const { currentUser } = useAuth();
  // …
  const [customer, setCustomer] = useState<Customer>(() => ({
    firstName: currentUser?.firstName ?? "",
    lastName: currentUser?.lastName ?? "",
    phone: currentUser?.phone ?? "",
  }));
```
> Nur der Initialwert ändert sich (Vorbelegung); die Felder bleiben pro Bestellung editierbar, das Profil wird dadurch nicht verändert. Der Rest der Datei bleibt unverändert.

- [ ] **Step 2: Build + manuell**

Run: `cd Frontend && bun run build` → grün. `bun run dev`: als Nutzer mit hinterlegtem Namen/Telefon einloggen (ggf. im Profil setzen), Pizza in den Warenkorb, `/warenkorb` → Name/Telefon sind vorausgefüllt, aber änderbar. Abbrechen.

- [ ] **Step 3: Commit**
```bash
git add Frontend/src/pages/checkout/checkout-page.tsx
git commit -m "feat(frontend): Checkout füllt Name/Telefon aus dem Profil vor"
```

---

### Task 7: Admin-Nutzerverwaltung

**Files:**
- Create: `src/pages/admin/users-page.tsx`
- Modify: `src/router.tsx`

**Interfaces:**
- Consumes: `getUsers`, `saveUsers` (store); `usernameTaken` (`@/lib/auth`); `useAuth().currentUser` (Selbstschutz); `useAsync`, `AsyncBoundary`.

- [ ] **Step 1: `users-page.tsx` erstellen** (Muster der Zutaten-/Gutschein-Seite)
```tsx
import type React from "react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, AlertCircle, KeyRound } from "lucide-react";
import { getUsers, saveUsers } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/hooks/use-auth";
import { usernameTaken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Role, User } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const uid = () => Math.random().toString(36).slice(2, 9);
const EMPTY = { username: "", firstName: "", lastName: "", phone: "", password: "", role: "customer" as Role };

// Admin: Nutzerverwaltung. Muster der Zutaten-Seite; persistiert via saveUsers.
export default function UsersPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getUsers);
  const { currentUser } = useAuth();
  const [list, setList] = useState<User[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formErr, setFormErr] = useState("");
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");

  useEffect(() => { if (data) setList(data); }, [data]);

  const mutate = (next: User[]) => { setList(next); void saveUsers(next); };

  const addUser = () => {
    if (!list) return;
    if (!form.username.trim() || !form.password.trim()) { setFormErr("Benutzername und Passwort sind Pflicht."); return; }
    if (usernameTaken(list, form.username.trim())) { setFormErr("Dieser Benutzername existiert bereits."); return; }
    mutate([...list, {
      id: uid(), username: form.username.trim(), password: form.password,
      firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim(),
      role: form.role, active: true,
    }]);
    setForm(EMPTY); setFormErr(""); setShowForm(false);
  };

  const applyReset = (u: User) => {
    if (!list || !resetPw.trim()) return;
    mutate(list.map((x) => (x.id === u.id ? { ...x, password: resetPw } : x)));
    setResetId(null); setResetPw("");
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Nutzer</h2>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setShowForm(!showForm)}><Plus size={12} /> Neuer Nutzer</Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="border-primary/20">
              <CardHeader><CardTitle className="text-sm">Neuen Nutzer anlegen</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Benutzername</Label>
                    <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rolle</Label>
                    <SelectInput value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}
                      options={[{ value: "customer", label: "Kunde" }, { value: "admin", label: "Admin" }]} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Vorname</Label>
                    <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nachname</Label>
                    <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Telefon</Label>
                    <Input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Startpasswort</Label>
                    <Input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                  </div>
                </div>
                {formErr && <p className="text-destructive text-xs flex items-center gap-1.5"><AlertCircle size={11} />{formErr}</p>}
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={addUser}><Plus size={13} /> Anlegen</Button>
                  <Button variant="ghost" onClick={() => { setShowForm(false); setFormErr(""); }}>Abbrechen</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AsyncBoundary loading={loading} error={error} data={list}
        empty={<p className="text-sm text-muted-foreground text-center py-8">Noch keine Nutzer.</p>}>
        {(users: User[]) => (
          <div className="space-y-2">
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <Card key={u.id} className={cn(!u.active && "opacity-45")}>
                  <CardContent className="py-3 px-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm">{u.username}</span>
                          <Badge variant={u.role === "admin" ? "success" : "secondary"}>{u.role === "admin" ? "Admin" : "Kunde"}</Badge>
                          {isSelf && <span className="text-[10px] text-muted-foreground">(du)</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {[`${u.firstName} ${u.lastName}`.trim(), u.phone].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="Passwort zurücksetzen"
                          onClick={() => { setResetId(resetId === u.id ? null : u.id); setResetPw(""); }}>
                          <KeyRound size={13} />
                        </Button>
                        <Switch checked={u.active} disabled={isSelf}
                          onCheckedChange={() => mutate(users.map((x) => x.id === u.id ? { ...x, active: !x.active } : x))} />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={isSelf}
                          onClick={() => mutate(users.filter((x) => x.id !== u.id))}>
                          <X size={12} />
                        </Button>
                      </div>
                    </div>
                    {resetId === u.id && (
                      <div className="flex gap-2">
                        <Input placeholder="Neues Passwort" value={resetPw} onChange={(e) => setResetPw(e.target.value)} />
                        <Button variant="secondary" className="shrink-0" onClick={() => applyReset(u)}>Setzen</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
```
> Selbstschutz: `disabled={isSelf}` verhindert, dass der angemeldete Admin sich selbst deaktiviert oder löscht.

- [ ] **Step 2: Route ergänzen** in `src/router.tsx`.

Import `import UsersPage from "@/pages/admin/users-page";` und im Admin-`children`-Array (nach „gutscheine"):
```tsx
      { path: "nutzer", element: <UsersPage /> },
```

- [ ] **Step 3: Build + manuell**

Run: `cd Frontend && bun run build && bun test src` → grün. `bun run dev` → als `Mo` einloggen → `/admin/nutzer`: neuen Kunden anlegen (doppelter Benutzername wird abgelehnt), dann ausloggen und als dieser Kunde einloggen → Speisekarte. Eigene Zeile: Löschen/Deaktivieren deaktiviert. Passwort zurücksetzen testen. Abbrechen.

- [ ] **Step 4: Commit**
```bash
git add Frontend/src/pages/admin/users-page.tsx Frontend/src/router.tsx
git commit -m "feat(frontend): Admin-Nutzerverwaltung (anlegen/rollen/aktiv/löschen/Passwort-Reset)"
```

---

### Task 8: Doku & Gesamt-Verifikation

**Files:**
- Modify: `Doku/Pizza/Changelog.md`, `Doku/Pizza/Frontend/README.md`, `Frontend/README.md`, `Doku/Pizza/TODO.md`
- Create: `Doku/Pizza/Entscheidungen/ADR-0005-mock-auth-naht.md`

- [ ] **Step 1: Gesamt-Verifikation**

Run: `cd Frontend && bun run build && bun test src`
Expected: Build grün; alle Unit-Tests grün (inkl. neue: users, auth, use-auth).
Run: `cd Frontend && grep -rIn "useAdminAuth\|verifyAdminPassword\|ADMIN_PASSWORD" src || echo "sauber"`
Expected: `sauber`.

- [ ] **Step 2: ADR-0005 anlegen** (`Doku/Pizza/Entscheidungen/ADR-0005-mock-auth-naht.md`, Vorlage `Doku/Pizza/Templates/_adr.md`): Entscheidung „Nutzer-Accounts in Teil-A als localStorage-Mock (Klartext-Passwörter) als Naht → Teil-B Supabase-Auth". Problem, Optionen (Mock jetzt / Supabase vorziehen / nur Vorausfüllen), Entscheidung Mock, Begründung (konsistent mit Teil-A, UI wiederverwendbar), **Nachteil: Passwörter unsicher (nur lokal, nur bis Teil-B)**, Auswirkungen (Teil-B ersetzt Auth-Schicht).

- [ ] **Step 3: Doku pflegen**

`Doku/Pizza/Changelog.md` (oben, Datum 2026-07-10): Eintrag „Nutzer-Accounts: rollenbasiertes Login-Gate (ersetzt Admin-Mock-Passwort), Profil-Selbstbearbeitung, Admin-Nutzerverwaltung; Start-Admin `Mo`/`pizza`; localStorage-Mock (Klartext-Passwörter, Teil-B → Supabase). Build + Tests grün."
`Frontend/README.md` + `Doku/Pizza/Frontend/README.md`: Abschnitt „Accounts & Login" (ein Login für alle, Rolle steuert Zugang; Start-Admin `Mo`/`pizza`; Profil `/profil`; Nutzerverwaltung `/admin/nutzer`; **Sicherheitshinweis Klartext-Passwörter**). Admin-Passwort-Hinweis in bestehenden Abschnitten aktualisieren (kein `/admin`-Passwort mehr).
`Doku/Pizza/TODO.md`: Zeile „Nutzer-Accounts (Teil-A-Mock) — erledigt"; unter Teil-B ergänzen: „echte Supabase-Auth ersetzt Mock-Login (gehashte Passwörter, RLS)".

- [ ] **Step 4: Commit**
```bash
git add Frontend/README.md Doku/
git commit -m "docs: Nutzer-Accounts dokumentiert + ADR-0005 (Mock-Auth-Naht)"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** Datenmodell → T1; Auth-Naht (getUsers/saveUsers/verifyLogin) → T1; useAuth → T3; Guards/redirectFor → T2+T4; Login-Gate/Routing/Rollen-Redirect → T4+T5; Profil-Selbstbearbeitung → T4; Checkout-Vorausfüllung → T6; Admin-Nutzerverwaltung (anlegen/eindeutig/aktiv/löschen/Reset/Selbstschutz) → T7; Ersetzen der alten Admin-Auth + Löschungen → T5; Tests (verifyLogin, useAuth, usernameTaken, redirectFor) → T1/T2/T3; Sicherheitshinweis/Doku/ADR → T8. Keine offenen Spec-Punkte.
- **Grün-Reihenfolge:** Neues System additiv (T1–T4), Cutover + Löschungen atomar in **einem** Commit (T5). `useAdminAuth`/`verifyAdminPassword`/`ADMIN_PASSWORD`/`admin/login-page.tsx` existieren bis inkl. T4 unverändert weiter → Build in T1–T4 grün; T5/Step 6 verifiziert `sauber`.
- **Typ-/Signatur-Konsistenz:** `User`/`Role` (T1) durchgängig; `getUsers/saveUsers/verifyLogin` (T1) in T3/T7 identisch; `usernameTaken(users, username)`/`redirectFor(user, kind)` (T2) in T4/T7 identisch; `useAuth()`-Rückgabe (T3) in T4/T5/T6/T7 identisch; `sessionStorage`-Key `pizza-auth`, localStorage-Key `pizza-users` einheitlich.
- **Platzhalter:** keine offenen TODOs; „TEIL-B TODO"-Marker sind bewusste, benannte Verweise.
- **Sicherheit bewusst nicht wegvereinfacht:** Klartext-Passwörter sind als Mock-Grenze klar markiert (Global Constraints + ADR-0005 + README-Hinweis); Eingabe-/Eindeutigkeits-Validierung beim Anlegen ist enthalten (T7).
