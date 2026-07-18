import type React from "react";
import { Check, Timer } from "lucide-react";
import { useConfigEditor } from "@/hooks/use-config-editor";
import { useAsync } from "@/hooks/use-async";
import { getOpenDays } from "@/lib/data/store";
import { getSelectableDates, formatDateLabel } from "@/lib/slots";
import type { AppConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// Admin: Vorlaufzeit (neu). Frühester Abholtag = heute + Vorlaufzeit.
const OPTIONS = Array.from({ length: 15 }, (_, i) => ({ value: String(i), label: `${i} Tag${i === 1 ? "" : "e"}` }));

export default function LeadTimePage(): React.ReactElement {
  const { config, setConfig, loading, error, saved, save } = useConfigEditor();
  const { data: openDays } = useAsync(getOpenDays);

  const setLeadTime = (v: string) =>
    setConfig((c) => (c ? { ...c, leadTimeDays: Number(v) } : c));

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Vorlaufzeit</h2>
        <p className="text-sm text-muted-foreground mt-1">Frühester Abholtag = heute + Vorlaufzeit.</p>
      </div>
      <AsyncBoundary loading={loading} error={error} data={config}>
        {(cfg: AppConfig) => {
          const earliest = getSelectableDates(openDays ?? [], cfg.leadTimeDays, new Date())[0];
          return (
            <>
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><Timer size={11} /> Vorlaufzeit in Tagen</Label>
                    <SelectInput value={String(cfg.leadTimeDays)} onChange={setLeadTime} options={OPTIONS} />
                  </div>
                  <div className="bg-primary/8 border border-primary/15 rounded-lg px-4 py-3">
                    <p className="text-sm font-bold text-primary">
                      {cfg.leadTimeDays === 0 ? "Bestellung noch für heute möglich" : `${cfg.leadTimeDays} Tag${cfg.leadTimeDays === 1 ? "" : "e"} Vorlauf`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {earliest ? `Frühester Abholtag: ${formatDateLabel(earliest)}` : "Kein Abholtag verfügbar (Bestelltage prüfen)."}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Button className="w-full gap-2" onClick={save}>
                {saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}
              </Button>
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
