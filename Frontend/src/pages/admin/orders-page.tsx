import type React from "react";
import { useCallback, useState } from "react";
import { getOrders, updateOrderStatus } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { nextStatus, isActive, statusLabel } from "@/lib/order-status";
import { formatPrice } from "@/lib/pricing";
import { pizzaQuantity, isSpecialItem } from "@/lib/cart-items";
import type { OrderRow, OrderStatus } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OrdersPage(): React.ReactElement {
  const { data, loading, error, reload } = useAsync(getOrders);
  const onChange = useCallback(() => reload(), [reload]);
  useOrdersRealtime(onChange, {});
  const [showDone, setShowDone] = useState(false);

  const setStatus = async (id: string, status: OrderStatus) => {
    await updateOrderStatus(id, status);
    reload();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">Bestellungen</h2>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowDone((v) => !v)}>
          {showDone ? "Nur aktive" : "Auch erledigte"}
        </Button>
      </div>
      <AsyncBoundary
        loading={loading}
        error={error}
        data={data}
        empty={<p className="text-sm text-muted-foreground text-center py-8">Keine Bestellungen.</p>}
      >
        {(orders: OrderRow[]) => {
          const shown = showDone ? orders : orders.filter((o) => isActive(o.status));
          if (shown.length === 0) {
            return <p className="text-sm text-muted-foreground text-center py-8">Keine {showDone ? "" : "aktiven "}Bestellungen.</p>;
          }
          return (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3 items-start">
              {shown.map((o) => {
                const nx = nextStatus(o.status);
                return (
                  <Card key={o.id}>
                    <CardContent className="py-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-primary">{o.id}</span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {o.serviceMode === "dinein" ? "Vor Ort" : "Abholung"} · {o.pickupDate} · {o.pickupTime} Uhr · {pizzaQuantity(o.items)} Pizza{pizzaQuantity(o.items) !== 1 ? "en" : ""} · {formatPrice(o.total)}
                      </p>
                      {o.items.some(isSpecialItem) && (
                        <p className="text-xs text-primary/80">
                          {o.items.filter(isSpecialItem).map((it) => `${it.emoji} ${it.name}${it.quantity > 1 ? ` × ${it.quantity}` : ""}`).join(", ")}
                        </p>
                      )}
                      {o.notes && <p className="text-xs text-foreground/70">Bemerkung: {o.notes}</p>}
                      {isActive(o.status) && (
                        <div className="flex gap-2 pt-1">
                          {nx && (
                            <Button size="sm" className="text-xs" onClick={() => setStatus(o.id, nx)}>
                              → {statusLabel(nx)}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => setStatus(o.id, "storniert")}>
                            Stornieren
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
