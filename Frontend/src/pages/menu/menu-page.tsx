import type React from "react";
import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { X, Pencil } from "lucide-react";
import { getMenu, getIngredients, getConfig, getSauces, getOpenDays } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useCart } from "@/hooks/use-cart";
import { useFavorites } from "@/hooks/use-favorites";
import { resolveSauce } from "@/lib/sauces";
import { availableServiceModes } from "@/lib/slots";
import { BASE_PRICE } from "@/lib/pricing";
import type { PizzaTemplate } from "@/types";
import { PizzaCard } from "@/components/pizza/pizza-card";
import { PizzaSVG } from "@/components/pizza/pizza-svg";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { OpeningStatusBanner } from "@/components/common/opening-status-banner";
import { Separator } from "@/components/ui/separator";
import { SectionHeader } from "@/components/common/section-header";

// Speisekarte. Portiert aus App.tsx:541-637 (HomePage), Menü nun async.
export default function MenuPage(): React.ReactElement {
  const menu = useAsync(getMenu);
  const ingredients = useAsync(getIngredients);
  const config = useAsync(getConfig);
  const sauces = useAsync(getSauces);
  const openDays = useAsync(getOpenDays);
  const { addToCart, count } = useCart();
  const { favorites, remove, rename } = useFavorites();
  const navigate = useNavigate();
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const modes = config.data ? availableServiceModes(config.data) : [];
  const serviceLabel =
    config.loading ? "Vorbestellen" // neutral, solange Config lädt (kein "Aktuell geschlossen"-Flackern)
    : modes.length === 2 ? "Vor Ort & Abholung"
    : modes[0] === "takeaway" ? "Nur Abholung"
    : modes[0] === "dinein" ? "Nur Vor Ort"
    : "Aktuell geschlossen";

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-5 pt-10 pb-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <SectionHeader eyebrow={`Pizzeria · ${serviceLabel}`} title="Unsere Speisekarte" />
          <p className="text-muted-foreground text-sm mt-2">
            Jede Pizza <span className="text-primary font-bold">10 €</span> · Bezahlung in bar
          </p>
        </motion.div>
      </div>

      {config.data && openDays.data && (
        <div className="px-4 pb-4">
          <OpeningStatusBanner config={config.data} openDays={openDays.data} />
        </div>
      )}

      <Separator />

      {/* Favoriten */}
      {favorites.length > 0 && (
        <div className="px-4 pt-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Meine Favoriten</p>
          <div className="grid grid-cols-2 gap-3">
            {favorites.map((f) => {
              const color = resolveSauce(sauces.data ?? [], f.sauceId)?.color;
              return (
                <div key={f.id} className="rounded-2xl border border-border bg-card p-3 relative">
                  <button type="button" className="absolute top-2 right-2 text-muted-foreground hover:text-destructive" onClick={() => remove(f.id)}><X size={13} /></button>
                  <div className="h-24 mx-auto aspect-square"><PizzaSVG selected={f.ingredientIds} sauceColor={color} /></div>
                  {renameId === f.id ? (
                    <input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { rename(f.id, renameDraft); setRenameId(null); }
                        if (e.key === "Escape") setRenameId(null);
                      }}
                      onBlur={() => { rename(f.id, renameDraft); setRenameId(null); }}
                      className="w-full mt-2 bg-transparent outline-none border-b border-primary/40 font-black text-sm" />
                  ) : (
                    <div className="flex items-center gap-1 mt-2">
                      <p className="font-black text-sm leading-tight flex-1 min-w-0 truncate">{f.name}</p>
                      <button type="button" className="text-muted-foreground hover:text-primary shrink-0"
                        onClick={() => { setRenameId(f.id); setRenameDraft(f.name); }} aria-label="Umbenennen"><Pencil size={12} /></button>
                    </div>
                  )}
                  <button type="button"
                    onClick={() => addToCart(f.name, f.ingredientIds, f.sauceId)}
                    className="mt-2 w-full bg-primary/10 border border-primary/20 rounded-lg py-2 text-xs font-bold text-primary text-center hover:bg-primary hover:text-white transition-all">
                    + In den Warenkorb
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2 × 2 Pizza-Grid */}
      <AsyncBoundary
        loading={menu.loading}
        error={menu.error}
        data={menu.data}
        empty={<p className="px-5 py-16 text-center text-muted-foreground text-sm">Aktuell keine Pizzen verfügbar.</p>}
      >
        {(templates: PizzaTemplate[]) => (
          <div className="px-4 pt-5 grid grid-cols-2 gap-3">
            {templates.map((t, i) => (
              <PizzaCard
                key={t.id}
                template={t}
                index={i}
                ingredients={ingredients.data ?? []}
                onAdd={(tpl) => addToCart(tpl.name, tpl.ingredientIds)}
              />
            ))}
          </div>
        )}
      </AsyncBoundary>

      {/* Warenkorb-Hinweis */}
      {count > 0 && (
        <div className="px-4 mt-4">
          <button
            onClick={() => navigate("/warenkorb")}
            className="w-full flex items-center justify-between bg-primary text-white rounded-2xl px-5 py-3.5 shadow-lg shadow-primary/30 active:scale-[0.98] transition-transform"
          >
            <span className="text-sm font-bold">{count} Pizza{count !== 1 ? "en" : ""} im Warenkorb</span>
            <span className="font-black text-base">{count * BASE_PRICE},00 € →</span>
          </button>
        </div>
      )}
    </div>
  );
}
