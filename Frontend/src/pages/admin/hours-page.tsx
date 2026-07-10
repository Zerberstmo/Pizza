import type React from "react";
import { Check } from "lucide-react";
import { useConfigEditor } from "@/hooks/use-config-editor";
import { getAvailableTimes } from "@/lib/slots";
import type { AppConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// Admin: Öffnungszeiten. Portiert aus App.tsx:1398-1427; persistiert via saveConfig.
export default function HoursPage(): React.ReactElement {
  const { config, setConfig, loading, error, saved, save } = useConfigEditor();

  const setHours = (patch: Partial<AppConfig["hours"]>) =>
    setConfig((c) => (c ? { ...c, hours: { ...c.hours, ...patch } } : c));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Öffnungszeiten</h2>
        <p className="text-sm text-muted-foreground mt-1">Im Bestellformular werden nur Uhrzeiten in diesem Zeitraum angezeigt.</p>
      </div>
      <AsyncBoundary loading={loading} error={error} data={config}>
        {(cfg: AppConfig) => (
          <>
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hf">Öffnet um</Label>
                  <Input id="hf" type="time" value={cfg.hours.from} onChange={(e) => setHours({ from: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ht">Schließt um</Label>
                  <Input id="ht" type="time" value={cfg.hours.to} onChange={(e) => setHours({ to: e.target.value })} />
                </div>
                <div className="bg-primary/8 border border-primary/15 rounded-lg px-4 py-3">
                  <p className="text-sm font-bold text-primary">{cfg.hours.from} – {cfg.hours.to} Uhr</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getAvailableTimes(cfg.hours).length} Zeitslots à 15 Minuten
                  </p>
                </div>
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
