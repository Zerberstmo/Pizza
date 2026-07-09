import { describe, it, expect } from "bun:test";
import { render } from "@testing-library/react";
import { PizzaSVG } from "@/components/pizza/pizza-svg";

describe("PizzaSVG", () => {
  it("renders an svg without crashing", () => {
    const { container } = render(<PizzaSVG selected={["salami", "mozzarella"]} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
