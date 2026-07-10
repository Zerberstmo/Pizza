import { describe, it, expect } from "bun:test";
import { usernameTaken, redirectFor } from "@/lib/auth";
import type { User } from "@/types";

const admin: User = { id: "1", username: "Mo", password: "p", firstName: "", lastName: "", phone: "", role: "admin", active: true };
const cust: User  = { id: "2", username: "Kim", password: "p", firstName: "", lastName: "", phone: "", role: "customer", active: true };

describe("usernameTaken", () => {
  it("erkennt vergebenen Namen", () => expect(usernameTaken([admin], "Mo")).toBe(true));
  it("freier Name", () => expect(usernameTaken([admin], "Kim")).toBe(false));
});

describe("redirectFor", () => {
  it("nicht eingeloggt → /login", () => {
    expect(redirectFor(null, "auth")).toBe("/login");
    expect(redirectFor(null, "customer")).toBe("/login");
    expect(redirectFor(null, "admin")).toBe("/login");
  });
  it("customer darf Kundenbereich, nicht Admin", () => {
    expect(redirectFor(cust, "customer")).toBeNull();
    expect(redirectFor(cust, "admin")).toBe("/");
    expect(redirectFor(cust, "auth")).toBeNull();
  });
  it("admin darf Adminbereich, nicht Kundenbereich", () => {
    expect(redirectFor(admin, "admin")).toBeNull();
    expect(redirectFor(admin, "customer")).toBe("/admin/dashboard");
    expect(redirectFor(admin, "auth")).toBeNull();
  });
});
