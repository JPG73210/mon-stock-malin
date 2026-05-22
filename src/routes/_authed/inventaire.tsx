import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { QrCode as QrIcon, Barcode, X, Play, Square, Download, AlertCircle, Check, Minus, Plus } from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";

export const Route = createFileRoute("/_authed/inventaire")({ component: InventairePage });

type Scope = "all" | "products" | "wines";
type Item = { id: string; kind: "product" | "wine"; label: string; sub: string; code: string; stockQty: number; raw: any };
type Counted = Item & { countedQty: number; scannedAt: number };

function InventairePage() {
  const [scope, setScope] = useState<Scope>("products");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [started, setStarted] = useState(false);
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState<"qr" | "barcode" | null>(null);
  const [counted, setCounted] = useState<Counted[]>([]);
  const [unknown, setUnknown] = useState<{ code: string; scannedAt: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Charger le périmètre une fois la session démarrée
  const { data: products = [] } = useQuery({
    queryKey: ["inv-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .is("deleted_at", null)
        .gt("quantite", 0);
      if (error) throw error;
      return data ?? [];
    },
    enabled: started && scope !== "wines",
  });

  const { data: wines = [] } = useQuery({
    queryKey: ["inv-wines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines")
        .select("*")
        .is("deleted_at", null)
        .gt("quantite", 0);
      if (error) throw error;
      return data ?? [];
    },
    enabled: started && scope !== "products",
  });

  // Types disponibles (produit + animal/fruit)
  const productTypes = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      const t = [p.produit, p.animal || p.fruit].filter(Boolean).join(" ");
      if (t) set.add(t);
    }
    return Array.from(set).sort();
  }, [products]);

  // Items dans le périmètre
  const scopeItems: Item[] = useMemo(() => {
    const list: Item[] = [];
    if (scope !== "wines") {
      for (const p of products) {
        const typeLabel = [p.produit, p.animal || p.fruit].filter(Boolean).join(" ");
        if (typeFilter !== "__all__" && typeLabel !== typeFilter) continue;
        list.push({
          id: p.id, kind: "product", label: p.produit,
          sub: [p.animal, p.fruit, p.code, p.emplacement].filter(Boolean).join(" · "),
          code: p.code, stockQty: p.quantite ?? 0, raw: p,
        });
      }
    }
    if (scope !== "products") {
      for (const w of wines) {
        list.push({
          id: w.id, kind: "wine", label: w.chateau ?? "Vin",
          sub: [w.type_vin, w.couleur, w.millesime, w.code_barre].filter(Boolean).join(" · "),
          code: w.code_barre ?? "", stockQty: w.quantite ?? 0, raw: w,
        });
      }
    }
    return list;
  }, [products, wines, scope, typeFilter]);

  const countedIds = useMemo(() => new Set(counted.map((c) => c.id)), [counted]);
  const remaining = useMemo(() => scopeItems.filter((i) => !countedIds.has(i.id)), [scopeItems, countedIds]);

  useEffect(() => { if (started) inputRef.current?.focus(); }, [started]);

  function start() {
    setCounted([]);
    setUnknown([]);
    setStarted(true);
  }

  function stop() {
    if (counted.length === 0 && unknown.length === 0) {
      setStarted(false);
      return;
    }
    if (!confirm("Terminer la session d'inventaire ?")) return;
    setStarted(false);
  }

  function addCounted(item: Item) {
    if (countedIds.has(item.id)) {
      toast.error(`Déjà compté : ${item.label}`);
      return;
    }
    setCounted((p) => [{ ...item, countedQty: 1, scannedAt: Date.now() }, ...p]);
    toast.success(`✓ ${item.label}`);
  }

  function adjustCounted(id: string, delta: number) {
    setCounted((p) => p.map((c) => c.id === id ? { ...c, countedQty: Math.max(0, c.countedQty + delta) } : c));
  }

  function removeCounted(id: string) {
    setCounted((p) => p.filter((c) => c.id !== id));
  }

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

    // Cherche d'abord dans le périmètre chargé
    const inScope = scopeItems.find((i) => i.code === code || i.code === raw);
    if (inScope) { addCounted(inScope); return; }

    // Sinon, requête DB (hors périmètre ou pas en stock)
    let { data: prod } = await supabase.from("products").select("*").eq("code", code).is("deleted_at", null).maybeSingle();
    if (!prod) {
      const r = await supabase.from("products").select("*").eq("ancien_code", code).is("deleted_at", null).maybeSingle();
      prod = r.data;
    }
    if (prod) {
      const item: Item = {
        id: prod.id, kind: "product", label: prod.produit,
        sub: [prod.animal, prod.fruit, prod.code, "hors périmètre"].filter(Boolean).join(" · "),
        code: prod.code, stockQty: prod.quantite ?? 0, raw: prod,
      };
      addCounted(item);
      return;
    }
    const digitsOnly = raw.replace(/\D/g, "");
    const candidates = Array.from(new Set([raw, digitsOnly].filter(Boolean)));
    for (const c of candidates) {
      const { data } = await supabase.from("wines").select("*").eq("code_barre", c).is("deleted_at", null).maybeSingle();
      if (data) {
        addCounted({
          id: data.id, kind: "wine", label: data.chateau ?? "Vin",
          sub: [data.type_vin, data.couleur, data.millesime].filter(Boolean).join(" · "),
          code: data.code_barre ?? "", stockQty: data.quantite ?? 0, raw: data,
        });
        return;
      }
    }
    // Inconnu
    if (unknown.some((u) => u.code === raw)) {
      toast.error(`Code inconnu déjà scanné : ${raw}`);
      return;
    }
    setUnknown((p) => [{ code: raw, scannedAt: Date.now() }, ...p]);
    toast.error(`Code inconnu : ${raw}`);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    lookup(input);
    setInput("");
  }

  function exportCsv() {
    const rows: string[][] = [["Type", "Code", "Libellé", "Stock système", "Stock compté", "Écart", "Statut"]];
    for (const c of counted) {
      rows.push([
        c.kind, c.code, c.label,
        String(c.stockQty), String(c.countedQty), String(c.countedQty - c.stockQty),
        "Compté",
      ]);
    }
    for (const r of remaining) {
      rows.push([r.kind, r.code, r.label, String(r.stockQty), "0", String(-r.stockQty), "Manquant"]);
    }
    for (const u of unknown) {
      rows.push(["?", u.code, "(inconnu)", "0", "1", "1", "Inconnu"]);
    }
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    a.href = url; a.download = `inventaire-${stamp}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Fiche d'inventaire exportée");
  }

  const last5 = counted.slice(0, 5);

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Inventaire</h1>
        <p className="text-sm text-muted-foreground">Comptage physique du stock avec anti-doublon.</p>
      </div>

      {!started ? (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="font-semibold">Démarrer une session</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Catégorie</Label>
              <Select value={scope} onValueChange={(v) => { setScope(v as Scope); setTypeFilter("__all__"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout</SelectItem>
                  <SelectItem value="products">Viande / Légumes</SelectItem>
                  <SelectItem value="wines">Vins</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope !== "wines" && (
              <div>
                <Label>Type de produit</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous</SelectItem>
                    {productTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Choisissez le type pour scanner par lot (ex: Saucisson Porc).
                </p>
              </div>
            )}
          </div>
          <Button onClick={start} className="w-full sm:w-auto"><Play className="mr-2 h-4 w-4" /> Démarrer</Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card p-3 space-y-3 sticky top-0 z-10">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{scope === "all" ? "Tout" : scope === "products" ? "Produits" : "Vins"}</Badge>
                {typeFilter !== "__all__" && <Badge variant="outline">{typeFilter}</Badge>}
                <span className="text-sm text-muted-foreground">
                  {counted.length} / {scopeItems.length} compté(s)
                </span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportCsv} disabled={counted.length + unknown.length === 0}>
                  <Download className="mr-1 h-4 w-4" /> CSV
                </Button>
                <Button size="sm" variant="destructive" onClick={stop}>
                  <Square className="mr-1 h-4 w-4" /> Terminer
                </Button>
              </div>
            </div>
            <form onSubmit={submit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Scannez ou tapez un code…"
                className="text-base"
              />
              <Button type="submit">OK</Button>
            </form>
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button" size="sm"
                variant={scanning === "qr" ? "default" : "outline"}
                onClick={() => setScanning(scanning === "qr" ? null : "qr")}
                className="flex-1"
              >
                {scanning === "qr" ? <X className="mr-1 h-4 w-4" /> : <QrIcon className="mr-1 h-4 w-4" />}
                QR
              </Button>
              <Button
                type="button" size="sm"
                variant={scanning === "barcode" ? "default" : "outline"}
                onClick={() => setScanning(scanning === "barcode" ? null : "barcode")}
                className="flex-1"
              >
                {scanning === "barcode" ? <X className="mr-1 h-4 w-4" /> : <Barcode className="mr-1 h-4 w-4" />}
                Code-barres
              </Button>
            </div>
            {scanning && (
              <CameraScanner continuous formats={scanning} onScan={(t) => lookup(t)} onClose={() => setScanning(null)} />
            )}
            {last5.length > 0 && (
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground mb-1">5 derniers scans</p>
                <div className="flex gap-1 flex-wrap">
                  {last5.map((c) => (
                    <Badge key={c.id + c.scannedAt} variant="default" className="font-mono text-xs">
                      {c.code || c.label.slice(0, 12)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Tabs defaultValue="counted">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="counted">
                <Check className="mr-1 h-3 w-3" /> Comptés ({counted.length})
              </TabsTrigger>
              <TabsTrigger value="remaining">
                À compter ({remaining.length})
              </TabsTrigger>
              <TabsTrigger value="unknown">
                <AlertCircle className="mr-1 h-3 w-3" /> Inconnus ({unknown.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="counted" className="space-y-2">
              {counted.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun produit compté.</p>}
              {counted.map((c) => {
                const diff = c.countedQty - c.stockQty;
                return (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border bg-background">
                    <Badge variant={c.kind === "wine" ? "secondary" : "default"} className="shrink-0">
                      {c.kind === "wine" ? "Vin" : "Prod"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.sub}</p>
                    </div>
                    <div className="text-xs text-right shrink-0">
                      <p className="text-muted-foreground">Stock: {c.stockQty}</p>
                      {diff !== 0 && <p className={diff > 0 ? "text-green-600" : "text-destructive"}>{diff > 0 ? "+" : ""}{diff}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => adjustCounted(c.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-mono text-sm w-6 text-center">{c.countedQty}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => adjustCounted(c.id, +1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeCounted(c.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="remaining" className="space-y-2">
              {remaining.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Rien à compter dans ce périmètre.</p>}
              {remaining.map((r) => (
                <button
                  key={r.id}
                  onClick={() => addCounted(r)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg border bg-background hover:bg-muted text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.sub}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">×{r.stockQty}</Badge>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="unknown" className="space-y-2">
              {unknown.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun code inconnu.</p>}
              {unknown.map((u) => (
                <div key={u.code + u.scannedAt} className="flex items-center gap-2 p-2 rounded-lg border bg-background">
                  <Badge variant="destructive" className="shrink-0">?</Badge>
                  <p className="flex-1 font-mono text-sm truncate">{u.code}</p>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/entree?code=${encodeURIComponent(u.code)}`}>Enregistrer</a>
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setUnknown((p) => p.filter((x) => x.code !== u.code))}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
