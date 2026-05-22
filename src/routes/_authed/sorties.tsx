import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/sorties")({ component: SortiesPage });

type Mvt = {
  id: string;
  kind: "product" | "wine";
  item_id: string;
  label: string | null;
  code: string | null;
  delta: number;
  reason: string;
  created_at: string;
};

function SortiesPage() {
  const [days, setDays] = useState<string>("30");
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["stock-movements", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*")
        .lt("delta", 0)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Mvt[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((m) =>
      (m.label ?? "").toLowerCase().includes(q) ||
      (m.code ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const totalOut = filtered.reduce((s, m) => s + Math.abs(m.delta), 0);

  function exportCsv() {
    const rows: string[][] = [["Date", "Type", "Code", "Libellé", "Quantité sortie", "Raison"]];
    for (const m of filtered) {
      rows.push([
        new Date(m.created_at).toLocaleString("fr-FR"),
        m.kind === "product" ? "Produit" : "Vin",
        m.code ?? "",
        m.label ?? "",
        String(Math.abs(m.delta)),
        m.reason,
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `sorties-${stamp}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Feuille des sorties exportée");
  }

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Sorties de stock</h1>
        <p className="text-sm text-muted-foreground">Historique des produits et vins sortis du stock.</p>
      </div>

      <div className="rounded-xl border bg-card p-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Période</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
                <SelectItem value="90">3 mois</SelectItem>
                <SelectItem value="365">1 an</SelectItem>
                <SelectItem value="3650">Tout</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Recherche</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Libellé ou code…" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-sm text-muted-foreground">
            {filtered.length} mouvement(s) — <span className="font-semibold text-foreground">{totalOut}</span> unité(s) sorties
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Exporter CSV
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3 space-y-1">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucune sortie sur cette période. Les sorties seront tracées à partir de maintenant.
          </p>
        )}
        {filtered.map((m) => (
          <div key={m.id} className="flex items-center gap-2 p-2 rounded border-b last:border-0">
            <Badge variant={m.kind === "wine" ? "secondary" : "default"} className="shrink-0">
              {m.kind === "wine" ? "Vin" : "Prod"}
            </Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.label || "(sans nom)"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {m.code} · {new Date(m.created_at).toLocaleString("fr-FR")}
              </p>
            </div>
            <Badge variant="destructive" className="shrink-0 font-mono">−{Math.abs(m.delta)}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
