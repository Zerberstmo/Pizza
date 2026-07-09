import type React from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { getMenu, getIngredients } from "@/lib/data/store";
import { useAsync } from "@/hooks/use-async";
import { useCart } from "@/hooks/use-cart";
import { BASE_PRICE } from "@/lib/pricing";
import type { PizzaTemplate } from "@/types";
import { PizzaCard } from "@/components/pizza/pizza-card";
import { AsyncBoundary } from "@/components/common/async-boundary";
import { Separator } from "@/components/ui/separator";

// Speisekarte. Portiert aus App.tsx:541-637 (HomePage), Menü nun async.
export default function MenuPage(): React.ReactElement {
  const menu = useAsync(getMenu);
  const ingredients = useAsync(getIngredients);
  const { addToCart, count } = useCart();
  const navigate = useNavigate();

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="px-5 pt-10 pb-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-[10px] font-black tracking-[0.3em] uppercase text-primary mb-3">
            Pizzeria · Nur Abholung
          </p>
          <h1 className="text-4xl font-black leading-none tracking-tight mb-1">
            Unsere<br />
            <span className="text-primary">Speisekarte.</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Jede Pizza <span className="text-primary font-bold">10 €</span> · Bezahlung bei Abholung
          </p>
        </motion.div>
      </div>

      <Separator />

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
