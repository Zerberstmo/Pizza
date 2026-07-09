import type React from "react";

// Vereinheitlichte Lade-/Fehler-/Leer-Zustände für die async Datenschicht.
export function AsyncBoundary<T>({ loading, error, data, empty, children }: {
  loading: boolean;
  error: Error | null;
  data: T | null;
  empty?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground">Lädt…</div>;
  if (error) return <div className="flex flex-col items-center justify-center py-16 text-center text-destructive">Etwas ist schiefgelaufen.</div>;
  if (!data || (Array.isArray(data) && data.length === 0)) return <>{empty ?? null}</>;
  return <>{children(data)}</>;
}
