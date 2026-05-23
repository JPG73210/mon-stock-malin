import { createFileRoute, Link } from "@tanstack/react-router";
import { Beef, Wine, Search, Trash2, PackagePlus, Printer, Loader2, Pencil, Check, X, ArrowLeftRight, Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSelection } from "@/hooks/use-selection";

export const Route = createFileRoute("/_authed/")({
  component: Dashboard,
});

function PrinterStatus() {
  const { user } = useAuth();
  const [starting, setStarting] = useState(false);
  const { data, refetch } = useQuery({
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

  const handleStartAgent = async () => {
    if (online || starting) return;
    setStarting(true);
    try {
      await fetch("https://serpolet.eu/api/webhook/start_print_agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      setTimeout(() => { refetch(); setStarting(false); }, 5000);
    } catch { setStarting(false); }
  };

  return (
    <button
      onClick={handleStartAgent}
      disabled={online || starting}
      className={cn(
        "flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm shadow-sm transition",
        !online && !starting && "cursor-pointer hover:bg-secondary/60 active:scale-95"
      )}
      title={online ? "Imprimante en ligne" : "Cliquer pour démarrer l'agent d'impression"}
    >
      {starting ? (
        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
      ) : (
        <Printer className={cn("h-4 w-4", online ? "text-green-600" : "text-red-600")} />
      )}
      <span className={cn("h-2 w-2 rounded-full", online ? "bg-green-500" : "bg-red-500")} />
      <span className="text-muted-foreground">
        {starting ? "Démarrage en cours…" : online ? `Imprimante en ligne${data?.printer_ip ? ` · ${data.printer_ip}` : ""}` : "Imprimante hors ligne"}
      </span>
    </button>
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

function EditableTitle() {
  const [title, setTitle] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem("dashboard-title") || "Bonjour 👋" : "Bonjour 👋"
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  const save = () => {
    const v = draft.trim() || "Bonjour 👋";
    setTitle(v);
    localStorage.setItem("dashboard-title", v);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(title); setEditing(false); } }}
          className="text-3xl font-bold h-auto py-1"
        />
        <Button size="icon" variant="ghost" onClick={save}><Check className="h-5 w-5" /></Button>
        <Button size="icon" variant="ghost" onClick={() => { setDraft(title); setEditing(false); }}><X className="h-5 w-5" /></Button>
      </div>
    );
  }
  return (
    <button onClick={() => { setDraft(title); setEditing(true); }} className="flex items-center gap-2 group">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
    </button>
  );
}

function SelectedProductsCard() {
  const { ids, remove, clear } = useSelection();
  const { data: items = [] } = useQuery({
    queryKey: ["selected-products", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, code, produit, animal, fruit, quantite, emplacement").in("id", ids);
      return data ?? [];
    },
  });
  if (ids.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold">Produits sélectionnés ({ids.length})</p>
        <Button size="sm" variant="ghost" onClick={clear}>Tout désélectionner</Button>
      </div>
      <div className="space-y-1">
        {items.map((p: any) => (
          <div key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted text-sm">
            <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
            <span className="flex-1 truncate">{p.produit} {[p.animal, p.fruit].filter(Boolean).join(" / ") && `· ${[p.animal, p.fruit].filter(Boolean).join(" / ")}`}</span>
            <Badge variant="secondary">×{p.quantite}</Badge>
            <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><X className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ARacheterCard() {
  const { data: wines = [] } = useQuery({
    queryKey: ["a-racheter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wines")
        .select("id, chateau, type_vin, couleur, millesime, comme_racheter, favori")
        .is("deleted_at", null)
        .or("favori.eq.true,comme_racheter.eq.true");
      return data ?? [];
    },
  });
  if (wines.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="font-semibold mb-3 flex items-center gap-2"><Heart className="h-4 w-4 text-accent" /> À racheter ({wines.length})</p>
      <div className="space-y-1">
        {wines.map((w: any) => (
          <div key={w.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted text-sm">
            <span className="flex-1 truncate">{w.chateau || "(sans nom)"} {w.millesime && `· ${w.millesime}`}</span>
            <Badge variant="outline" className="text-xs">{w.type_vin} {w.couleur}</Badge>
            {w.comme_racheter && <Badge variant="secondary" className="text-xs">comme</Badge>}
          </div>
        ))}
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
      const since30 = new Date(); since30.setDate(since30.getDate() - 30);
      const [p, w, t, wc, mov] = await Promise.all([
        supabase.from("products").select("produit, animal, quantite").is("deleted_at", null),
        supabase.from("wines").select("couleur, quantite").is("deleted_at", null),
        supabase.from("products").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
        supabase.from("wines").select("id", { count: "exact", head: true }).not("deleted_at", "is", null),
        supabase.from("stock_movements").select("delta").lt("delta", 0).gte("created_at", since30.toISOString()),
      ]);
      const productRows = p.data ?? [];
      const wineRows = w.data ?? [];
      const products = productRows.reduce((s, r: any) => s + (r.quantite ?? 0), 0);
      const wines = wineRows.reduce((s, r: any) => s + (r.quantite ?? 0), 0);
      const sortiesMois = (mov.data ?? []).reduce((s: number, r: any) => s + Math.abs(r.delta), 0);

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
        sortiesMois, rouge, blanc, rose, saucissonCerf, saucissonPorc, bourguignon,
      };
    },
  });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <EditableTitle />
          <p className="text-muted-foreground">Vue d'ensemble de votre stock.</p>
        </div>
        <PrinterStatus />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Produits en stock" value={data?.products} icon={Beef} />
        <StatCard label="Bouteilles en cave" value={data?.wines} icon={Wine} />
        <StatCard label="Sorties (30 j)" value={data?.sortiesMois} icon={ArrowLeftRight} />
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

      <ARacheterCard />
      <SelectedProductsCard />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/stock" className="rounded-xl border bg-card hover:bg-secondary/60 p-6 flex items-center gap-4 transition">
          <Beef className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold">Voir le stock complet</p>
            <p className="text-sm text-muted-foreground">Tous les produits et vins</p>
          </div>
        </Link>
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
            <p className="font-semibold">Rechercher</p>
            <p className="text-sm text-muted-foreground">Scanner QR codes &amp; codes-barres</p>
          </div>
        </Link>
        <Link to="/sorties" className="rounded-xl border bg-card hover:bg-secondary/60 p-6 flex items-center gap-4 transition">
          <ArrowLeftRight className="h-8 w-8 text-primary" />
          <div>
            <p className="font-semibold">Sorties de stock</p>
            <p className="text-sm text-muted-foreground">Historique &amp; restauration</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
