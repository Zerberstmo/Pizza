import type React from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { motion } from "motion/react";
import { BarChart2, Calendar, Clock, Timer, Package, Droplet, Tag, Users, ChefHat, LogOut, Store, User, ClipboardList, MessageSquare, Settings, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

// Admin-Layout. Handy: obere Kopfzeile + scrollende Tab-Leiste (unverändert).
// Desktop (lg+): feste linke Seitenleiste statt Tab-Leiste (Phase 1).
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
  { to: "/admin/sonderartikel",   icon: Star,      label: "Sonderartikel"  },
  { to: "/admin/nutzer",          icon: Users,     label: "Nutzer"         },
  { to: "/admin/benachrichtigungen", icon: MessageSquare, label: "Benachrichtigungen" },
  { to: "/admin/einstellungen",   icon: Settings,  label: "Einstellungen"  },
];

export default function AdminLayout(): React.ReactElement {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="lg:flex min-h-screen bg-background">
      {/* Desktop-Seitenleiste (lg+) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-2 px-4 py-4 border-b border-sidebar-border shrink-0">
          <ChefHat size={18} className="text-primary" />
          <span className="font-black text-sm">Pizza Admin</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-semibold transition-all",
                isActive ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
              )}>
              <Icon size={15} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-sidebar-border space-y-0.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => navigate("/profil")}
            className="w-full justify-start text-xs text-muted-foreground gap-2 h-8 truncate">
            <User size={13} className="shrink-0" /> <span className="truncate">{currentUser?.email}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}
            className="w-full justify-start text-xs text-muted-foreground gap-2 h-8">
            <LogOut size={13} className="shrink-0" /> Abmelden
          </Button>
        </div>
      </aside>

      {/* Rechte Spalte / Handy-Layout */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Handy-Kopfzeile (unter lg) */}
        <header className="lg:hidden sticky top-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat size={16} className="text-primary" />
            <span className="font-black text-sm">Pizza Admin</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <Button variant="ghost" size="sm" onClick={() => navigate("/profil")} className="text-xs text-muted-foreground gap-1.5 h-7 max-w-[45vw] min-w-0 truncate">
              <User size={11} className="shrink-0" /> {currentUser?.email}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-muted-foreground gap-1.5 h-7">
              <LogOut size={11} /> Abmelden
            </Button>
          </div>
        </header>
        {/* Handy-Tab-Leiste (unter lg) */}
        <div className="lg:hidden sticky top-[49px] z-40 bg-sidebar border-b border-sidebar-border overflow-x-auto">
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
        {/* Inhalt */}
        <main className="flex-1 overflow-auto">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
            <div className="w-full">
              <Outlet />
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
