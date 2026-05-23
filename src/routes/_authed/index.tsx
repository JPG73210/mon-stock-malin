import { createFileRoute, Link } from "@tanstack/react-router";
import { Beef, Wine, Search, Trash2, PackagePlus, Printer, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/")({
  component: Dashboard,
});

function PrinterStatus() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["agent-status", user?.id],
    enabled: !!user,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_status")
        .select("status, last_seen, printer_ip")
        .eq("id", "print-agent")
        .maybeSingle();
      return data;
    },
  });

  const ageSec = data?.last_seen
    ? (Date.now() - new Date(data.last_seen).getTime()) / 1000
    : Infinity;
  const online = data?.status === "online" && ageSec < 60;

  return (
    <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm shadow-sm">
      <Printer className={cn("h-4 w-4", online ? "text-green-600" : "text-red-600")} />
      <span className={cn("h-2 w-2 rounded-full", online ? "bg-green-500" : "bg-red-500")} />
      <span className="text-muted-foreground">
        {online
          ? `Imprimante en ligne${data?.printer_ip ? ` · ${data.printer_ip}` : ""}`
          : "Imprimante hors ligne"}
      </span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: any) {
  return (
    <div className="rounded-xl border bg-card p-5 flex items-center gap-4 shadow-sm">
      <div className="rounded-lg bg-primary/10 text-primary p-3"><Icon className="h-6 w-6" /></div>
      <div>
        <p className="text-2xl font-bold">{value ?? "—"}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [p, w, t, wc] = await Promise.all([
        supabase.from("products").select("produit, animal, quantite").is("deleted_at", null),
        supabase.from("wines").select("couleur, quantite").is("deleted_at", null),
        supabase.from("products").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
        supabase.from("wines").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
      ]);
      const productRows = p.data ?? [];
      const wineRows = w.data ?? [];
      const products = productRows.reduce((s, r: any) => s + (r.quantite ?? 0), 0);
      const wines = wineRows.reduce((s, r: any) => s + (r.quantite ?? 0), 0);

      const rouge = wineRows.filter((r: any) => r.couleur === "Rouge").reduce((s, r: any) => s + (r.quantite ?? 0), 0);
      const blanc = wineRows.filter((r: any) => r.couleur === "Blanc").reduce((s, r: any) => s + (r.quantite ?? 0), 0);
      const rose = wineRows.filter((r: any) => r.couleur === "Rosé").reduce((s, r: any) => s + (r.quantite ?? 0), 0);

      const saucissonCerf = productRows.filter((r: any) =>
        r.produit?.toLowerCase().includes("saucisson") && r.animal?.toLowerCase().includes("cerf")
      ).reduce((s, r: any) => s + (r.quantite ?? 0), 0);
      const saucissonPorc = productRows.filter((r: any) =>
        r.produit?.toLowerCase().includes("saucisson") && r.animal?.toLowerCase().includes("porc")
      ).reduce((s, r: any) => s + (r.quantite ?? 0), 0);
      const bourguignon = productRows.filter((r: any) =>
        r.produit?.toLowerCase().includes("bourguignon")
      ).reduce((s, r: any) => s + (r.quantite ?? 0), 0);

      return {
        products, wines, trashed: (t.count ?? 0) + (wc.count ?? 0),
        rouge, blanc, rose, saucissonCerf, saucissonPorc, bourguignon,
      };
    },
  });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Bonjour 👋</h1>
          <p className="text-muted-foreground">Vue d'ensemble de votre stock.</p>
        </div>
        <PrinterStatus />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Produits en stock" value={data?.products} icon={Beef} />
        <StatCard label="Bouteilles en cave" value={data?.wines} icon={Wine} />
        <StatCard label="Dans la corbeille" value={data?.trashed} icon={Trash2} />
      </div>
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Vins par couleur</h2>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Rouge" value={data?.rouge} icon={Wine} />
            <StatCard label="Blanc" value={data?.blanc} icon={Wine} />
            <StatCard label="Rosé" value={data?.rose} icon={Wine} />
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Produits par type</h2>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Saucisson cerf" value={data?.saucissonCerf} icon={Beef} />
            <StatCard label="Saucisson porc" value={data?.saucissonPorc} icon={Beef} />
            <StatCard label="Bourguignon" value={data?.bourguignon} icon={Beef} />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/entree" className="rounded-xl border bg-card hover:bg-secondary/60 p-6 flex items-center gap-4 transition">
          <PackagePlus className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold">Ajouter un produit</p>
            <p className="text-sm text-muted-foreground">Viande, légumes, poisson…</p>
          </div>
        </Link>
        <Link to="/vin" className="rounded-xl border bg-card hover:bg-secondary/60 p-6 flex items-center gap-4 transition">
          <Wine className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold">Ajouter un vin</p>
            <p className="text-sm text-muted-foreground">Photo, code-barres, millésime</p>
          </div>
        </Link>
        <Link to="/recherche" className="rounded-xl border bg-card hover:bg-secondary/60 p-6 flex items-center gap-4 transition">
          <Search className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold">Rechercher / Inventaire</p>
            <p className="text-sm text-muted-foreground">Scanner QR codes &amp; codes-barres</p>
          </div>
        </Link>
        <Link to="/stock" className="rounded-xl border bg-card hover:bg-secondary/60 p-6 flex items-center gap-4 transition">
          <Beef className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold">Voir le stock complet</p>
            <p className="text-sm text-muted-foreground">Tous les produits et vins</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
