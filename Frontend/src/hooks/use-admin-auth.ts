import { useCallback, useState } from "react";
import { verifyAdminPassword } from "@/lib/data/store";

// Mock-Admin-Auth über sessionStorage.
// TEIL-B TODO: durch echte Supabase-Auth (JWT/Session) ersetzen.
const KEY = "pizza-admin";

export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => sessionStorage.getItem(KEY) === "1");

  const login = useCallback(async (pw: string): Promise<boolean> => {
    const ok = await verifyAdminPassword(pw);
    if (ok) {
      sessionStorage.setItem(KEY, "1");
      setIsAdmin(true);
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(KEY);
    setIsAdmin(false);
  }, []);

  return { isAdmin, login, logout };
}
