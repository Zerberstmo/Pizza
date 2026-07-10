import type React from "react";
import { Check } from "lucide-react";
import { useConfigEditor } from "@/hooks/use-config-editor";
import { DAYS_OF_WEEK } from "@/lib/slots";
import { cn } from "@/lib/utils";
import type { AppConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

// Admin: Bestelltage. Portiert aus App.tsx:1362-1392; persistiert via saveConfig.
export default function DaysPage(): React.ReactElement {
  const { config, setConfig, loading, error, saved, save } = useConfigEditor();

  const toggle = (day: string) =>
    setConfig((c) => (c ? { ...c, days: { ...c.days, [day]: !c.days[day] } } : c));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Bestelltage</h2>
        <p className="text-sm text-muted-foreground mt-1">Nur aktive Tage werden im Bestellformular angezeigt.</p>
      </div>
      <AsyncBoundary loading={loading} error={error} data={config}>
        {(cfg: AppConfig) => (
          <>
            <Card>
              <CardContent className="py-0">
                {DAYS_OF_WEEK.map((day, i) => (
                  <div key={day}>
                    <div className="flex items-center justify-between py-4">
                      <div>
                        <p className="font-semibold text-sm">{day}</p>
                        <p className={cn("text-xs mt-0.5", cfg.days[day] ? "text-green-400" : "text-muted-foreground")}>
                          {cfg.days[day] ? "Bestellungen möglich" : "Geschlossen"}
                        </p>
                      </div>
                      <Switch checked={!!cfg.days[day]} onCheckedChange={() => toggle(day)} />
                    </div>
                    {i < DAYS_OF_WEEK.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Button className="w-full gap-2" onClick={save}>
              {saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}
            </Button>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
