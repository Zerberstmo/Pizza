import type React from "react";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { ArrowLeft, X, Check } from "lucide-react";
import { getIngredients } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useCart } from "@/hooks/use-cart";
import { getRecs } from "@/lib/recommendations";
import { cn } from "@/lib/utils";
import type { IngredientItem } from "@/types";
import { PizzaSVG } from "@/components/pizza/pizza-svg";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// Konfigurator. Portiert aus App.tsx:645-771; Zutaten async, selected lokal.
export default function ConfiguratorPage(): React.ReactElement {
  const { data, loading, error } = useAsync(getIngredients);
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const recs = useMemo(() => getRecs(selected), [selected]);

  const addOwnPizza = () => {
    if (selected.length === 0) return;
    addToCart("Eigene Pizza", selected);
    setSelected([]);
    navigate("/warenkorb");
  };

  return (
    <div className="pb-44">
      <div className="sticky top-0 z-40 bg-background/92 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ArrowLeft size={17} />
          </Button>
          <span className="font-bold text-sm">Eigene Pizza bauen</span>
        </div>
        <Badge variant="secondary" className="font-mono font-bold">10,00 €</Badge>
      </div>

      <AsyncBoundary loading={loading} error={error} data={data}>
        {(ingredients: IngredientItem[]) => {
          // Kategorie-Reihenfolge aus den Daten ableiten (erste Sichtung gewinnt).
          const categories = ingredients.reduce<string[]>((acc, i) => {
            if (!acc.includes(i.category)) acc.push(i.category);
            return acc;
          }, []);
          return (
            <div className="px-4 mt-5">
              {/* Live-Vorschau */}
              <div className="flex items-start gap-4 mb-5">
                <div className="w-36 h-36 shrink-0">
                  <motion.div
                    key={selected.join(",")}
                    initial={{ scale: 0.93, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    className="w-full h-full"
                  >
                    <PizzaSVG selected={selected} />
                  </motion.div>
                </div>
                <div className="flex-1 pt-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Ausgewählt</p>
                  {selected.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50">Noch keine Zutaten.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.map((id) => {
                        const ing = ingredients.find((x) => x.id === id);
                        return ing ? (
                          <span key={id} className="inline-flex items-center gap-1 text-xs bg-primary/10 border border-primary/20 text-primary rounded-full px-2.5 py-0.5 font-medium">
                            {ing.emoji} {ing.name}
                            <button onClick={() => toggle(id)} className="ml-0.5 hover:opacity-60 transition-opacity"><X size={9} /></button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Empfehlungen */}
              <AnimatePresence>
                {recs.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="space-y-2">
                      {recs.map((r, i) => (
                        <div key={i} className="flex items-center gap-3 bg-amber-400/6 border border-amber-400/12 rounded-lg px-3 py-2.5">
                          <span className="text-amber-400 shrink-0 text-sm">✨</span>
                          <p className="text-xs flex-1 text-foreground/65">{r.text}</p>
                          {!selected.includes(r.addId) && (
                            <button onClick={() => toggle(r.addId)}
                              className="text-[10px] font-black text-amber-400 hover:text-amber-300 transition-colors shrink-0">
                              + Hinzu
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Zutaten-Chips nach Kategorie */}
              {categories.map((cat) => {
                const items = ingredients.filter((i) => i.category === cat);
                if (items.length === 0) return null;
                return (
                  <div key={cat} className="mb-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">{cat}</p>
                    <div className="flex flex-wrap gap-2">
                      {items.map((ing) => {
                        const active = selected.includes(ing.id);
                        return (
                          <button key={ing.id} disabled={!ing.available}
                            onClick={() => ing.available && toggle(ing.id)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                              !ing.available
                                ? "opacity-25 cursor-not-allowed border-border bg-card text-muted-foreground"
                                : active
                                ? "border-primary/50 bg-primary/10 text-primary"
                                : "border-border bg-card hover:border-border/80 text-foreground"
                            )}>
                            <span className="text-base leading-none">{ing.emoji}</span>
                            {ing.name}
                            {active && <Check size={11} className="text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }}
      </AsyncBoundary>

      {/* Sticky CTA */}
      <div className="fixed bottom-[68px] left-0 right-0 z-40 px-4 pb-2 max-w-lg mx-auto">
        <Card className="shadow-2xl shadow-black/60">
          <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">
                {selected.length > 0 ? `${selected.length} Zutat${selected.length !== 1 ? "en" : ""}` : "Keine Zutaten"}
              </p>
              <p className="font-black text-xl text-primary leading-tight">10,00 €</p>
            </div>
            <Button onClick={addOwnPizza} disabled={selected.length === 0} className="gap-2 shadow-lg shadow-primary/20">
              + Warenkorb
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
