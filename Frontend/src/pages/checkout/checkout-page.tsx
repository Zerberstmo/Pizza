import type React from "react";
import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { ArrowLeft, X, Plus, Minus, ChefHat, Phone, Calendar, Clock, FileText, Ticket, Check, AlertCircle } from "lucide-react";
import { getConfig, getIngredients, getVouchers, getSauces, createOrder, unlockSpecialItem, getOpenDays } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { cn } from "@/lib/utils";
import { formatPrice, computeDiscount, computeTotal, validateVoucher } from "@/lib/pricing";
import { isSpecialItem, itemLineTotal, cartSubtotal, pizzaQuantity, isSpecialsOnly } from "@/lib/cart-items";
import { berlinDateTime } from "@/lib/berlin-time";
import { getSelectableDates, getAvailableTimes, formatDateLabel, availableServiceModes } from "@/lib/slots";
import { resolveSauce } from "@/lib/sauces";
import type { Customer, ServiceMode, VoucherDef } from "@/types";
import { PizzaSVG } from "@/components/pizza/pizza-svg";
import { SelectInput } from "@/components/common/select-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VoucherMessage { ok: boolean; text: string; }

// Warenkorb/Checkout. Portiert aus App.tsx:777-1020; Slots aus Vorlaufzeit-Config,
// Gutschein/Preise über lib/pricing, Bestellung über createOrder.
export default function CheckoutPage(): React.ReactElement {
  const { cart, removeFromCart, clearCart, increment, decrement, addSpecial, setSpecialQty } = useCart();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const cfg = useAsync(getConfig);
  const { data: ingredients } = useAsync(getIngredients);
  const { data: sauces } = useAsync(getSauces);
  const { data: openDays } = useAsync(getOpenDays);

  const [customer, setCustomer] = useState<Customer>(() => ({
    firstName: currentUser?.firstName ?? "",
    lastName: currentUser?.lastName ?? "",
    phone: currentUser?.phone ?? "",
  }));
  const [notes, setNotes] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<VoucherDef | null>(null);
  const [voucherMessage, setVoucherMessage] = useState<VoucherMessage | null>(null);
  const [serviceMode, setServiceMode] = useState<ServiceMode | "">("");
  const [orderError, setOrderError] = useState("");

  const config = cfg.data;
  const availableDates = config ? getSelectableDates(openDays ?? [], config.leadTimeDays, new Date()) : [];
  const availableTimes = config ? getAvailableTimes(config.hours) : [];
  const dateOptions = availableDates.map((d) => ({ value: d, label: formatDateLabel(d) }));
  const timeOptions = availableTimes.map((t) => ({ value: t, label: `${t} Uhr` }));
  const noDates = !cfg.loading && availableDates.length === 0;
  const noTimes = availableTimes.length === 0;

  const modes = config ? availableServiceModes(config) : [];
  const noService = !cfg.loading && modes.length === 0;
  // Default-Modus setzen, sobald verfügbar (z. B. nach dem Laden der Config)
  const specialsOnly = isSpecialsOnly(cart);

  if (modes.length > 0 && !serviceMode) setServiceMode(modes[0]);
  // Sonderartikel umgehen die Service-Verfügbarkeit (0013). Ohne Fallback bliebe serviceMode ""
  // und canOrder false, obwohl der Server die Bestellung annähme.
  else if (specialsOnly && !serviceMode) setServiceMode("takeaway");

  const subtotal = cartSubtotal(cart);
  const discount = computeDiscount(subtotal, appliedVoucher);
  const total = computeTotal(subtotal, discount);

  const canOrder =
    customer.firstName.trim() && customer.lastName.trim() && customer.phone.trim() &&
    (specialsOnly || (pickupDate && pickupTime)) && cart.length > 0 && !!serviceMode;

  const applyVoucher = async () => {
    // Zuerst prüfen, ob der Code ein freigeschalteter Sonderartikel ist.
    try {
      const special = await unlockSpecialItem(voucherCode.trim());
      if (special) {
        addSpecial(special);
        setVoucherMessage({ ok: true, text: `${special.emoji} ${special.name} freigeschaltet!` });
        setVoucherCode("");
        return;
      }
    } catch {
      // Netzwerk-/RPC-Fehler: still weiter zum normalen Gutschein-Flow.
    }
    const vouchers = await getVouchers();
    const result = validateVoucher(voucherCode, vouchers, new Date());
    if (result.ok) {
      setAppliedVoucher(result.voucher);
      setVoucherMessage({ ok: true, text: result.message });
    } else {
      setAppliedVoucher(null);
      setVoucherMessage({ ok: false, text: result.message });
    }
  };
  const removeVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode("");
    setVoucherMessage(null);
  };

  const placeOrder = async () => {
    if (!canOrder || !serviceMode) return;
    if (!specialsOnly && (noDates || noService)) return;
    setOrderError("");
    // Sonderartikel: Abholung sofort — Datum/Zeit in Berlin, nicht in der Zone des Browsers.
    const now = specialsOnly ? berlinDateTime(new Date()) : null;
    try {
      const order = await createOrder({
        items: cart,
        customer,
        notes,
        pickupDate: now ? now.date : pickupDate,
        pickupTime: now ? now.time : pickupTime,
        voucherCode: appliedVoucher?.code,
        serviceMode,
      });
      clearCart();
      navigate("/bestaetigung", { state: order });
    } catch {
      // Serverseitige Validierung (Trigger validate_order) kann ablehnen → saubere Meldung statt Absturz
      setOrderError("Bestellung konnte nicht angenommen werden — bitte Angaben prüfen.");
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-24 text-center">
        <p className="text-4xl mb-4">🛒</p>
        <h2 className="font-black text-xl mb-2">Warenkorb ist leer</h2>
        <p className="text-muted-foreground text-sm mb-6">Wähle zuerst eine Pizza aus.</p>
        <Button onClick={() => navigate("/")}>Zur Speisekarte</Button>

        {/* Code-Einlösung auch bei leerem Warenkorb: freigeschaltete Sonderartikel brauchen keine Pizza.
            Ein gültiger Code fügt den Artikel hinzu → cart ist nicht mehr leer → normaler Checkout. */}
        <div className="mt-10 w-full max-w-xs">
          <p className="text-xs text-muted-foreground mb-2">Gutschein- oder Sonderartikel-Code</p>
          <div className="flex gap-2">
            <Input placeholder="CODE" className="uppercase tracking-widest text-sm font-mono"
              value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} />
            <Button variant="secondary" onClick={applyVoucher} className="shrink-0">Einlösen</Button>
          </div>
          {voucherMessage && (
            <p className={cn("text-xs mt-2 flex items-center gap-1.5 justify-center",
              voucherMessage.ok ? "text-green-400" : "text-destructive")}>
              {voucherMessage.ok ? <Check size={11} /> : <AlertCircle size={11} />}
              {voucherMessage.text}
            </p>
          )}
        </div>
      </div>
    );
  }

  const ingName = (id: string) => (ingredients ?? []).find((x) => x.id === id)?.name;
  const sauceName = (id?: string) => resolveSauce(sauces ?? [], id)?.name;

  return (
    <div className="pb-36">
      <div className="sticky top-0 z-40 bg-background/92 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
          <ArrowLeft size={17} />
        </Button>
        <div>
          <h2 className="font-bold leading-tight">Warenkorb</h2>
          <p className="text-xs text-muted-foreground">
            {specialsOnly ? "Sonderartikel" : `${pizzaQuantity(cart)} Pizza${pizzaQuantity(cart) !== 1 ? "en" : ""}`}
          </p>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        {/* Warenkorb-Positionen */}
        <Card>
          <CardHeader><CardTitle>Deine Bestellung</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-0">
            {cart.map((item, i) => (
              <div key={item.cartId}>
                {i > 0 && <Separator className="mb-3" />}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 shrink-0 flex items-center justify-center">
                    {isSpecialItem(item)
                      ? <span className="text-2xl">{item.emoji}</span>
                      : <PizzaSVG selected={item.ingredientIds} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{isSpecialItem(item) ? item.name : item.pizzaName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isSpecialItem(item)
                        ? "Sonderartikel"
                        : [sauceName(item.sauceId), ...item.ingredientIds.map(ingName)].filter(Boolean).join(", ") || "Käse & Sauce"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Weniger"
                      disabled={item.quantity <= 1}
                      onClick={() => isSpecialItem(item) ? setSpecialQty(item.cartId, item.quantity - 1) : decrement(item.cartId)}>
                      <Minus size={13} />
                    </Button>
                    <span className="w-5 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Mehr"
                      disabled={item.quantity >= (isSpecialItem(item) ? 99 : 20)}
                      onClick={() => isSpecialItem(item) ? setSpecialQty(item.cartId, item.quantity + 1) : increment(item.cartId)}>
                      <Plus size={13} />
                    </Button>
                    <span className="font-black text-sm text-primary w-14 text-right">{formatPrice(itemLineTotal(item))}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFromCart(item.cartId)} aria-label="Entfernen">
                      <X size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            <Separator />
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => navigate("/")}>
                <Plus size={11} /> Standard-Pizza
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs gap-1.5" onClick={() => navigate("/konfigurator")}>
                <ChefHat size={11} /> Eigene Pizza
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kundendaten */}
        <Card>
          <CardHeader><CardTitle>Deine Daten</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">Vorname</Label>
                <Input id="fn" placeholder="Max" value={customer.firstName}
                  onChange={(e) => setCustomer((c) => ({ ...c, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Nachname</Label>
                <Input id="ln" placeholder="Mustermann" value={customer.lastName}
                  onChange={(e) => setCustomer((c) => ({ ...c, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Telefon</Label>
              <div className="relative">
                <Phone size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="ph" type="tel" placeholder="+49 170 1234567" className="pl-9"
                  value={customer.phone}
                  onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Abholung */}
        <Card>
          <CardHeader><CardTitle>{serviceMode === "dinein" ? "Vor Ort essen" : "Abholung"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {modes.length === 2 && (
              <div className="flex gap-2">
                {(["dinein", "takeaway"] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setServiceMode(m)}
                    className={"flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-all " +
                      (serviceMode === m ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-foreground")}>
                    {m === "dinein" ? "Vor Ort essen" : "Abholen"}
                  </button>
                ))}
              </div>
            )}
            {specialsOnly ? (
              <div className="bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
                <p className="text-sm text-primary font-semibold">Abholung sofort</p>
                <p className="text-xs text-muted-foreground mt-0.5">Kein Datum, keine Uhrzeit nötig.</p>
              </div>
            ) : cfg.loading ? (
              <p className="text-xs text-muted-foreground">Lädt…</p>
            ) : noService ? (
              <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
                <p className="text-sm text-destructive font-semibold">Aktuell kein Service verfügbar.</p>
                <p className="text-xs text-muted-foreground mt-0.5">Bitte zu einem späteren Zeitpunkt erneut versuchen.</p>
              </div>
            ) : noDates ? (
              <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
                <p className="text-sm text-destructive font-semibold">Aktuell keine Bestelltage verfügbar.</p>
                <p className="text-xs text-muted-foreground mt-0.5">Bitte zu einem späteren Zeitpunkt erneut versuchen.</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Calendar size={11} /> Datum</Label>
                  <SelectInput value={pickupDate} onChange={setPickupDate} options={dateOptions} placeholder="Tag wählen..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Clock size={11} /> Uhrzeit</Label>
                  {noTimes
                    ? <p className="text-xs text-destructive">Keine Zeiten verfügbar.</p>
                    : <SelectInput value={pickupTime} onChange={setPickupTime} options={timeOptions} placeholder="Uhrzeit wählen..." />}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bemerkungen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText size={14} className="text-muted-foreground" /> Bemerkungen</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea rows={3} placeholder="z.B. extra scharf, Allergie auf Nüsse..."
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="flex w-full rounded-xl border border-border bg-input-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50 transition-colors resize-none" />
          </CardContent>
        </Card>

        {/* Gutschein */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Ticket size={14} className="text-muted-foreground" /> Gutschein</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {appliedVoucher ? (
              <div className="flex items-center justify-between bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3">
                <div>
                  <p className="text-green-400 font-bold text-sm font-mono">{appliedVoucher.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {appliedVoucher.type === "ingredient"
                      ? `Sonderzutat: ${appliedVoucher.ingredientName}`
                      : appliedVoucher.type === "percent"
                      ? `${appliedVoucher.value}% Rabatt`
                      : `${formatPrice(appliedVoucher.value)} Rabatt`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeVoucher}><X size={13} /></Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input placeholder="WELCOME10" className="uppercase tracking-widest text-sm font-mono"
                  value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} />
                <Button variant="secondary" onClick={applyVoucher} className="shrink-0">Einlösen</Button>
              </div>
            )}
            {voucherMessage && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className={cn("text-xs flex items-center gap-1.5",
                  voucherMessage.ok ? "text-green-400" : "text-destructive")}>
                {voucherMessage.ok ? <Check size={11} /> : <AlertCircle size={11} />}
                {voucherMessage.text}
              </motion.p>
            )}
          </CardContent>
        </Card>

        {/* Preisübersicht */}
        <Card>
          <CardContent className="pt-5 space-y-2 text-sm">
            {cart.map((item) => (
              <div key={item.cartId} className="flex justify-between text-muted-foreground">
                <span>{isSpecialItem(item) ? item.name : item.pizzaName}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</span>
                <span>{formatPrice(itemLineTotal(item))}</span>
              </div>
            ))}
            {appliedVoucher?.type === "ingredient" && appliedVoucher.ingredientName && (
              <div className="flex justify-between text-green-400">
                <span>Sonderzutat</span>
                <span>🎁 {appliedVoucher.ingredientName}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Gutschein</span><span>− {formatPrice(discount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-black text-base pt-0.5">
              <span>Gesamt</span>
              <span className="text-primary text-lg">{formatPrice(total)}</span>
            </div>
            <p className="text-[11px] text-center text-muted-foreground pt-1">Bezahlung bei Abholung in bar</p>
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-[68px] left-0 right-0 z-40 px-4 pb-2 max-w-lg mx-auto">
        {orderError && <p className="text-destructive text-xs text-center mb-2">{orderError}</p>}
        <Button size="lg" className="w-full font-black text-base shadow-2xl shadow-primary/25"
          disabled={!canOrder || (!specialsOnly && (noDates || noService))} onClick={placeOrder}>
          {specialsOnly
            ? `Sofort bestellen — ${formatPrice(total)}`
            : `${pizzaQuantity(cart)} Pizza${pizzaQuantity(cart) !== 1 ? "en" : ""} ${serviceMode === "dinein" ? "vor Ort" : "abholen"} — ${formatPrice(total)}`}
        </Button>
      </div>
    </div>
  );
}
