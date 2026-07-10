import type React from "react";
import { Check } from "lucide-react";
import { useConfigEditor } from "@/hooks/use-config-editor";
import type { AppConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

// Admin: Service-Modus. Globaler Schalter Vor Ort / Abholen; persistiert via saveConfig.
export default function ServicePage(): React.ReactElement {
  const { config, setConfig, loading, error, saved, save } = useConfigEditor();

  const toggle = (key: "dineIn" | "takeaway") =>
    setConfig((c) => (c ? { ...c, service: { ...c.service, [key]: !c.service[key] } } : c));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Service</h2>
        <p className="text-sm text-muted-foreground mt-1">Lege fest, wie bestellt werden kann. Beide aus = keine Bestellungen möglich.</p>
      </div>
      <AsyncBoundary loading={loading} error={error} data={config}>
        {(cfg: AppConfig) => (
          <>
            <Card>
              <CardContent className="py-0">
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-sm">Vor Ort essen</p>
                    <p className={"text-xs mt-0.5 " + (cfg.service.dineIn ? "text-green-400" : "text-muted-foreground")}>{cfg.service.dineIn ? "Aktiv" : "Aus"}</p>
                  </div>
                  <Switch checked={cfg.service.dineIn} onCheckedChange={() => toggle("dineIn")} />
                </div>
                <Separator />
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-sm">Abholen</p>
                    <p className={"text-xs mt-0.5 " + (cfg.service.takeaway ? "text-green-400" : "text-muted-foreground")}>{cfg.service.takeaway ? "Aktiv" : "Aus"}</p>
                  </div>
                  <Switch checked={cfg.service.takeaway} onCheckedChange={() => toggle("takeaway")} />
                </div>
              </CardContent>
            </Card>
            <Button className="w-full gap-2" onClick={save}>{saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}</Button>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
