import type React from "react";
import { getDashboardStats, getConfig } from "@/lib/data/store";
import type { DashboardStats } from "@/lib/dashboard";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/pricing";
import { SvgBarChart } from "@/components/common/bar-chart";
import { SvgDonutChart } from "@/components/common/donut-chart";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Chart-Palette (präsentational).
const CHART_COLORS = ["#F97316", "#EAB308", "#22C55E", "#3B82F6", "#A855F7"];

// Admin-Dashboard mit echten Kennzahlen aus orders (all-time, storniert ausgeschlossen).
export default function DashboardPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getDashboardStats);
  const { data: cfg } = useAsync(getConfig);

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2 className="font-bold text-lg">Dashboard</h2>
        {cfg?.dashboardResetAt && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Statistik seit {new Date(cfg.dashboardResetAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </p>
        )}
      </div>
      <AsyncBoundary loading={loading} error={error} data={data}>
        {(stats: DashboardStats) => {
          const tiles = [
            { label: "Bestellungen gesamt", val: String(stats.totalCount),        sub: "ohne stornierte", col: "text-primary" },
            { label: "Umsatz gesamt",       val: formatPrice(stats.totalRevenue),  sub: "alle Abholungen", col: "text-chart-2" },
            { label: "Ø-Bestellwert",       val: formatPrice(stats.avgOrderValue), sub: "pro Bestellung",  col: "text-chart-3" },
            { label: "Top-Zutat",           val: stats.topIngredient?.name ?? "—",
              sub: stats.topIngredient ? `${stats.topIngredient.v}× gewählt` : "noch keine", col: "text-chart-5" },
          ];
          return (
            <>
              <div className="grid grid-cols-2 gap-3">
                {tiles.map(({ label, val, sub, col }) => (
                  <Card key={label}>
                    <CardContent className="pt-4 pb-4">
                      <p className={cn("font-black text-2xl leading-none mb-1", col)}>{val}</p>
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Beliebteste Pizzen</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {stats.topPizzas.length > 0
                    ? <SvgBarChart data={stats.topPizzas} />
                    : <p className="text-xs text-muted-foreground py-6 text-center">Noch keine Daten.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Beliebteste Zutaten</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {stats.topIngredients.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <SvgDonutChart data={stats.topIngredients} colors={CHART_COLORS} />
                      <div className="space-y-1.5 flex-1">
                        {stats.topIngredients.map((d, i) => (
                          <div key={d.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i] }} />
                              <span className="text-xs text-muted-foreground">{d.name}</span>
                            </div>
                            <span className="text-xs font-bold">{d.v}×</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <p className="text-xs text-muted-foreground py-6 text-center">Noch keine Daten.</p>}
                </CardContent>
              </Card>
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
