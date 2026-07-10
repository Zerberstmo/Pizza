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
