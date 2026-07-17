import { describe, it, expect } from "bun:test";
import { formatSpecialAlert, type SpecialAlertOrder } from "@/lib/special-alert";

const mk = (o: Partial<SpecialAlertOrder>): SpecialAlertOrder => ({
  id: "#42", createdTime: "21:42", customerName: "Max Mustermann", customerPhone: "+49 170 1234567",
  items: [{ kind: "special", name: "VIP", emoji: "🌿", quantity: 2 }],
  total: 12, serviceMode: "takeaway", notes: "", ...o,
});

describe("formatSpecialAlert", () => {
  it("Kopf mit Nummer, Uhrzeit, Name, Telefon", () => {
    expect(formatSpecialAlert(mk({}))).toContain("#42 · 21:42 · Max Mustermann · +49 170 1234567");
  });
  it("Sonderartikel mit Emoji und Menge", () => {
    expect(formatSpecialAlert(mk({}))).toContain("🌿 VIP × 2");
  });
  it("Mischbestellung: Pizza wird zusätzlich gelistet", () => {
    const msg = formatSpecialAlert(mk({
      items: [
        { kind: "special", name: "VIP", emoji: "🌿", quantity: 2 },
        { pizzaName: "Margherita", quantity: 1 },
      ],
      total: 22,
    }));
    expect(msg).toContain("🌿 VIP × 2");
    expect(msg).toContain("• Margherita × 1");
    expect(msg).toContain("Gesamt 22,00 €");
  });
  it("Vor Ort statt Abholen", () => {
    expect(formatSpecialAlert(mk({ serviceMode: "dinein" }))).toContain("· Vor Ort");
  });
  it("Notiz nur wenn vorhanden", () => {
    expect(formatSpecialAlert(mk({ notes: "klingeln" }))).toContain("Notiz: klingeln");
    expect(formatSpecialAlert(mk({ notes: "" }))).not.toContain("Notiz:");
  });
  it("fehlende Menge zählt als 1", () => {
    expect(formatSpecialAlert(mk({ items: [{ kind: "special", name: "VIP", emoji: "🌿" }] }))).toContain("🌿 VIP × 1");
  });
});
