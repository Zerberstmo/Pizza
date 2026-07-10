import { describe, it, expect, beforeEach } from "bun:test";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
beforeEach(() => localStorage.clear());

describe("useAuth", () => {
  it("startet ohne angemeldeten Nutzer", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentUser).toBeNull();
  });
  it("login mit Mo/pizza setzt currentUser + sessionStorage", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.login("Mo", "pizza"); });
    expect(result.current.currentUser?.username).toBe("Mo");
    expect(sessionStorage.getItem("pizza-auth")).toBe("u1");
  });
  it("logout löscht currentUser", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.login("Mo", "pizza"); });
    act(() => result.current.logout());
    expect(result.current.currentUser).toBeNull();
    expect(sessionStorage.getItem("pizza-auth")).toBeNull();
  });
  it("updateOwnProfile persistiert und lässt username/role unangetastet", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.login("Mo", "pizza"); });
    await act(async () => { await result.current.updateOwnProfile({ phone: "0123" }); });
    expect(result.current.currentUser?.phone).toBe("0123");
    expect(result.current.currentUser?.username).toBe("Mo");
    expect(result.current.currentUser?.role).toBe("admin");
    expect(localStorage.getItem("pizza-users")).toContain("0123");
  });
});
