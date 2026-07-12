import type React from "react";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/order-status";
import type { OrderStatus } from "@/types";

const COLORS: Record<OrderStatus, string> = {
  eingegangen: "bg-muted text-foreground",
  in_arbeit: "bg-amber-400/15 text-amber-400 border border-amber-400/25",
  fertig: "bg-green-500/15 text-green-400 border border-green-500/25",
  abgeholt: "bg-muted text-muted-foreground",
  storniert: "bg-destructive/15 text-destructive border border-destructive/25",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }): React.ReactElement {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", COLORS[status])}>
      {statusLabel(status)}
    </span>
  );
}
