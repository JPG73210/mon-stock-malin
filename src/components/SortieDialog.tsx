import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Camera, X, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { CameraScanner } from "@/components/CameraScanner";

type Product = {
  id: string;
  code: string;
  produit: string;
  animal: string | null;
  fruit: string | null;
  quantite: number;
};

export function SortieDialog({
  open, onClose, products, onDone,
}: {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("Sortie manuelle");
  const [scanning, setScanning] = useState(false);
  const [extra, setExtra] = useState<Product[]>([]);

  // Init quantities (default = 1, capped to stock)
  useEffect(() => {
    if (!open) return;
    setQtys((prev) => {
      const next = { ...prev };
      for (const p of products) {
        if (next[p.id] === undefined) next[p.id] = Math.min(1, p.quantite);
      }
      return next;
    });
  }, [open, products]);

  const allItems = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    for (const p of extra) if (!map.has(p.id)) map.set(p.id, p);
    return Array.from(map.values());
  }, [products, extra]);

  async function handleScan(text: string) {
    let code = text.trim();
    try {
      const parsed = JSON.parse(text);
      if (parsed?.id) code = String(parsed.id);
    } catch { /* raw text */ }
    if (allItems.some((p) => p.code === code)) {
      toast.info(`Déjà dans la liste : ${code}`);
      return;
    }
    const { data } = await supabase
      .from("products").select("id, code, produit, animal, fruit, quantite")
      .eq("code", code).is("deleted_at", null).maybeSingle();
    if (!data) {
      toast.error(`Produit ${code} introuvable`);
      return;
    }
    setExtra((prev) => [...prev, data as Product]);
    setQtys((prev) => ({ ...prev, [data.id]: Math.min(1, data.quantite) }));
    toast.success(`Ajouté : ${data.produit}`);
  }

  function removeItem(id: string) {
    setExtra((prev) => prev.filter((p) => p.id !== id));
    setQtys((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Non connecté");
      const items = allItems.filter((p) => (qtys[p.id] ?? 0) > 0);
      if (items.length === 0) throw new Error("Aucune sortie à enregistrer");

      for (const p of items) {
        const qty = Math.min(qtys[p.id] ?? 0, p.quantite);
        if (qty <= 0) continue;
        const newQty = p.quantite - qty;
        const update: any = { quantite: newQty };
        if (newQty <= 0) update.deleted_at = new Date().toISOString();
        const { error: upErr } = await supabase.from("products").update(update).eq("id", p.id);
        if (upErr) throw upErr;
        const { error: mvErr } = await supabase.from("stock_movements").insert({
          user_id: userId,
          kind: "product",
          item_id: p.id,
          label: [p.produit, p.animal, p.fruit].filter(Boolean).join(" / "),
          code: p.code,
          delta: -qty,
          reason: reason.trim() || "Sortie manuelle",
        });
        if (mvErr) throw mvErr;
      }
      return items.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} sortie(s) enregistrée(s)`);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setExtra([]);
      onDone();
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sortie de stock</DialogTitle>
          <DialogDescription>
            Définissez la quantité à sortir pour chaque produit puis validez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{allItems.length} produit(s)</Badge>
            <Button size="sm" variant="outline" onClick={() => setScanning((s) => !s)}>
              {scanning ? <><X className="mr-1 h-4 w-4" />Fermer scanner</> : <><ScanLine className="mr-1 h-4 w-4" />Scanner QR</>}
            </Button>
          </div>

          {scanning && (
            <div className="rounded-md border p-2">
              <CameraScanner formats="qr" continuous onScan={handleScan} />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Camera className="h-3 w-3" /> Scannez un QR pour ajouter automatiquement le produit.
              </p>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto space-y-2 border rounded-md p-2">
            {allItems.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun produit. Scannez un QR ou sélectionnez des produits.
              </p>
            )}
            {allItems.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.produit}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.code} · stock : {p.quantite}
                  </p>
                </div>
                <Input
                  type="number" min={0} max={p.quantite}
                  value={qtys[p.id] ?? 0}
                  onChange={(e) => setQtys((prev) => ({
                    ...prev,
                    [p.id]: Math.max(0, Math.min(p.quantite, parseInt(e.target.value, 10) || 0)),
                  }))}
                  className="w-20 h-8"
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeItem(p.id)} title="Retirer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div>
            <Label className="text-xs">Motif</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vente, consommation, perte…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || allItems.length === 0}>
            Enregistrer la sortie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
