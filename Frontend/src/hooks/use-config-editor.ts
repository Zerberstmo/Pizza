import { useEffect, useState } from "react";
import { getConfig, saveConfig } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import type { AppConfig } from "@/types";

// Gemeinsames Muster der Admin-Config-Seiten (Tage/Öffnungszeiten/Vorlaufzeit):
// Config laden → lokale Kopie bearbeiten → speichern mit kurzem "Gespeichert"-Flash.
export function useConfigEditor() {
  const { data, loading, error } = useAsync(getConfig);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data) setConfig(data); }, [data]);

  const save = async () => {
    if (!config) return;
    await saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return { config, setConfig, loading, error, saved, save };
}
