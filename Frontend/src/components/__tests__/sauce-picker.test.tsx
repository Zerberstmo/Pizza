import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { SaucePicker } from "@/components/pizza/sauce-picker";
import type { Sauce } from "@/types";

const sauces: Sauce[] = [
  { id: "tomate", name: "Tomate", emoji: "🍅", color: "#B03818", available: true },
  { id: "pesto",  name: "Pesto",  emoji: "🌿", color: "#4B7A2F", available: true },
];

describe("SaucePicker", () => {
  it("rendert einen Button je Soße", () => {
    const { getByText } = render(<SaucePicker sauces={sauces} value="tomate" onChange={() => {}} />);
    expect(getByText("Tomate")).not.toBeNull();
    expect(getByText("Pesto")).not.toBeNull();
  });
});
