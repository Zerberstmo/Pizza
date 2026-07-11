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
