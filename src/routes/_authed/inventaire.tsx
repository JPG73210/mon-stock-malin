import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { QrCode as QrIcon, Barcode, X, Play, Square, Download, AlertCircle, Check, Minus, Plus, ArrowLeftRight, CheckCircle2, ScanLine } from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";

export const Route = createFileRoute("/_authed/inventaire")({ component: InventairePage });

type Item = { id: string; kind: "product" | "wine"; label: string; sub: string; code: string; stockQty: number; raw: any };
type Counted = Item & { countedQty: number; scannedAt: number };

function InventairePage() {
  const qc = useQueryClient();
  const [filtProduit, setFiltProduit] = useState<string>("__all__");
  const [filtAnimal, setFiltAnimal] = useState<string>("__all__");
  const [filtFruit, setFiltFruit] = useState<string>("__all__");
  const [filtChateau, setFiltChateau] = useState<string>("__all__");
  const [filtCouleur, setFiltCouleur] = useState<string>("__all__");
  const [filtMedaille, setFiltMedaille] = useState<string>("__all__");
  const [filtTypeVin, setFiltTypeVin] = useState<string>("__all__");
  const [filtMillesime, setFiltMillesime] = useState<string>("__all__");
  const [autoSortir, setAutoSortir] = useState(false);
  const [started, setStarted] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [lastScan, setLastScan] = useState<{ label: string; sub: string; ok: boolean; ts: number } | null>(null);
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState<"qr" | "barcode" | null>(null);
  const [counted, setCounted] = useState<Counted[]>([]);
  const [unknown, setUnknown] = useState<{ code: string; scannedAt: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["inv-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").is("deleted_at", null).gt("quantite", 0);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: wines = [] } = useQuery({
    queryKey: ["inv-wines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wines").select("*").is("deleted_at", null).gt("quantite", 0);
      if (error) throw error;
      return data ?? [];
    },
  });

  const produits = useMemo(() => Array.from(new Set(products.map((p: any) => p.produit).filter(Boolean))).sort(), [products]);
  const animaux = useMemo(() => Array.from(new Set(products.map((p: any) => p.animal).filter(Boolean))).sort(), [products]);
  const fruits = useMemo(() => Array.from(new Set(products.map((p: any) => p.fruit).filter(Boolean))).sort(), [products]);
  const chateaux = useMemo(() => Array.from(new Set(wines.map((w: any) => w.chateau).filter(Boolean))).sort(), [wines]);
  const couleurs = useMemo(() => Array.from(new Set(wines.map((w: any) => w.couleur).filter(Boolean))).sort(), [wines]);
  const typesVin = useMemo(() => Array.from(new Set(wines.map((w: any) => w.type_vin).filter(Boolean))).sort(), [wines]);
  const millesimes = useMemo(() => Array.from(new Set(wines.map((w: any) => w.millesime).filter(Boolean))).sort((a: any, b: any) => b - a).map(String), [wines]);
  const medailles = useMemo(() => Array.from(new Set(wines.flatMap((w: any) => w.medailles ?? []).filter(Boolean))).sort(), [wines]);

  const scopeItems: Item[] = useMemo(() => {
    const prodItems = products
      .filter((p: any) => {
        if (filtProduit !== "__all__" && p.produit !== filtProduit) return false;
        if (filtAnimal !== "__all__" && p.animal !== filtAnimal) return false;
        if (filtFruit !== "__all__" && p.fruit !== filtFruit) return false;
        return true;
      })
      .map((p: any) => ({
        id: p.id, kind: "product" as const, label: p.produit,
        sub: [p.animal, p.fruit, p.code, p.emplacement].filter(Boolean).join(" · "),
        code: p.code, stockQty: p.quantite ?? 0, raw: p,
      }));
    const wineItems = wines
      .filter((w: any) => {
        if (filtChateau !== "__all__" && w.chateau !== filtChateau) return false;
        if (filtCouleur !== "__all__" && w.couleur !== filtCouleur) return false;
        if (filtTypeVin !== "__all__" && w.type_vin !== filtTypeVin) return false;
        if (filtMillesime !== "__all__" && String(w.millesime ?? "") !== filtMillesime) return false;
        if (filtMedaille !== "__all__" && !(w.medailles ?? []).includes(filtMedaille)) return false;
        return true;
      })
      .map((w: any) => ({
        id: w.id, kind: "wine" as const, label: w.chateau || "Vin",
        sub: [w.couleur, w.type_vin, w.millesime, w.emplacement].filter(Boolean).join(" · "),
        code: w.code_barre || "", stockQty: w.quantite ?? 0, raw: w,
      }));
    return [...prodItems, ...wineItems];
  }, [products, wines, filtProduit, filtAnimal, filtFruit, filtChateau, filtCouleur, filtTypeVin, filtMillesime, filtMedaille]);


  const countedIds = useMemo(() => new Set(counted.map((c) => c.id)), [counted]);
  const remaining = useMemo(() => scopeItems.filter((i) => !countedIds.has(i.id)), [scopeItems, countedIds]);

  useEffect(() => { if (started) inputRef.current?.focus(); }, [started]);

  function start(mode: "normal" | "continuous" = "normal") {
    setCounted([]); setUnknown([]);
    setContinuousMode(mode === "continuous");
    setStarted(true);
    setLastScan(null);
  }
  function stop() {
    if (counted.length === 0 && unknown.length === 0) { setStarted(false); return; }
    if (!confirm("Terminer la session d'inventaire ?")) return;
    setStarted(false);
  }
  function addCounted(item: Item) {
    if (countedIds.has(item.id)) {
      if (continuousMode) {
        // En mode continu : incrémenter au lieu de bloquer
        setCounted((p) => p.map((c) => c.id === item.id ? { ...c, countedQty: c.countedQty + 1, scannedAt: Date.now() } : c));
        setLastScan({ label: item.label, sub: item.sub, ok: true, ts: Date.now() });
        return;
      }
      toast.error(`Déjà compté : ${item.label}`); return;
    }
    setCounted((p) => [{ ...item, countedQty: 1, scannedAt: Date.now() }, ...p]);
    setLastScan({ label: item.label, sub: item.sub, ok: true, ts: Date.now() });
    if (!continuousMode) toast.success(`✓ ${item.label}`);
  }
  function adjustCounted(id: string, delta: number) {
    setCounted((p) => p.map((c) => c.id === id ? { ...c, countedQty: Math.max(0, c.countedQty + delta) } : c));
  }
  function removeCounted(id: string) { setCounted((p) => p.filter((c) => c.id !== id)); }

  async function lookup(text: string) {
    if (!text.trim()) return;
    const raw = text.trim().split(/[\s\r\n]+/)[0] ?? "";
    let code = raw.toUpperCase();
    try { const parsed = JSON.parse(text); if (parsed.id) code = String(parsed.id).toUpperCase(); } catch {
      if (code.includes("|")) code = code.split("|")[0].trim();
    }
    const inScope = scopeItems.find((i) => i.code === code || i.code === raw);
    if (inScope) { addCounted(inScope); return; }
    const tries = Array.from(new Set([code, code.toLowerCase()]));
    for (const c of tries) {
      let { data: prod } = await supabase.from("products").select("*").eq("code", c).is("deleted_at", null).maybeSingle();
      if (!prod) { const r = await supabase.from("products").select("*").eq("ancien_code", c).is("deleted_at", null).maybeSingle(); prod = r.data; }
      if (prod) {
        addCounted({ id: prod.id, kind: "product", label: prod.produit, sub: [prod.animal, prod.fruit, prod.code, "hors périmètre"].filter(Boolean).join(" · "), code: prod.code, stockQty: prod.quantite ?? 0, raw: prod });
        return;
      }
      const { data: wine } = await supabase.from("wines").select("*").eq("code_barre", c).is("deleted_at", null).maybeSingle();
      if (wine) {
        addCounted({ id: wine.id, kind: "wine", label: wine.chateau || "Vin", sub: [wine.couleur, wine.type_vin, wine.millesime, "hors périmètre"].filter(Boolean).join(" · "), code: wine.code_barre || "", stockQty: wine.quantite ?? 0, raw: wine });
        return;
      }
    }
    if (unknown.some((u) => u.code === raw)) { toast.error(`Code inconnu déjà scanné : ${raw}`); return; }
    setUnknown((p) => [{ code: raw, scannedAt: Date.now() }, ...p]);
    toast.error(`Code inconnu : ${raw}`);
  }

  function submit(e: React.FormEvent) { e.preventDefault(); lookup(input); setInput(""); }

  const sortirManquants = useMutation({
    mutationFn: async () => {
      if (remaining.length === 0) throw new Error("Aucun manquant");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      for (const r of remaining) {
        await supabase.from("stock_movements").insert({
          user_id: user.id, kind: "product", item_id: r.id, label: r.label,
          code: r.code, delta: -r.stockQty, reason: "inventory-missing",
        });
        await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", r.id);
      }
      return remaining.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inv-products"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(`${n} produit(s) manquant(s) sortis du stock`);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  function exportCsv() {
    const rows: string[][] = [["Type", "Code", "Libellé", "Stock système", "Stock compté", "Écart", "Statut"]];
    for (const c of counted) rows.push([c.kind, c.code, c.label, String(c.stockQty), String(c.countedQty), String(c.countedQty - c.stockQty), "Compté"]);
    for (const r of remaining) rows.push([r.kind, r.code, r.label, String(r.stockQty), "0", String(-r.stockQty), "Manquant"]);
    for (const u of unknown) rows.push(["?", u.code, "(inconnu)", "0", "1", "1", "Inconnu"]);
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    a.href = url; a.download = `inventaire-${stamp}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Inventaire</h1>
        <p className="text-sm text-muted-foreground">Comptage physique du stock avec anti-doublon.</p>
      </div>

      {!started ? (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <p className="font-semibold">Démarrer une session</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Produits</p>
              <div>
                <Label>Produit</Label>
                <Select value={filtProduit} onValueChange={setFiltProduit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous</SelectItem>
                    {produits.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Animal</Label>
                <Select value={filtAnimal} onValueChange={setFiltAnimal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous</SelectItem>
                    {animaux.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fruit / Légume</Label>
                <Select value={filtFruit} onValueChange={setFiltFruit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous</SelectItem>
                    {fruits.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Vins</p>
              <div>
                <Label>Nom de domaine</Label>
                <Select value={filtChateau} onValueChange={setFiltChateau}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous</SelectItem>
                    {chateaux.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Couleur</Label>
                <Select value={filtCouleur} onValueChange={setFiltCouleur}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Toutes</SelectItem>
                    {couleurs.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Médaille</Label>
                <Select value={filtMedaille} onValueChange={setFiltMedaille}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Toutes</SelectItem>
                    {medailles.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type de vin</Label>
                <Select value={filtTypeVin} onValueChange={setFiltTypeVin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous</SelectItem>
                    {typesVin.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Millésime</Label>
                <Select value={filtMillesime} onValueChange={setFiltMillesime}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tous</SelectItem>
                    {millesimes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={autoSortir} onCheckedChange={(v) => setAutoSortir(!!v)} />
            <Label className="text-sm">Envoyer automatiquement les produits manquants en sortie de stock</Label>
          </div>
          <Button onClick={start}><Play className="mr-2 h-4 w-4" /> Démarrer</Button>
        </div>

      ) : (
        <>
          <div className="rounded-xl border bg-card p-3 space-y-3 sticky top-0 z-10">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {filtProduit !== "__all__" && <Badge variant="outline">{filtProduit}</Badge>}
                {filtAnimal !== "__all__" && <Badge variant="outline">{filtAnimal}</Badge>}
                {filtFruit !== "__all__" && <Badge variant="outline">{filtFruit}</Badge>}
                {filtChateau !== "__all__" && <Badge variant="outline">{filtChateau}</Badge>}
                {filtCouleur !== "__all__" && <Badge variant="outline">{filtCouleur}</Badge>}
                {filtMedaille !== "__all__" && <Badge variant="outline">Médaille {filtMedaille}</Badge>}
                {filtTypeVin !== "__all__" && <Badge variant="outline">{filtTypeVin}</Badge>}
                {filtMillesime !== "__all__" && <Badge variant="outline">{filtMillesime}</Badge>}
                <span className="text-sm text-muted-foreground">{counted.length} / {scopeItems.length} compté(s)</span>
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
              <Input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="Scannez ou tapez un code…" className="text-base" />
              <Button type="submit">OK</Button>
            </form>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={scanning === "qr" ? "default" : "outline"} onClick={() => setScanning(scanning === "qr" ? null : "qr")} className="flex-1">
                {scanning === "qr" ? <X className="mr-1 h-4 w-4" /> : <QrIcon className="mr-1 h-4 w-4" />} QR
              </Button>
              <Button type="button" size="sm" variant={scanning === "barcode" ? "default" : "outline"} onClick={() => setScanning(scanning === "barcode" ? null : "barcode")} className="flex-1">
                {scanning === "barcode" ? <X className="mr-1 h-4 w-4" /> : <Barcode className="mr-1 h-4 w-4" />} Code-barres
              </Button>
            </div>
            {scanning && <CameraScanner continuous formats={scanning} onScan={(t) => lookup(t)} onClose={() => setScanning(null)} />}
            {autoSortir && remaining.length > 0 && (
              <Button size="sm" variant="destructive" className="w-full" onClick={() => sortirManquants.mutate()} disabled={sortirManquants.isPending}>
                <ArrowLeftRight className="mr-1 h-4 w-4" /> Sortir les {remaining.length} manquants
              </Button>
            )}
          </div>

          <Tabs defaultValue="counted">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="counted"><Check className="mr-1 h-3 w-3" /> Comptés ({counted.length})</TabsTrigger>
              <TabsTrigger value="remaining">À compter ({remaining.length})</TabsTrigger>
              <TabsTrigger value="unknown"><AlertCircle className="mr-1 h-3 w-3" /> Inconnus ({unknown.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="counted" className="space-y-2">
              {counted.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun produit compté.</p>}
              {counted.map((c) => {
                const diff = c.countedQty - c.stockQty;
                const inStock = c.stockQty > 0;
                return (
                  <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border bg-background">
                    {inStock && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />}
                    <Badge variant={c.kind === "wine" ? "secondary" : "default"} className="shrink-0">{c.kind === "wine" ? "Vin" : "Prod"}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.sub}</p>
                    </div>
                    <div className="text-xs text-right shrink-0">
                      <p className="text-muted-foreground">Stock: {c.stockQty}</p>
                      {diff !== 0 && <p className={diff > 0 ? "text-green-600" : "text-destructive"}>{diff > 0 ? "+" : ""}{diff}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => adjustCounted(c.id, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="font-mono text-sm w-6 text-center">{c.countedQty}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => adjustCounted(c.id, +1)}><Plus className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeCounted(c.id)}><X className="h-3 w-3" /></Button>
                    </div>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="remaining" className="space-y-2">
              {remaining.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Rien à compter dans ce périmètre.</p>}
              {remaining.map((r) => (
                <button key={r.id} onClick={() => addCounted(r)} className="w-full flex items-center gap-2 p-2 rounded-lg border bg-background hover:bg-muted text-left">
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
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setUnknown((p) => p.filter((x) => x.code !== u.code))}><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
