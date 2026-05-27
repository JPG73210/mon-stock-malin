import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Beef, Wine, Search, Trash2, LayoutDashboard, PackagePlus, LogOut, Menu, X, Upload,
  Printer, Tags, Save, ClipboardList, ArrowLeftRight, Wrench, ChevronDown, Database,
  Pencil, Check, Moon, Sun, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme, getAppName, setAppName } from "@/hooks/use-theme";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/stock", label: "Stock", icon: Beef },
  { to: "/entree", label: "Terroirs, Saveurs & Traditions", icon: PackagePlus },
  { to: "/vin", label: "Saveurs de la Cave", icon: Wine },
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
  const { theme, toggle: toggleTheme } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const outilsActive = OUTILS.some((o) => loc.pathname === o.to);
  const [outilsOpen, setOutilsOpen] = useState(outilsActive);

  const [appName, setAppNameState] = useState(getAppName());
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(appName);

  useEffect(() => {
    const onChange = () => setAppNameState(getAppName());
    window.addEventListener("app-name-change", onChange);
    return () => window.removeEventListener("app-name-change", onChange);
  }, []);

  function saveName() {
    const v = draftName.trim() || "🌾🧀🍷 LES PRODUITS DU TERROIRS";
    setAppName(v);
    setAppNameState(v);
    setEditingName(false);
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <header className="md:hidden flex items-center justify-between p-3 border-b">
        <span className="font-bold text-lg">{appName}</span>
        <Button size="icon" variant="ghost" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
      </header>

      <aside className={cn(
        "md:w-64 md:flex md:flex-col bg-sidebar border-r border-sidebar-border",
        open ? "flex flex-col" : "hidden md:flex"
      )}>
        <div className="hidden md:block px-5 py-5 border-b border-sidebar-border">
          {editingName ? (
            <div className="flex gap-1">
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setDraftName(appName); setEditingName(false); } }}
                autoFocus
                className="h-8"
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveName}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="font-bold text-lg text-sidebar-foreground flex-1 truncate">{appName}</h1>
              <Button
                size="icon" variant="ghost" className="h-7 w-7 opacity-60 hover:opacity-100"
                onClick={() => { setDraftName(appName); setEditingName(true); }}
                title="Renommer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Gestion congélateurs &amp; cave</p>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
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
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
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
              <button
                type="button"
                onClick={toggleTheme}
                className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="flex-1 text-left">Thème {theme === "dark" ? "clair" : "sombre"}</span>
              </button>
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
