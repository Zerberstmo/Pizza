import { render } from "@testing-library/react";
import { test, expect } from "bun:test";
import { Card } from "./card";

test("elevated card adds glass edge + warm shadow", () => {
  const { container } = render(<Card elevated>x</Card>);
  const el = container.querySelector("div");
  expect(el?.className).toContain("card-glass-edge");
  expect(el?.className).toContain("bg-elevated");
});

test("default card stays unchanged (no glass edge)", () => {
  const { container } = render(<Card>y</Card>);
  const el = container.querySelector("div");
  expect(el?.className).not.toContain("card-glass-edge");
});
