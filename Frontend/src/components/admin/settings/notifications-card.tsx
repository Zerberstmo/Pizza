import type React from "react";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { getNotifyConfig, saveNotifyConfig } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import type { NotifyConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// WhatsApp-Digest-Empfänger (Teil-B3): Nummer + CallMeBot-API-Key + An/Aus. Selbst-versorgend.
export function NotificationsCard(): React.ReactElement {
  const { data, loading, error } = useAsync(getNotifyConfig);
  const [cfg, setCfg] = useState<NotifyConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setCfg(data); }, [data]);

  const save = async () => {
    if (!cfg) return;
    await saveNotifyConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Benachrichtigungen</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Täglich 18 Uhr eine WhatsApp mit allen heutigen Abholungen. Empfänger muss sich einmalig bei CallMeBot registrieren (liefert den API-Key).</p>
      </CardHeader>
      <CardContent className="pt-0">
        <AsyncBoundary loading={loading} error={error} data={cfg}>
          {(c: NotifyConfig) => (
            <>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold text-sm">Digest aktiv</p>
                  <p className={"text-xs mt-0.5 " + (c.enabled ? "text-green-400" : "text-muted-foreground")}>{c.enabled ? "Wird gesendet" : "Pausiert"}</p>
                </div>
                <Switch checked={c.enabled} onCheckedChange={(v) => setCfg({ ...c, enabled: v })} />
              </div>
              <Separator />
              <div className="space-y-1.5 py-3">
                <Label htmlFor="phone">Empfänger-Nummer (WhatsApp)</Label>
                <Input id="phone" type="tel" placeholder="+49170..." value={c.recipientPhone}
                  onChange={(e) => setCfg({ ...c, recipientPhone: e.target.value })} />
              </div>
              <Separator />
              <div className="space-y-1.5 py-3">
                <Label htmlFor="key">CallMeBot API-Key</Label>
                <Input id="key" value={c.callmebotApikey}
                  onChange={(e) => setCfg({ ...c, callmebotApikey: e.target.value })} />
              </div>
              <Button className="w-full gap-2 mt-2" onClick={save}>{saved ? <><Check size={15} /> Gespeichert</> : "Speichern"}</Button>
            </>
          )}
        </AsyncBoundary>
      </CardContent>
    </Card>
  );
}
