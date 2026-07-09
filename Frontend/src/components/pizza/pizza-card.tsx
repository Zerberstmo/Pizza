import type React from "react";
import { motion } from "motion/react";
import type { IngredientItem, PizzaTemplate } from "@/types";
import { PizzaSVG } from "./pizza-svg";

// Menü-Kachel. Basiert auf der HomePage-Kachel (App.tsx:564-622), aber statt
// Figma-Foto (PIZZA_IMAGES) wird die selbst-enthaltene PizzaSVG gerendert.
export function PizzaCard({ template, onAdd, ingredients = [], index = 0 }: {
  template: PizzaTemplate;
  onAdd: (template: PizzaTemplate) => void;
  ingredients?: IngredientItem[];
  index?: number;
}): React.ReactElement {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
    >
      <button onClick={() => onAdd(template)} className="w-full text-left group focus:outline-none">
        <div className="rounded-2xl overflow-hidden border border-border bg-card
          group-hover:border-primary/35 group-active:scale-[0.98]
          transition-all duration-200 shadow-sm">

          {/* Visual */}
          <div className="relative h-36 bg-muted overflow-hidden flex items-center justify-center p-3">
            <div className="h-full aspect-square group-hover:scale-105 transition-transform duration-300">
              <PizzaSVG selected={template.ingredientIds} />
            </div>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: template.color }} />
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white
              text-[10px] font-black px-2 py-0.5 rounded-full">
              10 €
            </div>
          </div>

          {/* Info */}
          <div className="p-3">
            <p className="font-black text-sm leading-tight">{template.name}</p>
            <p className="text-[10px] text-muted-foreground/60 italic mt-0.5">{template.sub}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
              {template.desc}
            </p>

            <div className="flex gap-1 mt-2 flex-wrap">
              {template.ingredientIds.map((id) => {
                const ing = ingredients.find((x) => x.id === id);
                return ing ? <span key={id} className="text-sm">{ing.emoji}</span> : null;
              })}
            </div>

            <div className="mt-3 w-full bg-primary/10 border border-primary/20 rounded-lg py-2
              text-xs font-bold text-primary text-center
              group-hover:bg-primary group-hover:text-white transition-all duration-200">
              + In den Warenkorb
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}
