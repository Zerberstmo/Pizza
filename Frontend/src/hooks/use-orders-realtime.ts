import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// Abonniert Änderungen der orders-Tabelle (INSERT/UPDATE/DELETE) und ruft onChange().
// scope.userId → nur eigene Bestellungen (Kunde); ohne → alle (Admin).
// Voraussetzung: Betreiber hat Realtime für die orders-Tabelle in Supabase aktiviert.
export function useOrdersRealtime(onChange: () => void, scope: { userId?: string }): void {
  const cb = useRef(onChange);
  cb.current = onChange; // immer aktuell, ohne Re-Subscribe

  useEffect(() => {
    const channel = supabase
      .channel(`orders-${scope.userId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: scope.userId ? `user_id=eq.${scope.userId}` : undefined,
        },
        () => cb.current(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scope.userId]);
}
