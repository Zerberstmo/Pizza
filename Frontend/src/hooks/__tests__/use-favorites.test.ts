import { describe, it, expect } from "bun:test";
import { applyRename, applyUpdate } from "../use-favorites";

const base = () => [
  { id: "a", name: "Alpha", ingredientIds: ["i1"], sauceId: "s1" },
  { id: "b", name: "Beta", ingredientIds: ["i2"], sauceId: "s2" },
];

describe("applyRename", () => {
  it("benennt nur den passenden Favoriten um", () => {
    const r = applyRename(base(), "a", "Neu");
    expect(r[0].name).toBe("Neu");
    expect(r[1].name).toBe("Beta");
  });
  it("trimmt den Namen", () => {
    expect(applyRename(base(), "a", "  Neu  ")[0].name).toBe("Neu");
  });
  it("ignoriert leeren Namen (No-op)", () => {
    expect(applyRename(base(), "a", "   ")[0].name).toBe("Alpha");
  });
  it("unbekannte id = No-op", () => {
    expect(applyRename(base(), "x", "Neu").map((f) => f.name)).toEqual(["Alpha", "Beta"]);
  });
});

describe("applyUpdate", () => {
  it("überschreibt Zutaten/Soße/Name des passenden Favoriten", () => {
    const r = applyUpdate(base(), "a", { name: "Neu", ingredientIds: ["i9"], sauceId: "s9" });
    expect(r[0]).toEqual({ id: "a", name: "Neu", ingredientIds: ["i9"], sauceId: "s9" });
  });
  it("lässt andere Favoriten unberührt", () => {
    expect(applyUpdate(base(), "a", { ingredientIds: ["i9"] })[1]).toEqual({
      id: "b", name: "Beta", ingredientIds: ["i2"], sauceId: "s2",
    });
  });
  it("leerer Name bleibt beim alten Namen, Rezept ändert sich", () => {
    const r = applyUpdate(base(), "a", { name: "  ", ingredientIds: ["i9"] });
    expect(r[0].name).toBe("Alpha");
    expect(r[0].ingredientIds).toEqual(["i9"]);
  });
  it("unbekannte id = No-op", () => {
    expect(applyUpdate(base(), "x", { ingredientIds: ["i9"] })).toEqual(base());
  });
});
