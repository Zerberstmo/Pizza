import { describe, it, expect } from "bun:test";
import { cn } from "@/lib/utils";
describe("scaffold", () => {
  it("cn merges classes", () => { expect(cn("a", "b")).toBe("a b"); });
});
