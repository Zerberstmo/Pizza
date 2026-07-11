import type { User } from "@/types";

export function emailTaken(users: User[], email: string): boolean {
  return users.some((u) => u.email.toLowerCase() === email.toLowerCase());
}

export type GuardKind = "auth" | "customer" | "admin";

// Liefert den Ziel-Pfad für einen Redirect oder null, wenn der Zugriff erlaubt ist.
export function redirectFor(user: User | null, kind: GuardKind): string | null {
  if (!user) return "/login";
  if (kind === "admin" && user.role !== "admin") return "/";
  if (kind === "customer" && user.role !== "customer") return "/admin/dashboard";
  return null;
}
