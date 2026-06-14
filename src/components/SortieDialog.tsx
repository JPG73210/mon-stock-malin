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
import { Camera, X, ScanLine, QrCode as QrIcon, Barcode, Search } from "lucide-react";

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
  const [scanning, setScanning] = useState<"qr" | "barcode" | null>(null);
  const [extra, setExtra] = useState<Product[]>([]);
  const [manualInput, setManualInput] = useState("");
  const [searching, setSearching] = useState(false);

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

  function addProduct(p: Product) {
    if (allItems.some((x) => x.id === p.id)) {
      toast.info(`Déjà dans la liste : ${p.code}`);
      return;
    }
    setExtra((prev) => [...prev, p]);
    setQtys((prev) => ({ ...prev, [p.id]: Math.min(1, p.quantite) }));
    toast.success(`Ajouté : ${p.produit}`);
  }

  async function handleScan(text: string) {
    let code = text.trim();
    try {
      const parsed = JSON.parse(text);
      if (parsed?.id) code = String(parsed.id);
    } catch { /* raw text */ }
    if (code.includes("|")) code = code.split("|")[0].trim();
    const legacy = code.toUpperCase().match(/[A-Z]{2}\d{4}/);
    if (legacy) code = legacy[0];

    const tries = Array.from(new Set([code, code.toUpperCase(), code.toLowerCase()]));
    for (const c of tries) {
      const { data } = await supabase
        .from("products").select("id, code, produit, animal, fruit, quantite")
        .eq("code", c).is("deleted_at", null).maybeSingle();
      if (data) { addProduct(data as Product); return; }
    }
    toast.error(`Produit ${code} introuvable`);
  }

  async function handleManualSearch() {
    const term = manualInput.trim();
    if (!term) return;
    setSearching(true);
    try {
      // First try exact code match (douchette)
      const tries = Array.from(new Set([term, term.toUpperCase(), term.toLowerCase()]));
      for (const c of tries) {
        const { data } = await supabase
          .from("products").select("id, code, produit, animal, fruit, quantite")
          .eq("code", c).is("deleted_at", null).maybeSingle();
        if (data) { addProduct(data as Product); setManualInput(""); return; }
      }
      // Fallback: text search
      const like = `%${term}%`;
      const { data: matches } = await supabase
        .from("products").select("id, code, produit, animal, fruit, quantite")
        .is("deleted_at", null).gt("quantite", 0)
        .or(`produit.ilike.${like},animal.ilike.${like},fruit.ilike.${like},code.ilike.${like}`)
        .order("produit", { ascending: true }).limit(10);
      if (!matches || matches.length === 0) {
        toast.error(`Aucun résultat pour : ${term}`);
        return;
      }
      if (matches.length === 1) {
        addProduct(matches[0] as Product);
        setManualInput("");
        return;
      }
      for (const m of matches) addProduct(m as Product);
      toast.success(`${matches.length} produit(s) ajouté(s)`);
      setManualInput("");
    } finally {
      setSearching(false);
    }
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
          reason: "out",
          note: reason.trim() || "Sortie manuelle",
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge variant="secondary">{allItems.length} produit(s)</Badge>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={scanning === "qr" ? "default" : "outline"}
                onClick={() => setScanning(scanning === "qr" ? null : "qr")}
              >
                {scanning === "qr" ? <X className="mr-1 h-4 w-4" /> : <QrIcon className="mr-1 h-4 w-4" />}
                QR
              </Button>
              <Button
                size="sm"
                variant={scanning === "barcode" ? "default" : "outline"}
                onClick={() => setScanning(scanning === "barcode" ? null : "barcode")}
              >
                {scanning === "barcode" ? <X className="mr-1 h-4 w-4" /> : <Barcode className="mr-1 h-4 w-4" />}
                Code-barres
              </Button>
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); handleManualSearch(); }}
            className="flex gap-2"
          >
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Douchette ou recherche (ID, produit, animal…)"
              autoFocus
            />
            <Button type="submit" size="sm" disabled={searching || !manualInput.trim()}>
              <Search className="h-4 w-4" />
            </Button>
          </form>

          {scanning && (
            <div className="rounded-md border p-2">
              <CameraScanner formats={scanning} continuous onScan={handleScan} />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Camera className="h-3 w-3" />
                {scanning === "qr" ? "Scannez un QR pour ajouter le produit." : "Scannez un code-barres pour ajouter le produit."}
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
