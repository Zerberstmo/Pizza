// Reine Dashboard-Aggregation (all-time, storniert ausgeschlossen). Deterministisch → getestet.
export interface DashboardOrder {
  total: number;
  status: string;
  items: { pizzaName: string; ingredientIds: string[]; quantity?: number }[];
}

export interface DashboardStats {
  totalCount: number;
  totalRevenue: number;
  avgOrderValue: number;
  topIngredient: { name: string; v: number } | null;
  topPizzas: { day: string; n: number }[];       // Form für SvgBarChart
  topIngredients: { name: string; v: number }[]; // Form für SvgDonutChart
}

export function computeDashboard(
  orders: DashboardOrder[],
  ingredientNames: Record<string, string>,
): DashboardStats {
  const active = orders.filter((o) => o.status !== "storniert");
  const totalCount = active.length;
  const totalRevenue = active.reduce((s, o) => s + o.total, 0);
  const avgOrderValue = totalCount ? totalRevenue / totalCount : 0;

  const pizzaCounts: Record<string, number> = {};
  const ingCounts: Record<string, number> = {};
  for (const o of active) {
    for (const it of o.items) {
      const qty = it.quantity ?? 1;
      pizzaCounts[it.pizzaName] = (pizzaCounts[it.pizzaName] ?? 0) + qty;
      for (const id of it.ingredientIds) ingCounts[id] = (ingCounts[id] ?? 0) + qty;
    }
  }

  const topPizzas = Object.entries(pizzaCounts)
    .map(([name, n]) => ({ day: name, n }))
    .sort((a, b) => b.n - a.n || a.day.localeCompare(b.day))
    .slice(0, 6);

  const rankedIngredients = Object.entries(ingCounts)
    .map(([id, v]) => ({ name: ingredientNames[id] ?? id, v }))
    .sort((a, b) => b.v - a.v || a.name.localeCompare(b.name));

  return {
    totalCount,
    totalRevenue,
    avgOrderValue,
    topIngredient: rankedIngredients[0] ?? null,
    topPizzas,
    topIngredients: rankedIngredients.slice(0, 5),
  };
}
