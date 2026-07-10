import { describe, it, expect, beforeEach } from "bun:test";
import { getUsers, saveUsers, verifyLogin } from "@/lib/data/store";
import type { User } from "@/types";

beforeEach(() => localStorage.clear());

const mo: User = { id: "u1", username: "Mo", password: "pizza", firstName: "Mo", lastName: "", phone: "", role: "admin", active: true };

describe("users store", () => {
  it("getUsers returns seed by default", async () => {
    expect((await getUsers())[0].username).toBe("Mo");
  });
  it("verifyLogin: korrekt → User", async () => {
    expect((await verifyLogin("Mo", "pizza"))?.username).toBe("Mo");
  });
  it("verifyLogin: falsches Passwort → null", async () => {
    expect(await verifyLogin("Mo", "falsch")).toBeNull();
  });
  it("verifyLogin: unbekannter Benutzer → null", async () => {
    expect(await verifyLogin("Nöö", "pizza")).toBeNull();
  });
  it("verifyLogin: inaktiver Nutzer → null", async () => {
    await saveUsers([{ ...mo, active: false }]);
    expect(await verifyLogin("Mo", "pizza")).toBeNull();
  });
});
