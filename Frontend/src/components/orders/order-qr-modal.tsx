import type React from "react";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { X, RotateCcw, Ban } from "lucide-react";
import type { OrderRow } from "@/types";
import { describeItem } from "@/lib/public-order";
import { formatPrice } from "@/lib/pricing";
import { isSpecialItem, itemTitle, itemLineTotal } from "@/lib/cart-items";
import { formatDateLabel } from "@/lib/slots";
import { isCancellable } from "@/lib/order-status";
import { cancelMyOrder } from "@/lib/data/store";
import { QrCode } from "@/components/common/qr-code";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { PizzaSVG } from "@/components/pizza/pizza-svg";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";

// Overlay-Modal: zeigt QR + Status-Link + Details einer bereits getätigten Bestellung.
// Rein darstellend — order + labels kommen als Props.
export function OrderQrModal({ order, labels, onClose }: {
  order: OrderRow;
  labels: Record<string, string>;
  onClose: () => void;
}): React.ReactElement {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Storno: zweistufig gegen Fehlklick. Erst „Ja" ruft die RPC; Realtime zieht die Liste nach.
  const cancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelMyOrder(order.id);
      onClose();
    } catch {
      setCancelError("Storno fehlgeschlagen — bitte erneut versuchen (evtl. schon in Arbeit).");
      setConfirming(false);
    } finally {
      setCancelling(false);
    }
  };

  // Alle Pizza-Positionen zurück in den Warenkorb legen → Checkout.
  // Sonderartikel brauchen Code + Freischaltung und werden daher nicht mit-reordert.
  const reorder = () => {
    order.items.forEach((item) => {
      if (isSpecialItem(item)) return;
      addToCart(item.pizzaName, item.ingredientIds, item.sauceId, item.quantity ?? 1);
    });
    onClose();
    navigate("/warenkorb");
  };

  // Escape schließt das Modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const statusUrl = `${window.location.origin}/bestellung/${order.publicToken}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.25 }}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-card text-card-foreground p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Bestellung</p>
            <p className="text-3xl font-black text-primary">{order.id}</p>
          </div>
          <button onClick={onClose} aria-label="Schließen" className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div><OrderStatusBadge status={order.status} /></div>

        <div className="text-center space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">QR-Code</p>
          <div className="w-36 h-36 mx-auto"><QrCode data={statusUrl} /></div>
          <a href={statusUrl} className="inline-block text-xs text-primary underline underline-offset-2">Status verfolgen</a>
        </div>

        <Separator />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{order.serviceMode === "dinein" ? "Vor Ort" : "Abholung"}</span>
          <span className="font-semibold">{formatDateLabel(order.pickupDate)} · {order.pickupTime} Uhr</span>
        </div>
        <Separator />

        <div className="space-y-3 text-sm">
          {order.items.map((item, i) => (
            <div key={item.cartId ?? i}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                  {isSpecialItem(item)
                    ? <span className="text-xl">{item.emoji}</span>
                    : <PizzaSVG selected={item.ingredientIds} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{itemTitle(item)}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</p>
                  <p className="text-xs text-muted-foreground truncate">{describeItem(item, labels)}</p>
                </div>
                <span className="text-primary font-bold shrink-0">{formatPrice(itemLineTotal(item))}</span>
              </div>
              {i < order.items.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </div>

        <Separator />
        <div className="flex justify-between font-black">
          <span>Gesamt (bar)</span>
          <span className="text-primary">{formatPrice(order.total)}</span>
        </div>

        {order.items.some((it) => !isSpecialItem(it)) && (
          <Button className="w-full gap-2" onClick={reorder}>
            <RotateCcw size={15} /> Erneut bestellen
          </Button>
        )}

        {isCancellable(order.status) && (
          <div className="space-y-2">
            {!confirming ? (
              <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => { setConfirming(true); setCancelError(null); }}>
                <Ban size={15} /> Bestellung stornieren
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-center text-muted-foreground">Bestellung wirklich stornieren?</p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" disabled={cancelling}
                    onClick={() => setConfirming(false)}>Abbrechen</Button>
                  <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={cancelling} onClick={cancel}>
                    {cancelling ? "Storniere…" : "Ja, stornieren"}
                  </Button>
                </div>
              </div>
            )}
            {cancelError && <p className="text-xs text-center text-destructive">{cancelError}</p>}
          </div>
        )}
      </motion.div>
    </div>
  );
}
