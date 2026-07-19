import type React from "react";
import { useState } from "react";
import { X, Pencil, Check } from "lucide-react";
import { useFavorites } from "@/hooks/use-favorites";
import type { FavoritePizza } from "@/types";

// Leiste mit gespeicherten Favoriten. Antippen lädt, Stift benennt um, X löscht.
export function FavoritesBar({ onLoad }: { onLoad: (fav: FavoritePizza) => void }): React.ReactElement | null {
  const { favorites, remove, rename } = useFavorites();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  if (favorites.length === 0) return null;

  const startEdit = (f: FavoritePizza) => { setEditingId(f.id); setDraft(f.name); };
  const commit = () => { if (editingId) rename(editingId, draft); setEditingId(null); };

  return (
    <div className="mb-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Meine Favoriten</p>
      <div className="flex flex-wrap gap-2">
        {favorites.map((f) => (
          <div key={f.id} className="flex items-center gap-1 rounded-full border border-border bg-card pl-3 pr-1 py-1 text-sm">
            {editingId === f.id ? (
              <>
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditingId(null); }}
                  onBlur={commit}
                  className="w-24 bg-transparent outline-none border-b border-primary/40 text-sm" />
                <button type="button" className="p-1 text-primary" aria-label="Speichern"
                  onMouseDown={(e) => e.preventDefault()} onClick={commit}><Check size={11} /></button>
              </>
            ) : (
              <>
                <button type="button" className="font-medium hover:text-primary transition-colors" onClick={() => onLoad(f)}>{f.name}</button>
                <button type="button" className="p-1 text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => startEdit(f)} aria-label="Umbenennen"><Pencil size={10} /></button>
                <button type="button" className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => remove(f.id)} aria-label="Löschen"><X size={11} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
