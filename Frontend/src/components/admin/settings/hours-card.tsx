import type React from "react";
import { Check } from "lucide-react";
import { getAvailableTimes } from "@/lib/slots";
import type { AppConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConfigCardProps = {
  cfg: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
  save: () => void;
  saved: boolean;
};

// Öffnungszeiten: nur Uhrzeiten in diesem Zeitraum erscheinen im Bestellformular.
export function HoursCard({ cfg, setConfig, save, saved }: ConfigCardProps): React.ReactElement {
  const setHours = (patch: Partial<AppConfig["hours"]>) =>
    setConfig((c) => (c ? { ...c, hours: { ...c.hours, ...patch } } : c));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Öffnungszeiten</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Nur Uhrzeiten in diesem Zeitraum erscheinen im Bestellformular.</p>
      </CardHeader>
      <CardContent className="space-y-4">
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
        <Button className="w-full gap-2" onClick={save}>{saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}</Button>
      </CardContent>
    </Card>
  );
}
