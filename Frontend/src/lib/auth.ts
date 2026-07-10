import type { User } from "@/types";

export function usernameTaken(users: User[], username: string): boolean {
  return users.some((u) => u.username === username);
}

export type GuardKind = "auth" | "customer" | "admin";

// Liefert den Ziel-Pfad für einen Redirect oder null, wenn der Zugriff erlaubt ist.
export function redirectFor(user: User | null, kind: GuardKind): string | null {
  if (!user) return "/login";
  if (kind === "admin" && user.role !== "admin") return "/";
  if (kind === "customer" && user.role !== "customer") return "/admin/dashboard";
  return null;
}
