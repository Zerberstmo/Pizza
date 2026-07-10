import type React from "react";
import { X } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import type { FavoritePizza } from "@/types";

// Leiste mit gespeicherten Favoriten. Antippen lädt, X löscht.
export function FavoritesBar({ onLoad }: { onLoad: (fav: FavoritePizza) => void }): React.ReactElement | null {
  const { favorites, remove } = useFavorites();
  if (favorites.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Meine Favoriten</p>
      <div className="flex flex-wrap gap-2">
        {favorites.map((f) => (
          <div key={f.id} className="flex items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 py-1 text-sm">
            <button type="button" className="font-medium hover:text-primary transition-colors" onClick={() => onLoad(f)}>{f.name}</button>
            <button type="button" className="p-1 text-muted-foreground hover:text-destructive transition-colors" onClick={() => remove(f.id)}><X size={11} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
