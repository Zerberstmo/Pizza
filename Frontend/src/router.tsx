import { createBrowserRouter } from "react-router";
import AppLayout from "@/components/layout/app-layout";
import AdminLayout from "@/components/layout/admin-shell";
import MenuPage from "@/pages/menu/menu-page";
import ConfiguratorPage from "@/pages/configurator/configurator-page";
import CheckoutPage from "@/pages/checkout/checkout-page";
import ConfirmationPage from "@/pages/confirmation/confirmation-page";
import AdminLoginPage from "@/pages/admin/login-page";
import DashboardPage from "@/pages/admin/dashboard-page";
import DaysPage from "@/pages/admin/days-page";
import HoursPage from "@/pages/admin/hours-page";
import LeadTimePage from "@/pages/admin/lead-time-page";
import IngredientsPage from "@/pages/admin/ingredients-page";
import SaucesPage from "@/pages/admin/sauces-page";
import VouchersPage from "@/pages/admin/vouchers-page";
import ServicePage from "@/pages/admin/service-page";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <MenuPage /> },
      { path: "/konfigurator", element: <ConfiguratorPage /> },
      { path: "/warenkorb", element: <CheckoutPage /> },
      { path: "/bestaetigung", element: <ConfirmationPage /> },
    ],
  },
  { path: "/admin", element: <AdminLoginPage /> },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { path: "dashboard", element: <DashboardPage /> },
      { path: "tage", element: <DaysPage /> },
      { path: "oeffnungszeiten", element: <HoursPage /> },
      { path: "vorlaufzeit", element: <LeadTimePage /> },
      { path: "service", element: <ServicePage /> },
      { path: "zutaten", element: <IngredientsPage /> },
      { path: "sossen", element: <SaucesPage /> },
      { path: "gutscheine", element: <VouchersPage /> },
    ],
  },
]);
