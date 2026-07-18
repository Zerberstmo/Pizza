import type React from "react";
import { useState } from "react";
import { Check, RotateCcw, Settings as SettingsIcon } from "lucide-react";
import { getConfig, setDashboardResetAt } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import type { AppConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Lesbarer Reset-Stand für die Anzeige.
function formatResetLabel(iso: string | null): string {
  if (!iso) return "seit Beginn (all-time)";
  const d = new Date(iso);
  return `seit ${d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr`;
}

// Admin: Einstellungen. Aktuell: Dashboard-Reset (weicher Reset-Punkt, nicht destruktiv).
export default function SettingsPage(): React.ReactElement {
  const { data, loading, error, reload } = useAsync(getConfig);
  const [confirm, setConfirm] = useState<null | "reset" | "clear">(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [saveError, setSaveError] = useState("");

  const apply = async (at: string | null) => {
    setBusy(true); setSaveError("");
    try {
      await setDashboardResetAt(at);
      setConfirm(null);
      setFlash(true); setTimeout(() => setFlash(false), 1800);
      reload();
    } catch {
      setSaveError("Konnte nicht gespeichert werden. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-bold text-lg flex items-center gap-2"><SettingsIcon size={18} /> Einstellungen</h2>
      <AsyncBoundary loading={loading} error={error} data={data}>
        {(cfg: AppConfig) => (
          <Card>
            <CardHeader><CardTitle className="text-sm">Dashboard zurücksetzen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Statistik zählt <span className="font-semibold text-foreground">{formatResetLabel(cfg.dashboardResetAt)}</span>.
                Bestellungen, Historie und Digest bleiben unberührt.
              </p>

              {confirm === "reset" ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Wirklich zurücksetzen?</span>
                  <Button size="sm" disabled={busy} onClick={() => apply(new Date().toISOString())}>Ja</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Abbrechen</Button>
                </div>
              ) : (
                <Button className="gap-1.5" disabled={busy} onClick={() => { setSaveError(""); setConfirm("reset"); }}>
                  <RotateCcw size={14} /> Dashboard zurücksetzen
                </Button>
              )}

              {cfg.dashboardResetAt && (confirm === "clear" ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Auf all-time zurückstellen?</span>
                  <Button size="sm" disabled={busy} onClick={() => apply(null)}>Ja</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Abbrechen</Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => { setSaveError(""); setConfirm("clear"); }}>
                  Auf all-time zurückstellen
                </Button>
              ))}

              {flash && <p className="text-xs text-primary flex items-center gap-1"><Check size={12} /> Gespeichert</p>}
              {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            </CardContent>
          </Card>
        )}
      </AsyncBoundary>
    </div>
  );
}
