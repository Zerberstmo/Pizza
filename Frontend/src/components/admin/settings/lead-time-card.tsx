import type React from "react";
import { Check, Timer } from "lucide-react";
import { useAsync } from "@/hooks/use-async";
import { getOpenDays } from "@/lib/data/store";
import { getSelectableDates, formatDateLabel } from "@/lib/slots";
import type { AppConfig } from "@/types";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ConfigCardProps = {
  cfg: AppConfig;
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | null>>;
  save: () => void;
  saved: boolean;
};

const OPTIONS = Array.from({ length: 15 }, (_, i) => ({ value: String(i), label: `${i} Tag${i === 1 ? "" : "e"}` }));

// Vorlaufzeit: frühester Abholtag = heute + Vorlaufzeit.
export function LeadTimeCard({ cfg, setConfig, save, saved }: ConfigCardProps): React.ReactElement {
  const { data: openDays } = useAsync(getOpenDays);
  const setLeadTime = (v: string) =>
    setConfig((c) => (c ? { ...c, leadTimeDays: Number(v) } : c));
  const earliest = getSelectableDates(openDays ?? [], cfg.leadTimeDays, new Date())[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Vorlaufzeit</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Frühester Abholtag = heute + Vorlaufzeit.</p>
      </CardHeader>
      <CardContent className="space-y-4">
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
        <Button className="w-full gap-2" onClick={save}>{saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}</Button>
      </CardContent>
    </Card>
  );
}
