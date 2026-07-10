import type { Sauce } from "@/types";

// Liefert die Soße zur id; fällt bei fehlender/nicht verfügbarer id auf die erste
// verfügbare Soße zurück (Default = Tomate laut Seed).
export function resolveSauce(sauces: Sauce[], sauceId?: string): Sauce | undefined {
  return (
    sauces.find((s) => s.id === sauceId && s.available) ??
    sauces.find((s) => s.available) ??
    sauces[0]
  );
}
