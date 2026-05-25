import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Beef, Wine, Search, Trash2, LayoutDashboard, PackagePlus, LogOut, Menu, X, Upload,
  Printer, Tags, Save, ClipboardList, ArrowLeftRight, Wrench, ChevronDown, Database,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/stock", label: "Stock", icon: Beef },
  { to: "/entree", label: "Entrée Viande/Légumes", icon: PackagePlus },
  { to: "/vin", label: "Entrée Vin", icon: Wine },
  { to: "/inventaire", label: "Inventaire", icon: ClipboardList },
  { to: "/sorties", label: "Sorties de stock", icon: ArrowLeftRight },
] as const;

const OUTILS = [
  { to: "/recherche", label: "Recherche", icon: Search },
  { to: "/etiquettes", label: "Modèles d'étiquettes", icon: Tags },
  { to: "/impression", label: "Historique des impressions", icon: Printer },
  { to: "/donnees", label: "Données", icon: Database },
  { to: "/import", label: "Import CSV", icon: Upload },
  { to: "/sauvegarde", label: "Sauvegarde", icon: Save },
  { to: "/corbeille", label: "Corbeille", icon: Trash2 },
] as const;

export function AppShell() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const outilsActive = OUTILS.some((o) => loc.pathname === o.to);
  const [outilsOpen, setOutilsOpen] = useState(outilsActive);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <header className="md:hidden flex items-center justify-between p-3 border-b">
        <span className="font-bold text-lg">Stock JP/JC</span>
        <Button size="icon" variant="ghost" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
      </header>

      <aside className={cn(
        "md:w-64 md:flex md:flex-col bg-sidebar border-r border-sidebar-border",
        open ? "flex flex-col" : "hidden md:flex"
      )}>
        <div className="hidden md:block px-5 py-5 border-b border-sidebar-border">
          <h1 className="font-bold text-lg text-sidebar-foreground">Stock JP/JC</h1>
          <p className="text-xs text-muted-foreground">Gestion congélateurs &amp; cave</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setOutilsOpen((v) => !v)}
            className={cn(
              "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              outilsActive
                ? "text-sidebar-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <Wrench className="h-4 w-4" />
            <span className="flex-1 text-left">Outils</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", outilsOpen && "rotate-180")} />
          </button>
          {outilsOpen && (
            <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-2">
              {OUTILS.map(({ to, label, icon: Icon }) => {
                const active = loc.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={async () => { await signOut(); nav({ to: "/auth" }); }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
