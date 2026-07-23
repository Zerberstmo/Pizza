import { render } from "@testing-library/react";
import { test, expect } from "bun:test";
import { SectionHeader } from "./section-header";

test("renders title always and eyebrow when given", () => {
  const { container } = render(<SectionHeader eyebrow="Speisekarte" title="Unsere Pizzen" />);
  expect(container.querySelector("h2")?.textContent).toBe("Unsere Pizzen");
  expect(container.querySelector('[data-testid="eyebrow"]')?.textContent).toBe("Speisekarte");
});

test("omits eyebrow when not provided", () => {
  const { container } = render(<SectionHeader title="Nur Titel" />);
  expect(container.querySelector('[data-testid="eyebrow"]')).toBeNull();
});
