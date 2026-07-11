import type React from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { redirectFor, type GuardKind } from "@/lib/auth";

function Guard({ kind, children }: { kind: GuardKind; children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lädt…</div>;
  const to = redirectFor(currentUser, kind);
  return to ? <Navigate to={to} replace /> : <>{children}</>;
}

export const RequireAuth = ({ children }: { children: React.ReactNode }) => <Guard kind="auth">{children}</Guard>;
export const RequireCustomer = ({ children }: { children: React.ReactNode }) => <Guard kind="customer">{children}</Guard>;
export const RequireAdmin = ({ children }: { children: React.ReactNode }) => <Guard kind="admin">{children}</Guard>;
