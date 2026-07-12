import type React from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { motion } from "motion/react";
import { BarChart2, Calendar, Clock, Timer, Package, Droplet, Tag, Users, ChefHat, LogOut, Store, User, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

// Admin-Layout mit Tab-Navigation. Portiert aus App.tsx:1179-1223,
// Navigation via react-router NavLink; Vorlaufzeit-Tab neu ergänzt.
const NAV: Array<{ to: string; icon: React.ElementType; label: string }> = [
  { to: "/admin/bestellungen",    icon: ClipboardList, label: "Bestellungen"  },
  { to: "/admin/dashboard",       icon: BarChart2, label: "Dashboard"      },
  { to: "/admin/tage",            icon: Calendar,  label: "Bestelltage"    },
  { to: "/admin/oeffnungszeiten", icon: Clock,     label: "Öffnungszeiten" },
  { to: "/admin/vorlaufzeit",     icon: Timer,     label: "Vorlaufzeit"    },
  { to: "/admin/service",         icon: Store,     label: "Service"       },
  { to: "/admin/zutaten",         icon: Package,   label: "Zutaten"        },
  { to: "/admin/sossen",          icon: Droplet,   label: "Soßen"          },
  { to: "/admin/gutscheine",      icon: Tag,       label: "Gutscheine"     },
  { to: "/admin/nutzer",          icon: Users,     label: "Nutzer"         },
];

export default function AdminLayout(): React.ReactElement {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat size={16} className="text-primary" />
          <span className="font-black text-sm">Pizza Admin</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate("/profil")} className="text-xs text-muted-foreground gap-1.5 h-7">
            <User size={11} /> {currentUser?.email}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-muted-foreground gap-1.5 h-7">
            <LogOut size={11} /> Abmelden
          </Button>
        </div>
      </header>
      <div className="sticky top-[49px] z-40 bg-sidebar border-b border-sidebar-border overflow-x-auto">
        <div className="flex gap-0.5 px-2 py-1.5 min-w-max">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap",
                isActive ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
              )}>
              <Icon size={11} /> {label}
            </NavLink>
          ))}
        </div>
      </div>
      <main className="flex-1 overflow-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
