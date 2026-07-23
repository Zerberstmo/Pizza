import { render } from "@testing-library/react";
import { test, expect } from "bun:test";
import { Button } from "./button";

test("glow variant renders with glow class", () => {
  const { container } = render(<Button variant="glow">Bestellen</Button>);
  const btn = container.querySelector("button");
  expect(btn?.className).toContain("shadow-[0_0_0_var(--primary-glow)]");
});
