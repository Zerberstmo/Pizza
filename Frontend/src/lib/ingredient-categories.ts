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
