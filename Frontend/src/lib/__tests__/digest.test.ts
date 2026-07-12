import { describe, it, expect } from "bun:test";
import { filterTodaysPickups, formatDigest, type DigestOrder } from "@/lib/digest";
import { formatPrepList, type PrepOrder } from "@/lib/digest";

const mk = (o: Partial<DigestOrder>): DigestOrder => ({
  pickupDate: "2026-07-12", pickupTime: "17:30", customerName: "Max Mustermann",
  customerPhone: "+49 170 1234567", items: [{ pizzaName: "Margherita" }], total: 10,
  serviceMode: "takeaway", notes: "", ...o,
});

describe("filterTodaysPickups", () => {
  it("behält nur heutige Abholungen und sortiert nach Uhrzeit", () => {
    const orders = [
      mk({ pickupDate: "2026-07-13", pickupTime: "12:00" }),
      mk({ pickupDate: "2026-07-12", pickupTime: "18:00" }),
      mk({ pickupDate: "2026-07-12", pickupTime: "17:30" }),
    ];
    const out = filterTodaysPickups(orders, "2026-07-12");
    expect(out.map((o) => o.pickupTime)).toEqual(["17:30", "18:00"]);
  });
  it("leeres Ergebnis wenn nichts für heute", () => {
    expect(filterTodaysPickups([mk({ pickupDate: "2026-07-13" })], "2026-07-12")).toEqual([]);
  });
});

describe("formatDigest", () => {
  it("leeres Array → leerer String (Signal: nicht senden)", () => {
    expect(formatDigest([], "Sa 12.07.")).toBe("");
  });
  it("Kopf mit Anzahl (Plural) und Summe", () => {
    const msg = formatDigest([mk({ total: 20 }), mk({ total: 10, pickupTime: "18:00" })], "Sa 12.07.");
    expect(msg).toContain("🍕 Abholungen heute, Sa 12.07.");
    expect(msg).toContain("2 Bestellungen · gesamt 30,00 €");
  });
  it("Einzahl bei genau einer Bestellung / einer Pizza", () => {
    const msg = formatDigest([mk({})], "Sa 12.07.");
    expect(msg).toContain("1 Bestellung · gesamt 10,00 €");
    expect(msg).toContain("1 Pizza · 10,00 € · Abholen");
  });
  it("Bestellblock: Zeit·Name·Telefon, Pizzenliste, Service-Label", () => {
    const msg = formatDigest([mk({
      pickupTime: "18:00", customerName: "Lisa Meyer", customerPhone: "+49 151 2345678",
      items: [{ pizzaName: "Funghi" }, { pizzaName: "Salami" }], total: 20, serviceMode: "dinein",
    })], "Sa 12.07.");
    expect(msg).toContain("18:00 · Lisa Meyer · +49 151 2345678");
    expect(msg).toContain("2 Pizzen · 20,00 € · Vor Ort");
    expect(msg).toContain("• Funghi");
    expect(msg).toContain("• Salami");
  });
  it("Notiz nur wenn vorhanden", () => {
    expect(formatDigest([mk({ notes: "extra scharf" })], "Sa 12.07.")).toContain("Notiz: extra scharf");
    expect(formatDigest([mk({ notes: "" })], "Sa 12.07.")).not.toContain("Notiz:");
  });
});

const ingNames = { i_sal: "Salami", i_mush: "Champignons", i_pap: "Paprika" };
const sauNames = { s_tom: "Tomate", s_bbq: "BBQ" };

describe("formatPrepList", () => {
  it("leeres Array → leerer String", () => {
    expect(formatPrepList([], ingNames, sauNames, "Fr 13.07.")).toBe("");
  });
  it("aggregiert Zutaten/Soßen und zählt Teige", () => {
    const orders: PrepOrder[] = [
      { items: [ { ingredientIds: ["i_sal", "i_mush"], sauceId: "s_tom" }, { ingredientIds: ["i_sal"], sauceId: "s_bbq" } ] },
      { items: [ { ingredientIds: ["i_sal", "i_pap"], sauceId: "s_tom" } ] },
    ];
    const msg = formatPrepList(orders, ingNames, sauNames, "Fr 13.07.");
    expect(msg).toContain("🧾 Einkauf/Vorbereitung für morgen, Fr 13.07.");
    expect(msg).toContain("3 Pizzen (= 3 Teige)");
    expect(msg).toContain("3× Salami");
    expect(msg).toContain("1× Champignons");
    expect(msg).toContain("1× Paprika");
    expect(msg).toContain("2× Tomate");
    expect(msg).toContain("1× BBQ");
  });
  it("Sortierung: Menge desc, dann Name asc; leerer Soßen-Abschnitt weggelassen", () => {
    const orders: PrepOrder[] = [
      { items: [ { ingredientIds: ["i_pap", "i_mush"] }, { ingredientIds: ["i_mush"] } ] },
    ];
    const msg = formatPrepList(orders, ingNames, sauNames, "Fr 13.07.");
    expect(msg.indexOf("Champignons")).toBeLessThan(msg.indexOf("Paprika"));
    expect(msg).not.toContain("Soßen:");
  });
  it("unbekannte id → Fallback auf die id", () => {
    const orders: PrepOrder[] = [{ items: [{ ingredientIds: ["i_unknown"] }] }];
    expect(formatPrepList(orders, ingNames, sauNames, "Fr 13.07.")).toContain("1× i_unknown");
  });
  it("Einzahl bei genau einer Pizza", () => {
    const orders: PrepOrder[] = [{ items: [{ ingredientIds: ["i_sal"], sauceId: "s_tom" }] }];
    expect(formatPrepList(orders, ingNames, sauNames, "Fr 13.07.")).toContain("1 Pizza (= 1 Teig)");
  });
});
