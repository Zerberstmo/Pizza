import type React from "react";
import { useCallback } from "react";
import { getMyOrders } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/hooks/use-auth";
import { useOrdersRealtime } from "@/hooks/use-orders-realtime";
import { formatPrice } from "@/lib/pricing";
import type { OrderRow } from "@/types";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { PizzaSVG } from "@/components/pizza/pizza-svg";
import { Card, CardContent } from "@/components/ui/card";

export default function MyOrdersPage(): React.ReactElement {
  const { currentUser } = useAuth();
  const { data, loading, error, reload } = useAsync(getMyOrders);
  const onChange = useCallback(() => reload(), [reload]);
  useOrdersRealtime(onChange, { userId: currentUser?.id });

  return (
    <div className="pb-24">
      <div className="px-5 pt-10 pb-4">
        <h1 className="text-3xl font-black tracking-tight">Meine <span className="text-primary">Bestellungen</span></h1>
      </div>
      <AsyncBoundary
        loading={loading}
        error={error}
        data={data}
        empty={<p className="px-5 py-16 text-center text-muted-foreground text-sm">Noch keine Bestellungen.</p>}
      >
        {(orders: OrderRow[]) => (
          <div className="px-4 space-y-3">
            {orders.map((o) => (
              <Card key={o.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-primary">{o.id}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {o.serviceMode === "dinein" ? "Vor Ort" : "Abholung"} · {o.pickupDate} · {o.pickupTime} Uhr
                  </p>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {o.items.map((item, i) => (
                      <div key={item.cartId ?? i} className="w-8 h-8"><PizzaSVG selected={item.ingredientIds} /></div>
                    ))}
                    <span className="text-sm font-bold text-primary ml-auto">{formatPrice(o.total)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
