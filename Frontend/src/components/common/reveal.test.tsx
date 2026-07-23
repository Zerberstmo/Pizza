import { render } from "@testing-library/react";
import { test, expect } from "bun:test";
import { Reveal } from "./reveal";

test("renders children", () => {
  const { container } = render(<Reveal><span>Inhalt</span></Reveal>);
  expect(container.textContent).toContain("Inhalt");
});
