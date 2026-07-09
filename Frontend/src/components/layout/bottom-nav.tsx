import type React from "react";
import { NavLink } from "react-router";
import { Home, ChefHat, ShoppingCart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";

// Untere Tab-Leiste für Kundenrouten. Portiert aus App.tsx:467-517,
// aber Zustand via react-router NavLink statt view/setView.
export function BottomNav(): React.ReactElement {
  const { count } = useCart();
  const base = "flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors";
  const active = "text-primary";
  const idle = "text-muted-foreground hover:text-foreground";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border max-w-lg mx-auto">
      <div className="flex">
        <NavLink to="/" end className={({ isActive }) => cn(base, isActive ? active : idle)}>
          {({ isActive }) => (
            <>
              <Home size={21} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">Speisekarte</span>
            </>
          )}
        </NavLink>

        <NavLink to="/konfigurator" className={({ isActive }) => cn(base, isActive ? active : idle)}>
          {({ isActive }) => (
            <>
              <ChefHat size={21} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">Eigene Pizza</span>
            </>
          )}
        </NavLink>

        <NavLink
          to="/warenkorb"
          className={({ isActive }) =>
            cn(base, "relative", isActive ? active : count > 0 ? "text-foreground" : idle)
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <ShoppingCart size={21} strokeWidth={isActive ? 2.5 : 2} />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-primary text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
                    {count}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold">Warenkorb</span>
            </>
          )}
        </NavLink>

        <NavLink to="/admin" className={({ isActive }) => cn(base, isActive ? active : idle)}>
          <Settings size={21} strokeWidth={2} />
          <span className="text-[10px] font-semibold">Admin</span>
        </NavLink>
      </div>
    </nav>
  );
}
