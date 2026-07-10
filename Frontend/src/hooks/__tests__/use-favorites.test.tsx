import { describe, it, expect, beforeEach } from "bun:test";
import { renderHook, act } from "@testing-library/react";
import { FavoritesProvider, useFavorites } from "@/hooks/use-favorites";

const wrapper = ({ children }: { children: React.ReactNode }) => <FavoritesProvider>{children}</FavoritesProvider>;
beforeEach(() => localStorage.clear());

describe("useFavorites", () => {
  it("fügt hinzu und persistiert", () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    act(() => { result.current.add("Meine Pizza 1", ["salami"], "tomate"); });
    expect(result.current.favorites.length).toBe(1);
    expect(localStorage.getItem("pizza-favorites")).toContain("Meine Pizza 1");
  });
  it("blockiert den 6. Favoriten", () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    act(() => { for (let i = 0; i < 5; i++) result.current.add(`P${i}`, [], "tomate"); });
    let ok = true;
    act(() => { ok = result.current.add("P6", [], "tomate"); });
    expect(ok).toBe(false);
    expect(result.current.favorites.length).toBe(5);
    expect(result.current.isFull).toBe(true);
  });
  it("entfernt einen Favoriten", () => {
    const { result } = renderHook(() => useFavorites(), { wrapper });
    act(() => { result.current.add("P", ["mozzarella"], "tomate"); });
    const id = result.current.favorites[0].id;
    act(() => { result.current.remove(id); });
    expect(result.current.favorites.length).toBe(0);
  });
});
