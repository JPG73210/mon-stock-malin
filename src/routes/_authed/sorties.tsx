import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/sorties")({ component: SortiesPage });

type Mvt = {
  id: string; kind: "product" | "wine"; item_id: string;
  label: string | null; code: string | null; delta: number; reason: string; created_at: string;
};

function SortiesPage() {
  const qc = useQueryClient();
  const [days, setDays] = useState<string>("30");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [trashing, setTrashing] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["stock-movements", days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));
      const { data, error } = await supabase
        .from("stock_movements").select("*")
        .lt("delta", 0).gte("created_at", since.toISOString())
        .order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data ?? []) as Mvt[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((m) => (m.label ?? "").toLowerCase().includes(q) || (m.code ?? "").toLowerCase().includes(q));
  }, [data, search]);

  const totalOut = filtered.reduce((s, m) => s + Math.abs(m.delta), 0);
  const now = Date.now();
  const MS_30 = 30 * 24 * 3600 * 1000;
  function isRestorable(m: Mvt) {
    return now - new Date(m.created_at).getTime() <= MS_30;
  }

  function toggle(id: string) {
    setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const restore = useMutation({
    mutationFn: async () => {
      const items = filtered.filter((m) => checked.has(m.id) && isRestorable(m));
      if (items.length === 0) throw new Error("Rien à restaurer");
      for (const m of items) {
        const table = m.kind === "product" ? "products" : "wines";
        // récupère le produit (possiblement soft-deleted)
        const { data: row } = await supabase.from(table).select("id, quantite, deleted_at").eq("id", m.item_id).maybeSingle();
        if (!row) continue;
        const newQty = (row.quantite ?? 0) + Math.abs(m.delta);
        await supabase.from(table).update({ quantite: newQty, deleted_at: null }).eq("id", m.item_id);
        await supabase.from("stock_movements").delete().eq("id", m.id);
      }
      return items.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setChecked(new Set());
      toast.success(`${n} produit(s) restauré(s)`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const trash = useMutation({
    mutationFn: async () => {
      const ids = Array.from(checked);
      if (ids.length === 0) throw new Error("Rien à supprimer");
      const { error } = await supabase.from("stock_movements").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      setChecked(new Set());
      toast.success(`${n} mouvement(s) supprimé(s) définitivement`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  function exportCsv() {
    const rows: string[][] = [["Date", "Type", "Code", "Libellé", "Quantité sortie", "Raison"]];
    for (const m of filtered) rows.push([new Date(m.created_at).toLocaleString("fr-FR"), m.kind === "product" ? "Produit" : "Vin", m.code ?? "", m.label ?? "", String(Math.abs(m.delta)), m.reason]);
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sorties-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Sorties de stock</h1>
        <p className="text-sm text-muted-foreground">Historique des produits et vins sortis. Restauration possible pendant 30 jours.</p>
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
          <div className="flex gap-2">
            <Button size="sm" variant="default" disabled={checked.size === 0} onClick={() => setConfirming(true)}>
              <RotateCcw className="mr-1 h-4 w-4" /> Restaurer ({checked.size})
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="mr-1 h-4 w-4" /> Exporter CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3 space-y-1">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune sortie sur cette période.</p>
        )}
        {filtered.map((m) => {
          const restorable = isRestorable(m);
          return (
            <div key={m.id} className="flex items-center gap-2 p-2 rounded border-b last:border-0">
              <Checkbox checked={checked.has(m.id)} disabled={!restorable} onCheckedChange={() => toggle(m.id)} />
              <Badge variant={m.kind === "wine" ? "secondary" : "default"} className="shrink-0">{m.kind === "wine" ? "Vin" : "Prod"}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.label || "(sans nom)"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {m.code} · {new Date(m.created_at).toLocaleString("fr-FR")}
                  {!restorable && " · restauration expirée"}
                </p>
              </div>
              <Badge variant="destructive" className="shrink-0 font-mono">−{Math.abs(m.delta)}</Badge>
            </div>
          );
        })}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurer la sélection ?</AlertDialogTitle>
            <AlertDialogDescription>
              {checked.size} mouvement(s) seront annulés et les produits remis en stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirming(false); restore.mutate(); }}>Restaurer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
