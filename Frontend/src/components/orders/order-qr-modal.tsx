import type React from "react";
import { useEffect } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { X, RotateCcw } from "lucide-react";
import type { OrderRow } from "@/types";
import { describeItem } from "@/lib/public-order";
import { formatPrice, BASE_PRICE } from "@/lib/pricing";
import { formatDateLabel } from "@/lib/slots";
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

  // Alle (Pizza-)Positionen zurück in den Warenkorb legen → Checkout.
  // (Sonderartikel existieren noch nicht; sobald CartItem ein `kind` bekommt, hier ausschließen.)
  const reorder = () => {
    order.items.forEach((item) => addToCart(item.pizzaName, item.ingredientIds, item.sauceId, item.quantity ?? 1));
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
                <div className="w-10 h-10 shrink-0"><PizzaSVG selected={item.ingredientIds} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{item.pizzaName}{(item.quantity ?? 1) > 1 ? ` × ${item.quantity}` : ""}</p>
                  <p className="text-xs text-muted-foreground truncate">{describeItem(item, labels)}</p>
                </div>
                <span className="text-primary font-bold shrink-0">{formatPrice(BASE_PRICE * (item.quantity ?? 1))}</span>
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

        <Button className="w-full gap-2" onClick={reorder}>
          <RotateCcw size={15} /> Erneut bestellen
        </Button>
      </motion.div>
    </div>
  );
}
