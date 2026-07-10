import { describe, it, expect, beforeEach } from "bun:test";
import { getIngredients, saveConfig, getConfig, createOrder, getSauces } from "@/lib/data/store";

beforeEach(() => localStorage.clear());

describe("data store", () => {
  it("getIngredients returns seed by default", async () => {
    expect((await getIngredients()).length).toBeGreaterThan(0);
  });
  it("getSauces returns seed by default", async () => {
    const sauces = await getSauces();
    expect(sauces[0].id).toBe("tomate");
  });
  it("saveConfig persists and getConfig reads back", async () => {
    await saveConfig({ days: { Montag: true }, hours: { from: "10:00", to: "12:00" }, leadTimeDays: 5, service: { dineIn: false, takeaway: true } });
    expect((await getConfig()).leadTimeDays).toBe(5);
  });
  it("createOrder returns order with id and computed totals", async () => {
    const order = await createOrder({
      items: [{ cartId: "a", pizzaName: "Margherita", ingredientIds: [] }],
      customer: { firstName: "Max", lastName: "M", phone: "1" },
      notes: "", pickupDate: "2026-07-12", pickupTime: "18:00", serviceMode: "takeaway",
    });
    expect(order.id).toMatch(/^#/);
    expect(order.total).toBe(10);
  });
});
