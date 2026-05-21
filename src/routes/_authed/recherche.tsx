import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { QrCode as QrIcon, Barcode, X, Minus, Plus, Trash2, Pencil } from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import { ProductEditDialog } from "@/components/ProductEditDialog";
import { WineEditDialog } from "@/components/WineEditDialog";

export const Route = createFileRoute("/_authed/recherche")({ component: RecherchePage });

type Hit = {
  id: string;
  kind: "product" | "wine";
  label: string;
  sub: string;
  raw: any;
  scannedAt: number;
};

function RecherchePage() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState<"qr" | "barcode" | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [mode, setMode] = useState<"in" | "out" | "details">("out");
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [editWine, setEditWine] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function lookup(text: string) {
    if (!text.trim()) return;
    // Try product code first (extract from QR JSON if needed)
    let code = text.trim();
    try {
      const parsed = JSON.parse(text);
      if (parsed.id) code = parsed.id;
    } catch {
      // Ancien format pipe-séparé : "SP0013||Saucisson|Porc|1|||01/01/2026|"
      if (code.includes("|")) code = code.split("|")[0].trim();
    }
    // search products by code, then by ancien_code (anciens QR)
    let { data: prod } = await supabase.from("products").select("*").eq("code", code).is("deleted_at", null).maybeSingle();
    if (!prod) {
      const r = await supabase.from("products").select("*").eq("ancien_code", code).is("deleted_at", null).maybeSingle();
      prod = r.data;
    }
    if (prod) {
      if (mode === "details") { setEditProduct(prod); return; }
      addHit({ id: prod.id, kind: "product", label: prod.produit, sub: `${prod.code} · ${prod.emplacement}`, raw: prod });
      return;
    }
    // search wine by barcode
    const { data: wine } = await supabase.from("wines").select("*").eq("code_barre", text.trim()).is("deleted_at", null).maybeSingle();
    if (wine) {
      if (mode === "details") { setEditWine(wine); return; }
      addHit({ id: wine.id, kind: "wine", label: wine.chateau ?? "Vin", sub: `${wine.type_vin} ${wine.millesime ?? ""}`.trim(), raw: wine });
      return;
    }
    toast.error("Aucune correspondance pour : " + text);
  }

  function addHit(h: Omit<Hit, "scannedAt">) {
    setHits((prev) => [{ ...h, scannedAt: Date.now() }, ...prev.filter((x) => x.id !== h.id)]);
  }

  const adjustQty = useMutation({
    mutationFn: async ({ hit, delta }: { hit: Hit; delta: number }) => {
      const table = hit.kind === "product" ? "products" : "wines";
      const newQty = Math.max(0, (hit.raw.quantite ?? 0) + delta);
      if (newQty === 0) {
        const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", hit.id);
        if (error) throw error;
        return { removed: true };
      }
      const { error } = await supabase.from(table).update({ quantite: newQty }).eq("id", hit.id);
      if (error) throw error;
      return { removed: false, newQty };
    },
    onSuccess: (r, vars) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      if (r.removed) {
        setHits((p) => p.filter((h) => h.id !== vars.hit.id));
        toast.success("Quantité épuisée → corbeille");
      } else {
        setHits((p) => p.map((h) => h.id === vars.hit.id ? { ...h, raw: { ...h.raw, quantite: r.newQty } } : h));
        toast.success("Quantité mise à jour");
      }
    },
  });

  function onScan(text: string) {
    if (mode === "in") {
      // increment if known, else just lookup
      lookup(text);
    } else {
      lookup(text);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onScan(input);
    setInput("");
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Recherche &amp; Inventaire</h1>
        <p className="text-muted-foreground">Scannez QR codes et codes-barres en masse. Mode douchette ou caméra.</p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Button variant={mode === "out" ? "default" : "outline"} onClick={() => setMode("out")}>− Sortie</Button>
          <Button variant={mode === "in" ? "default" : "outline"} onClick={() => setMode("in")}>+ Entrée</Button>
          <Button variant={mode === "details" ? "default" : "outline"} onClick={() => setMode("details")}>
            <Pencil className="mr-1 h-4 w-4" /> Détails / Modifier
          </Button>
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scannez avec la douchette ou tapez un code…"
            className="text-base"
          />
          <Button type="submit">OK</Button>
        </form>
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant={scanning === "qr" ? "default" : "outline"}
            onClick={() => setScanning(scanning === "qr" ? null : "qr")}
            className="flex-1"
          >
            {scanning === "qr" ? <X className="mr-2 h-4 w-4" /> : <QrIcon className="mr-2 h-4 w-4" />}
            Scanner QR
          </Button>
          <Button
            type="button"
            variant={scanning === "barcode" ? "default" : "outline"}
            onClick={() => setScanning(scanning === "barcode" ? null : "barcode")}
            className="flex-1"
          >
            {scanning === "barcode" ? <X className="mr-2 h-4 w-4" /> : <Barcode className="mr-2 h-4 w-4" />}
            Scanner code-barres
          </Button>
        </div>
        {scanning && (
          <CameraScanner
            continuous
            formats={scanning}
            onScan={onScan}
            onClose={() => setScanning(null)}
          />
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold">Derniers scans</p>
          {hits.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setHits([])}>Vider</Button>
          )}
        </div>
        <div className="space-y-2">
          {hits.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun scan pour le moment.</p>}
          {hits.map((h) => (
            <div key={h.id + h.scannedAt} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
              <Badge variant={h.kind === "wine" ? "secondary" : "default"}>{h.kind === "wine" ? "Vin" : "Produit"}</Badge>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{h.label}</p>
                <p className="text-xs text-muted-foreground truncate">{h.sub}</p>
              </div>
              <span className="text-sm font-mono">×{h.raw.quantite}</span>
              <Button size="icon" variant="outline" onClick={() => adjustQty.mutate({ hit: h, delta: -1 })}>
                <Minus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => adjustQty.mutate({ hit: h, delta: +1 })}>
                <Plus className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setHits((p) => p.filter((x) => x !== h))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <ProductEditDialog product={editProduct} open={!!editProduct} onClose={() => setEditProduct(null)} />
      <WineEditDialog wine={editWine} open={!!editWine} onClose={() => setEditWine(null)} />
    </div>
  );
}
