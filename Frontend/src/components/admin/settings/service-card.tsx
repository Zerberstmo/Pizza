import type React from "react";
import { Check } from "lucide-react";
import type { AppConfig } from "@/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConfigCardProps = {
  cfg: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
  save: () => void;
  saved: boolean;
};

// Service-Modus: globaler Schalter Vor Ort / Abholen. Geteilter Config-Zustand vom Hub.
export function ServiceCard({ cfg, setConfig, save, saved }: ConfigCardProps): React.ReactElement {
  const toggle = (key: "dineIn" | "takeaway") =>
    setConfig((c) => (c ? { ...c, service: { ...c.service, [key]: !c.service[key] } } : c));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Service</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Wie bestellt werden kann. Beide aus = keine Bestellungen.</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-semibold text-sm">Vor Ort essen</p>
            <p className={"text-xs mt-0.5 " + (cfg.service.dineIn ? "text-green-400" : "text-muted-foreground")}>{cfg.service.dineIn ? "Aktiv" : "Aus"}</p>
          </div>
          <Switch checked={cfg.service.dineIn} onCheckedChange={() => toggle("dineIn")} />
        </div>
        <Separator />
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="font-semibold text-sm">Abholen</p>
            <p className={"text-xs mt-0.5 " + (cfg.service.takeaway ? "text-green-400" : "text-muted-foreground")}>{cfg.service.takeaway ? "Aktiv" : "Aus"}</p>
          </div>
          <Switch checked={cfg.service.takeaway} onCheckedChange={() => toggle("takeaway")} />
        </div>
        <Button className="w-full gap-2 mt-3" onClick={save}>{saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}</Button>
      </CardContent>
    </Card>
  );
}
