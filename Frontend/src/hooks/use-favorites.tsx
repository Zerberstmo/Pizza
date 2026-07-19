import { createContext, useContext, useEffect, useState } from "react";
import type { FavoritePizza } from "@/types";

const uid = () => Math.random().toString(36).slice(2, 9);
const KEY = "pizza-favorites";
const MAX = 5;

export type FavoritePatch = { name?: string; ingredientIds?: string[]; sauceId?: string };

// Reine Transformationen (ohne Context/localStorage testbar).
export function applyRename(list: FavoritePizza[], id: string, name: string): FavoritePizza[] {
  const clean = name.trim();
  if (!clean) return list; // leerer Name: alter Name bleibt
  return list.map((f) => (f.id === id ? { ...f, name: clean } : f));
}
export function applyUpdate(list: FavoritePizza[], id: string, patch: FavoritePatch): FavoritePizza[] {
  return list.map((f) => {
    if (f.id !== id) return f;
    const name = patch.name !== undefined ? patch.name.trim() : "";
    return {
      ...f,
      ...(patch.ingredientIds !== undefined ? { ingredientIds: patch.ingredientIds } : {}),
      ...(patch.sauceId !== undefined ? { sauceId: patch.sauceId } : {}),
      ...(name ? { name } : {}), // leerer Name: alter Name bleibt
    };
  });
}

interface FavoritesContextValue {
  favorites: FavoritePizza[];
  add(name: string, ingredientIds: string[], sauceId: string): boolean;
  remove(id: string): void;
  rename(id: string, name: string): void;
  update(id: string, patch: FavoritePatch): void;
  isFull: boolean;
}
const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoritePizza[]>(() => {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FavoritePizza[]) : [];
  });
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(favorites));
  }, [favorites]);

  const add = (name: string, ingredientIds: string[], sauceId: string): boolean => {
    if (favorites.length >= MAX) return false;
    setFavorites((p) => [...p, { id: uid(), name, ingredientIds, sauceId }]);
    return true;
  };
  const remove = (id: string) => setFavorites((p) => p.filter((f) => f.id !== id));
  const rename = (id: string, name: string) => setFavorites((p) => applyRename(p, id, name));
  const update = (id: string, patch: FavoritePatch) => setFavorites((p) => applyUpdate(p, id, patch));

  return (
    <FavoritesContext.Provider value={{ favorites, add, remove, rename, update, isFull: favorites.length >= MAX }}>
      {children}
    </FavoritesContext.Provider>
  );
}
export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
