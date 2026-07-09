import type React from "react";
import { Outlet } from "react-router";
import { BottomNav } from "./bottom-nav";

// Kunden-Layout: Seiteninhalt + untere Tab-Leiste.
export default function AppLayout(): React.ReactElement {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
}
