import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { PizzaSVG } from "@/components/pizza/pizza-svg";

describe("PizzaSVG", () => {
  it("renders an svg without crashing", () => {
    const { container } = render(<PizzaSVG selected={["salami", "mozzarella"]} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("färbt den Boden mit sauceColor", () => {
    const { container } = render(<PizzaSVG selected={[]} sauceColor="#4B7A2F" />);
    const filled = Array.from(container.querySelectorAll("circle")).some(
      (c) => c.getAttribute("fill") === "#4B7A2F"
    );
    expect(filled).toBe(true);
  });
});
