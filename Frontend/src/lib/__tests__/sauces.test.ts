import { describe, it, expect } from "bun:test";
import { resolveSauce } from "@/lib/sauces";
import type { Sauce } from "@/types";

const sauces: Sauce[] = [
  { id: "tomate", name: "Tomate", emoji: "🍅", color: "#B03818", available: true },
  { id: "pesto",  name: "Pesto",  emoji: "🌿", color: "#4B7A2F", available: false },
];

describe("resolveSauce", () => {
  it("findet die Soße per id", () => expect(resolveSauce(sauces, "tomate")?.id).toBe("tomate"));
  it("ignoriert nicht verfügbare Soße → erste verfügbare", () => expect(resolveSauce(sauces, "pesto")?.id).toBe("tomate"));
  it("fällt ohne id auf erste verfügbare zurück", () => expect(resolveSauce(sauces, undefined)?.id).toBe("tomate"));
});
