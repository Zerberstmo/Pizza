import { test, expect } from "@playwright/test";

// ponytail: In dieser Dev-Umgebung ist kein Browser lauffähig (Playwright-Download
// gesperrt UND System-Chrome-Launch hängt). Test lokal/CI mit Browser ausführen:
//   bunx playwright install chromium && bun run test:e2e
// Feature-Parität ist zusätzlich über Unit-Tests + Build abgesichert.
test("Bestell-Happy-Path: Pizza → Warenkorb → bestellen → Bestätigung + QR", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Erste Standard-Pizza in den Warenkorb (PizzaCard ist ein Button mit "In den Warenkorb").
  await page.getByRole("button", { name: /In den Warenkorb/i }).first().click();

  // Zum Warenkorb navigieren.
  await page.goto("/warenkorb");
  await page.getByLabel("Vorname").fill("Max");
  await page.getByLabel("Nachname").fill("Mustermann");
  await page.getByLabel("Telefon").fill("+49 170 1234567");

  // Frühestes Datum + erste Zeit wählen (native Selects), dann bestellen.
  await page.locator("select").first().selectOption({ index: 1 });
  await page.locator("select").nth(1).selectOption({ index: 1 });
  await page.getByRole("button", { name: /bestellen —/i }).click();

  // Bestätigung: Bestellnummer (#12345) + QR-SVG.
  await expect(page.getByText(/#\d{5}/)).toBeVisible();
  await expect(page.locator("svg")).not.toHaveCount(0);
});
