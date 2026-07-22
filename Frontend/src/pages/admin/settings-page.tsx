import type React from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { useConfigEditor } from "@/hooks/use-config-editor";
import type { AppConfig } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { ServiceCard } from "@/components/admin/settings/service-card";
import { HoursCard } from "@/components/admin/settings/hours-card";
import { LeadTimeCard } from "@/components/admin/settings/lead-time-card";
import { NotificationsCard } from "@/components/admin/settings/notifications-card";
import { DashboardResetCard } from "@/components/admin/settings/dashboard-reset-card";

// Admin-Einstellungen-Hub: fünf Konfig-Karten in einem responsiven Raster.
// Service/Öffnungszeiten/Vorlaufzeit teilen sich EINEN useConfigEditor (kein Lost-Update);
// Benachrichtigungen + Dashboard-Reset sind selbst-versorgend.
export default function SettingsPage(): React.ReactElement {
  const { config, setConfig, loading, error, saved, save } = useConfigEditor();

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-bold text-lg flex items-center gap-2"><SettingsIcon size={18} /> Einstellungen</h2>
      <AsyncBoundary loading={loading} error={error} data={config}>
        {(cfg: AppConfig) => (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 items-start">
            <ServiceCard cfg={cfg} setConfig={setConfig} save={save} saved={saved} />
            <HoursCard cfg={cfg} setConfig={setConfig} save={save} saved={saved} />
            <LeadTimeCard cfg={cfg} setConfig={setConfig} save={save} saved={saved} />
            <NotificationsCard />
            <DashboardResetCard />
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
