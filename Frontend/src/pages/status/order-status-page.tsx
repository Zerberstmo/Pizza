import type React from "react";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router";
import { getOrderStatus } from "@/lib/data/store";
import { describeItem } from "@/lib/public-order";
import { isActive } from "@/lib/order-status";
import { formatPrice, BASE_PRICE } from "@/lib/pricing";
import { formatDateLabel } from "@/lib/slots";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { PublicOrderStatus } from "@/types";

export default function OrderStatusPage(): React.ReactElement {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<PublicOrderStatus | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "notfound">("loading");

  const load = useCallback(async () => {
    if (!token) { setState("notfound"); return; }
    try {
      const s = await getOrderStatus(token);
      if (s) { setStatus(s); setState("ready"); }
      else setState("notfound");
    } catch {
      // Netzwerkfehler: letzten Stand behalten, stiller Retry beim nächsten Intervall.
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // Auto-Refresh alle 20 s; stoppt bei Endstatus (abgeholt/storniert) und beim Unmount.
  useEffect(() => {
    if (status && !isActive(status.status)) return;
    const id = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(id);
  }, [load, status]);

  if (state === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Lädt …</div>;
  }
  if (state === "notfound" || !status) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-2">
        <h1 className="text-2xl font-black">Bestellung nicht gefunden</h1>
        <p className="text-muted-foreground text-sm">Der Link ist ungültig oder abgelaufen.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Bestellung</p>
          <p className="text-4xl font-black text-primary">{status.id}</p>
          <div><OrderStatusBadge status={status.status} /></div>
        </div>

        <Card>
          <CardContent className="py-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{status.serviceMode === "dinein" ? "Vor Ort" : "Abholung"}</span>
              <span className="font-semibold">{formatDateLabel(status.pickupDate)} · {status.pickupTime} Uhr</span>
            </div>
            <Separator />
            {status.items.map((item, i) => (
              <div key={item.cartId ?? i}>
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.pizzaName}{(item.quantity ?? 1) > 1 ? ` × ${item.quantity}` : ""}</p>
                    <p className="text-xs text-muted-foreground truncate">{describeItem(item, status.labels)}</p>
                  </div>
                  <span className="text-primary font-bold shrink-0">{formatPrice(BASE_PRICE * (item.quantity ?? 1))}</span>
                </div>
                {i < status.items.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
            <Separator />
            <div className="flex justify-between font-black">
              <span>Gesamt (bar)</span>
              <span className="text-primary">{formatPrice(status.total)}</span>
            </div>
          </CardContent>
        </Card>

        {status.status === "storniert" && (
          <p className="text-center text-sm text-destructive font-semibold">Diese Bestellung wurde storniert.</p>
        )}
      </div>
    </div>
  );
}
