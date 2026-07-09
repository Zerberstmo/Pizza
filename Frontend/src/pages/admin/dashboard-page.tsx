import type React from "react";
import { getDashboardStats } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { cn } from "@/lib/utils";
import { SvgBarChart } from "@/components/common/bar-chart";
import { SvgDonutChart } from "@/components/common/donut-chart";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Chart-Palette (präsentational, entspricht seed PIE_COLORS).
const CHART_COLORS = ["#F97316", "#EAB308", "#22C55E", "#3B82F6", "#A855F7"];

type Stats = { week: { day: string; n: number }[]; toppings: { name: string; v: number }[] };

// Admin-Dashboard. Portiert aus App.tsx:1307-1356; Charts aus getDashboardStats.
export default function DashboardPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getDashboardStats);

  const tiles = [
    { label: "Heute",        val: "7",      sub: "+3 vs. gestern", col: "text-primary" },
    { label: "Diese Woche",  val: "119",    sub: "Mo–So gesamt",   col: "text-chart-2" },
    { label: "Umsatz heute", val: "70 €",   sub: "7 × 10 €",       col: "text-chart-3" },
    { label: "Top Zutat",    val: "Salami", sub: "42 mal gewählt", col: "text-chart-5" },
  ];

  return (
    <div className="p-4 space-y-5">
      <h2 className="font-bold text-lg">Dashboard</h2>
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

      <AsyncBoundary loading={loading} error={error} data={data}>
        {(stats: Stats) => (
          <>
            <Card>
              <CardHeader><CardTitle className="text-sm">Bestellungen diese Woche</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <SvgBarChart data={stats.week} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Beliebteste Zutaten</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4">
                  <SvgDonutChart data={stats.toppings} colors={CHART_COLORS} />
                  <div className="space-y-1.5 flex-1">
                    {stats.toppings.map((d, i) => (
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
              </CardContent>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
