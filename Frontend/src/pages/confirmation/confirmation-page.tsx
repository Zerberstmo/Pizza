import type React from "react";
import { motion } from "motion/react";
import { useLocation, useNavigate, Navigate } from "react-router";
import { Check } from "lucide-react";
import { getIngredients, getSauces } from "@/lib/data/store";
import { resolveSauce } from "@/lib/sauces";
import { useAsync } from "@/hooks/use-async";
import { formatPrice } from "@/lib/pricing";
import { formatDateLabel } from "@/lib/slots";
import type { OrderData } from "@/types";
import { PizzaSVG } from "@/components/pizza/pizza-svg";
import { QrCode } from "@/components/common/qr-code";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";

// Bestätigung. Portiert aus App.tsx:1026-1121; Order kommt via Router-State.
export default function ConfirmationPage(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const order = location.state as OrderData | null;
  const { data: ingredients } = useAsync(getIngredients);
  const { data: sauces } = useAsync(getSauces);

  if (!order) return <Navigate to="/" replace />;

  const ingName = (id: string) => (ingredients ?? []).find((x) => x.id === id)?.name;
  const sauceName = (id?: string) => resolveSauce(sauces ?? [], id)?.name;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-24">
      <motion.div initial={{ scale: 0.82, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.25 }} className="w-full max-w-md space-y-4">
        <div className="flex justify-center mb-2">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check size={36} className="text-green-400" strokeWidth={3} />
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-black">Bestellt!</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {order.items.length} Pizza{order.items.length !== 1 ? "en" : ""} werden vorbereitet.
          </p>
        </div>

        <Card className="border-primary/15 bg-primary/4 text-center">
          <CardContent className="py-5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-2">Bestellnummer</p>
            <p className="text-5xl font-black text-primary">{order.id}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">QR-Code</p>
            <div className="w-36 h-36 mx-auto"><QrCode data={order.id} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-semibold">{order.customer.firstName} {order.customer.lastName}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">{order.serviceMode === "dinein" ? "Vor Ort" : "Abholung"}</span>
              <span className="font-semibold">{formatDateLabel(order.pickupDate)} · {order.pickupTime} Uhr</span>
            </div>
            <Separator />

            {order.items.map((item, i) => (
              <div key={item.cartId}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0"><PizzaSVG selected={item.ingredientIds} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.pizzaName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[sauceName(item.sauceId), ...item.ingredientIds.map(ingName)].filter(Boolean).join(", ") || "Käse & Sauce"}
                    </p>
                  </div>
                  <span className="text-primary font-bold shrink-0">10 €</span>
                </div>
                {i < order.items.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}

            {order.freeIngredient && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sonderzutat</span>
                  <span className="text-green-400 font-semibold">🎁 {order.freeIngredient}</span>
                </div>
              </>
            )}
            {order.notes && (
              <>
                <Separator />
                <div className="flex justify-between items-start gap-4">
                  <span className="text-muted-foreground shrink-0">Bemerkung</span>
                  <span className="text-right text-xs text-foreground/80">{order.notes}</span>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between font-black">
              <span>Gesamt (bar)</span>
              <span className="text-primary">{formatPrice(order.total)}</span>
            </div>
          </CardContent>
        </Card>

        <Button variant="secondary" className="w-full" onClick={() => navigate("/")}>
          Zurück zur Startseite
        </Button>
      </motion.div>
    </div>
  );
}
