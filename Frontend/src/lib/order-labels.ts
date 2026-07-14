import type { IngredientItem, Sauce } from "@/types";

// Map id → Name über Zutaten und Soßen (für describeItem im Bestell-Modal).
export function buildLabels(ingredients: IngredientItem[], sauces: Sauce[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const i of ingredients) labels[i.id] = i.name;
  for (const s of sauces) labels[s.id] = s.name;
  return labels;
}
