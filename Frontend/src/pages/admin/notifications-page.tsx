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
import { Card, CardContent } from "@/components/ui/card";

// Admin: WhatsApp-Digest-Empfänger (Teil-B3). Nummer + CallMeBot-API-Key + An/Aus; persistiert via saveNotifyConfig.
export default function NotificationsPage(): React.ReactElement {
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
    <div className="p-4 space-y-4">
      <div>
        <h2 className="font-bold text-lg">Benachrichtigungen</h2>
        <p className="text-sm text-muted-foreground mt-1">Täglich 18 Uhr eine WhatsApp mit allen heutigen Abholungen. Empfänger muss sich einmalig bei CallMeBot registrieren (liefert den API-Key).</p>
      </div>
      <AsyncBoundary loading={loading} error={error} data={cfg}>
        {(c: NotifyConfig) => (
          <>
            <Card>
              <CardContent className="py-0">
                <div className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-semibold text-sm">Digest aktiv</p>
                    <p className={"text-xs mt-0.5 " + (c.enabled ? "text-green-400" : "text-muted-foreground")}>{c.enabled ? "Wird gesendet" : "Pausiert"}</p>
                  </div>
                  <Switch checked={c.enabled} onCheckedChange={(v) => setCfg({ ...c, enabled: v })} />
                </div>
                <Separator />
                <div className="space-y-1.5 py-4">
                  <Label htmlFor="phone">Empfänger-Nummer (WhatsApp)</Label>
                  <Input id="phone" type="tel" placeholder="+49170..." value={c.recipientPhone}
                    onChange={(e) => setCfg({ ...c, recipientPhone: e.target.value })} />
                </div>
                <Separator />
                <div className="space-y-1.5 py-4">
                  <Label htmlFor="key">CallMeBot API-Key</Label>
                  <Input id="key" value={c.callmebotApikey}
                    onChange={(e) => setCfg({ ...c, callmebotApikey: e.target.value })} />
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
