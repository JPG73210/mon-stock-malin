import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import {
  Beef, Wine, Search, Trash2, PackagePlus,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-muted-foreground">Chargement…</div>;
  if (!user) return <Navigate to="/auth" />;
  return <AppShell />;
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

export function DashboardHome() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [p, w, t, wc] = await Promise.all([
        supabase.from("products").select("quantite", { count: "exact" }).is("deleted_at", null),
        supabase.from("wines").select("quantite", { count: "exact" }).is("deleted_at", null),
        supabase.from("products").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
        supabase.from("wines").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
      ]);
      const productsQty = (p.data ?? []).reduce((s, r: any) => s + (r.quantite ?? 0), 0);
      const winesQty = (w.data ?? []).reduce((s, r: any) => s + (r.quantite ?? 0), 0);
      return {
        products: productsQty,
        wines: winesQty,
        trashed: (t.count ?? 0) + (wc.count ?? 0),
      };
    },
  });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">Bonjour 👋</h1>
        <p className="text-muted-foreground">Vue d'ensemble de votre stock.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Produits en stock" value={data?.products} icon={Beef} />
        <StatCard label="Bouteilles en cave" value={data?.wines} icon={Wine} />
        <StatCard label="Dans la corbeille" value={data?.trashed} icon={Trash2} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/entree" className="rounded-xl border bg-card hover:bg-accent/5 p-6 flex items-center gap-4 transition">
          <PackagePlus className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold">Ajouter un produit</p>
            <p className="text-sm text-muted-foreground">Viande, légumes, poisson… avec QR code &amp; étiquette</p>
          </div>
        </Link>
        <Link to="/vin" className="rounded-xl border bg-card hover:bg-accent/5 p-6 flex items-center gap-4 transition">
          <Wine className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold">Ajouter un vin</p>
            <p className="text-sm text-muted-foreground">Photo, code-barres, millésime</p>
          </div>
        </Link>
        <Link to="/recherche" className="rounded-xl border bg-card hover:bg-accent/5 p-6 flex items-center gap-4 transition">
          <Search className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold">Rechercher / Inventaire</p>
            <p className="text-sm text-muted-foreground">Scanner QR codes &amp; codes-barres</p>
          </div>
        </Link>
        <Link to="/stock" className="rounded-xl border bg-card hover:bg-accent/5 p-6 flex items-center gap-4 transition">
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
