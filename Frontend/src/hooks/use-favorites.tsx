import { createContext, useContext, useEffect, useState } from "react";
import type { FavoritePizza } from "@/types";

const uid = () => Math.random().toString(36).slice(2, 9);
const KEY = "pizza-favorites";
const MAX = 5;

interface FavoritesContextValue {
  favorites: FavoritePizza[];
  add(name: string, ingredientIds: string[], sauceId: string): boolean;
  remove(id: string): void;
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

  return (
    <FavoritesContext.Provider value={{ favorites, add, remove, isFull: favorites.length >= MAX }}>
      {children}
    </FavoritesContext.Provider>
  );
}
export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
