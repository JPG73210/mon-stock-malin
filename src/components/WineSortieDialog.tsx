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
import { Camera, X, QrCode as QrIcon, Barcode, Search } from "lucide-react";
import { toast } from "sonner";
import { CameraScanner } from "@/components/CameraScanner";

type Wine = {
  id: string;
  chateau: string | null;
  type_vin: string | null;
  couleur: string | null;
  millesime: number | null;
  code_barre: string | null;
  quantite: number;
};

export function WineSortieDialog({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState<Wine[]>([]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("Sortie manuelle");
  const [scanning, setScanning] = useState<"qr" | "barcode" | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setItems([]); setQtys({}); setScanning(null); setManualInput("");
    }
  }, [open]);

  function addWine(w: Wine) {
    if (items.some((x) => x.id === w.id)) {
      toast.info(`Déjà dans la liste : ${w.chateau ?? w.id}`);
      return;
    }
    setItems((prev) => [...prev, w]);
    setQtys((prev) => ({ ...prev, [w.id]: Math.min(1, w.quantite) }));
    toast.success(`Ajouté : ${w.chateau ?? "Vin"}`);
  }

  async function findAndAdd(raw: string) {
    let code = raw.trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.id) code = String(parsed.id);
    } catch { /* raw text */ }
    if (!code) return false;

    // 1) Try by id (UUID from QR)
    if (/^[0-9a-f-]{32,}$/i.test(code)) {
      const { data } = await supabase
        .from("wines").select("id, chateau, type_vin, couleur, millesime, code_barre, quantite")
        .eq("id", code).is("deleted_at", null).maybeSingle();
      if (data) { addWine(data as Wine); return true; }
    }
    // 2) Try by code_barre (exact, then trimmed variants)
    const tries = Array.from(new Set([code, code.replace(/\s+/g, ""), code.toUpperCase()]));
    for (const c of tries) {
      const { data } = await supabase
        .from("wines").select("id, chateau, type_vin, couleur, millesime, code_barre, quantite")
        .eq("code_barre", c).is("deleted_at", null).maybeSingle();
      if (data) { addWine(data as Wine); return true; }
    }
    return false;
  }

  async function handleScan(text: string) {
    const ok = await findAndAdd(text);
    if (!ok) toast.error(`Vin introuvable : ${text}`);
  }

  async function handleManualSearch() {
    const term = manualInput.trim();
    if (!term) return;
    setSearching(true);
    try {
      if (await findAndAdd(term)) { setManualInput(""); return; }
      const like = `%${term}%`;
      const { data: matches } = await supabase
        .from("wines").select("id, chateau, type_vin, couleur, millesime, code_barre, quantite")
        .is("deleted_at", null).gt("quantite", 0)
        .or(`chateau.ilike.${like},type_vin.ilike.${like},couleur.ilike.${like},code_barre.ilike.${like}`)
        .order("chateau", { ascending: true }).limit(10);
      if (!matches || matches.length === 0) {
        toast.error(`Aucun résultat pour : ${term}`);
        return;
      }
      if (matches.length === 1) { addWine(matches[0] as Wine); setManualInput(""); return; }
      for (const m of matches) addWine(m as Wine);
      setManualInput("");
    } finally {
      setSearching(false);
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setQtys((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error("Non connecté");
      const toSave = items.filter((w) => (qtys[w.id] ?? 0) > 0);
      if (toSave.length === 0) throw new Error("Aucune sortie à enregistrer");

      for (const w of toSave) {
        const qty = Math.min(qtys[w.id] ?? 0, w.quantite);
        if (qty <= 0) continue;
        const newQty = w.quantite - qty;
        const update: any = { quantite: newQty };
        if (newQty <= 0) update.deleted_at = new Date().toISOString();
        const { error: upErr } = await supabase.from("wines").update(update).eq("id", w.id);
        if (upErr) throw upErr;
        const { error: mvErr } = await supabase.from("stock_movements").insert({
          user_id: userId,
          kind: "wine",
          item_id: w.id,
          label: [w.chateau, w.type_vin, w.couleur, w.millesime].filter(Boolean).join(" / "),
          code: w.code_barre,
          delta: -qty,
          reason: "out",
          note: reason.trim() || "Sortie manuelle",
        });
        if (mvErr) throw mvErr;
      }
      return toSave.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} sortie(s) enregistrée(s)`);
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const total = useMemo(() => items.reduce((s, w) => s + (qtys[w.id] ?? 0), 0), [items, qtys]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sortie de bouteilles</DialogTitle>
          <DialogDescription>
            Scannez le QR ou le code-barres d'une bouteille, ou recherchez-la, puis validez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge variant="secondary">{items.length} vin(s) · {total} bouteille(s)</Badge>
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
              placeholder="Douchette ou recherche (code-barres, château…)"
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
                {scanning === "qr" ? "Scannez un QR pour ajouter le vin." : "Scannez un code-barres pour ajouter le vin."}
              </p>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto space-y-2 border rounded-md p-2">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun vin. Scannez ou recherchez une bouteille.
              </p>
            )}
            {items.map((w) => (
              <div key={w.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{w.chateau ?? "(Sans nom)"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[w.type_vin, w.couleur, w.millesime].filter(Boolean).join(" · ")} · stock : {w.quantite}
                  </p>
                </div>
                <Input
                  type="number" min={0} max={w.quantite}
                  value={qtys[w.id] ?? 0}
                  onChange={(e) => setQtys((prev) => ({
                    ...prev,
                    [w.id]: Math.max(0, Math.min(w.quantite, parseInt(e.target.value, 10) || 0)),
                  }))}
                  className="w-20 h-8"
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeItem(w.id)} title="Retirer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div>
            <Label className="text-xs">Motif</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vente, dégustation, perte…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || items.length === 0}>
            Enregistrer la sortie
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
