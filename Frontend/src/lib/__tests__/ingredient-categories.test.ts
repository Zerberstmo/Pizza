import { describe, it, expect } from "bun:test";
import { mergeCategories, BASE_CATEGORIES } from "@/lib/ingredient-categories";
import type { IngredientItem } from "@/types";

const ing = (category: string): IngredientItem => ({ id: category, name: category, emoji: "🍕", category, available: true, description: "" });

describe("mergeCategories", () => {
  it("ohne Zutaten → nur BASE_CATEGORIES", () => {
    expect(mergeCategories([], BASE_CATEGORIES)).toEqual(["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges"]);
  });
  it("neue datengetriebene Kategorie kommt hinten dran (keine Dublette)", () => {
    expect(mergeCategories([ing("Dessert")], BASE_CATEGORIES)).toEqual(["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges", "Dessert"]);
  });
  it("bereits im Grundset vorhandene Kategorie erzeugt keine Dublette", () => {
    expect(mergeCategories([ing("Käse"), ing("Gemüse")], BASE_CATEGORIES)).toEqual(["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges"]);
  });
  it("mehrere neue Kategorien: erste Sichtung gewinnt, keine Dubletten", () => {
    expect(mergeCategories([ing("Dessert"), ing("Getränke"), ing("Dessert")], BASE_CATEGORIES)).toEqual(["Käse", "Fleisch", "Fisch", "Gemüse", "Sonstiges", "Dessert", "Getränke"]);
  });
  it("Default-Parameter nutzt BASE_CATEGORIES", () => {
    expect(mergeCategories([])).toEqual(BASE_CATEGORIES);
  });
});
