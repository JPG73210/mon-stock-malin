import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { QrCode as QrIcon, Barcode, X, Trash2, Medal } from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import { ProductEditDialog } from "@/components/ProductEditDialog";
import { WineEditDialog } from "@/components/WineEditDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/recherche")({ component: RecherchePage });

type Hit = {
  id: string;
  kind: "product" | "wine";
  label: string;
  sub: string;
  raw: any;
  photoUrl?: string | null;
  scannedAt: number;
};

const MEDAL_COLORS: Record<string, string> = {
  or: "text-yellow-500",
  argent: "text-zinc-400",
  bronze: "text-amber-700",
};

function RecherchePage() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState<"qr" | "barcode" | null>(null);
  const [hits, setHits] = useState<Hit[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [editProduct, setEditProduct] = useState<any | null>(null);
  const [editWine, setEditWine] = useState<any | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function lookup(text: string) {
    if (!text.trim()) return;
    const raw = text.trim().split(/[\s\r\n]+/)[0] ?? "";
    let code = raw;
    try {
      const parsed = JSON.parse(text);
      if (parsed.id) code = parsed.id;
    } catch {
      if (code.includes("|")) code = code.split("|")[0].trim();
    }
    const legacy = code.toUpperCase().match(/[A-Z]{2}\d{4}/);
    if (legacy) code = legacy[0];

    // Cherche par code (maj.), puis par maj./min. pour anciennes étiquettes
    const tries = Array.from(new Set([code, code.toUpperCase(), code.toLowerCase()]));
    for (const c of tries) {
      let { data: prod } = await supabase.from("products").select("*").eq("code", c).is("deleted_at", null).maybeSingle();
      if (!prod) {
        const r = await supabase.from("products").select("*").eq("ancien_code", c).is("deleted_at", null).maybeSingle();
        prod = r.data;
      }
      if (prod) {
        addHit({ id: prod.id, kind: "product", label: prod.produit, sub: `${prod.code} · ${prod.emplacement}`, raw: prod });
        return;
      }
    }
    const digitsOnly = raw.replace(/\D/g, "");
    const barcodeCandidates = Array.from(new Set([raw, digitsOnly].filter(Boolean)));
    let wine: any = null;
    for (const candidate of barcodeCandidates) {
      const { data } = await supabase.from("wines").select("*").eq("code_barre", candidate).is("deleted_at", null).maybeSingle();
      if (data) { wine = data; break; }
    }
    if (wine) {
      let photoUrl: string | null = null;
      if (wine.photo_url) {
        const { data } = await supabase.storage.from("wine-photos").createSignedUrl(wine.photo_url, 600);
        photoUrl = data?.signedUrl ?? null;
      }
      addHit({ id: wine.id, kind: "wine", label: wine.chateau ?? "Vin", sub: `${wine.type_vin ?? ""} ${wine.millesime ?? ""}`.trim(), raw: wine, photoUrl });
      return;
    }
    // Recherche texte
    const term = text.trim();
    const like = `%${term}%`;
    const { data: matches } = await supabase
      .from("products")
      .select("*")
      .is("deleted_at", null)
      .gt("quantite", 0)
      .or(`produit.ilike.${like},animal.ilike.${like},fruit.ilike.${like},code.ilike.${like}`)
      .order("produit", { ascending: true })
      .limit(20);
    if (matches && matches.length > 0) {
      for (const m of matches) {
        addHit({
          id: m.id, kind: "product", label: m.produit,
          sub: [m.animal, m.fruit, m.code, m.emplacement].filter(Boolean).join(" · "),
          raw: m,
        });
      }
      toast.success(`${matches.length} produit(s) trouvé(s)`);
      return;
    }
    toast.error("Aucune correspondance pour : " + text);
  }

  function addHit(h: Omit<Hit, "scannedAt">) {
    setHits((prev) => [{ ...h, scannedAt: Date.now() }, ...prev.filter((x) => x.id !== h.id)]);
    setChecked((s) => { const n = new Set(s); n.add(h.id); return n; });
  }

  function toggleCheck(id: string) {
    setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const sortirSelection = useMutation({
    mutationFn: async () => {
      const items = hits.filter((h) => checked.has(h.id));
      if (items.length === 0) throw new Error("Aucun produit sélectionné");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      for (const h of items) {
        const table = h.kind === "product" ? "products" : "wines";
        const newQty = Math.max(0, (h.raw.quantite ?? 0) - 1);
        await supabase.from("stock_movements").insert({
          user_id: user.id, kind: h.kind, item_id: h.id,
          label: h.label, code: h.kind === "product" ? h.raw.code : h.raw.code_barre,
          delta: -1, reason: "out",
        });
        if (newQty === 0) {
          await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", h.id);
        } else {
          await supabase.from(table).update({ quantite: newQty }).eq("id", h.id);
        }
      }
      return items.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      toast.success(`${n} produit(s) sorti(s) du stock`);
      setHits((p) => p.filter((h) => !checked.has(h.id)));
      setChecked(new Set());
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    lookup(input);
    setInput("");
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Recherche</h1>
        <p className="text-muted-foreground">Scannez QR codes et codes-barres, ou tapez un identifiant.</p>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <form onSubmit={submit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scannez avec la douchette ou tapez un identifiant…"
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
            onScan={(t) => lookup(t)}
            onClose={() => setScanning(null)}
          />
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <p className="font-semibold">Derniers scans ({hits.length})</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={checked.size === 0 || sortirSelection.isPending}
              onClick={() => sortirSelection.mutate()}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Sortir ({checked.size})
            </Button>
            {hits.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => { setHits([]); setChecked(new Set()); }}>Vider</Button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {hits.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun scan pour le moment.</p>}
          {hits.map((h) => (
            <div
              key={h.id + h.scannedAt}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border bg-background",
                checked.has(h.id) && "border-primary",
              )}
            >
              <Checkbox checked={checked.has(h.id)} onCheckedChange={() => toggleCheck(h.id)} />
              {h.kind === "wine" && h.photoUrl ? (
                <img src={h.photoUrl} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                <Badge variant={h.kind === "wine" ? "secondary" : "default"}>{h.kind === "wine" ? "Vin" : "Prod"}</Badge>
              )}
              <button onClick={() => { if (h.kind === "product") setEditProduct(h.raw); else setEditWine(h.raw); }} className="flex-1 min-w-0 text-left">
                <p className="font-medium truncate">{h.label}</p>
                <p className="text-xs text-muted-foreground truncate">{h.sub}</p>
                {h.kind === "wine" && (h.raw.medailles ?? []).length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {h.raw.medailles.map((m: string) => <Medal key={m} className={cn("h-3 w-3", MEDAL_COLORS[m])} />)}
                  </div>
                )}
              </button>
              <span className="text-sm font-mono">×{h.raw.quantite}</span>
            </div>
          ))}
        </div>
      </div>

      <ProductEditDialog product={editProduct} open={!!editProduct} onClose={() => setEditProduct(null)} />
      <WineEditDialog wine={editWine} open={!!editWine} onClose={() => setEditWine(null)} />
    </div>
  );
}
