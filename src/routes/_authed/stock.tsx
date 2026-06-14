import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Heart, Trash2, Search, Printer, Pencil, Eye, Download, Share2, Medal, ArrowLeftRight, ScanLine } from "lucide-react";
import { QrCode } from "@/components/QrCode";
import { printLabelAirprint, downloadLabelPdf, shareLabelPdf } from "@/lib/print";
import { printStockProductsA4, printStockWinesA4 } from "@/lib/printStock";
import { ProductEditDialog } from "@/components/ProductEditDialog";
import { WineEditDialog } from "@/components/WineEditDialog";
import { LabelPreviewDialog } from "@/components/LabelPreviewDialog";
import { SortieDialog } from "@/components/SortieDialog";
import { useSelection } from "@/hooks/use-selection";
import { cn } from "@/lib/utils";
import coffreReserve from "@/assets/coffre-reserve.png";

function MedalIcon({ m, className }: { m: string; className?: string }) {
  if (m === "reserve") return <img src={coffreReserve} alt="" className={cn("object-contain", className)} />;
  return <Medal className={cn(className, MEDAL_COLORS[m])} />;
}

export const Route = createFileRoute("/_authed/stock")({ component: StockPage });

type SortKey = "recent" | "produit" | "emplacement" | "code" | "date" | "quantite";

const MEDAL_COLORS: Record<string, string> = {
  or: "text-yellow-500",
  argent: "text-zinc-400",
  bronze: "text-amber-700",
};

function StockPage() {
  const [tab, setTab] = useState("produits");
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl">
      <h1 className="text-3xl font-bold">Stock</h1>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="produits">Viande / Légumes</TabsTrigger>
          <TabsTrigger value="vins">Vins</TabsTrigger>
        </TabsList>
        <TabsContent value="produits" className="mt-4"><ProductsList /></TabsContent>
        <TabsContent value="vins" className="mt-4"><WinesList /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProductsList() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [empFilter, setEmpFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [previewing, setPreviewing] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [sortieOpen, setSortieOpen] = useState(false);
  const { has, toggle, clear, ids: selIds } = useSelection();

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const emplacements = useMemo(
    () => Array.from(new Set((products ?? []).map((p: any) => p.emplacement))),
    [products],
  );
  const years = useMemo(
    () => Array.from(new Set((products ?? []).map((p: any) => p.code?.slice(0, 2)).filter(Boolean))),
    [products],
  );

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((p: any) =>
        [p.code, p.produit, p.animal, p.fruit, p.bague, p.emplacement]
          .filter(Boolean).some((v: string) => v.toLowerCase().includes(s)));
    }
    if (empFilter !== "all") list = list.filter((p: any) => p.emplacement === empFilter);
    if (yearFilter !== "all") list = list.filter((p: any) => p.code?.startsWith(yearFilter));
    const sorted = [...list];
    sorted.sort((a: any, b: any) => {
      switch (sort) {
        case "produit": return a.produit.localeCompare(b.produit);
        case "emplacement": return a.emplacement.localeCompare(b.emplacement);
        case "code": return a.code.localeCompare(b.code);
        case "date": return b.date_creation.localeCompare(a.date_creation);
        case "quantite": return b.quantite - a.quantite;
        default: return b.created_at.localeCompare(a.created_at);
      }
    });
    return sorted;
  }, [products, q, sort, empFilter, yearFilter]);

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      const { data: row } = await supabase.from("products")
        .select("code, produit, animal, fruit, quantite").eq("id", id).maybeSingle();
      const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      if (userId && row && (row.quantite ?? 0) > 0) {
        await supabase.from("stock_movements").insert({
          user_id: userId, kind: "product", item_id: id,
          label: [row.produit, row.animal, row.fruit].filter(Boolean).join(" / "),
          code: row.code, delta: -(row.quantite ?? 0), reason: "out",
          note: "Suppression depuis le stock",
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Déplacé dans la corbeille");
      setSelected(null);
    },
  });


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (produit, animal, ID, bague…)" className="pl-9" />
        </div>
        <Select value={empFilter} onValueChange={setEmpFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Emplacement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les emplacements</SelectItem>
            {emplacements.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Année" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>20{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Plus récents</SelectItem>
            <SelectItem value="produit">Produit (A→Z)</SelectItem>
            <SelectItem value="emplacement">Emplacement</SelectItem>
            <SelectItem value="code">ID</SelectItem>
            <SelectItem value="date">Date création</SelectItem>
            <SelectItem value="quantite">Quantité</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{filtered.length} produit(s)</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              printStockProductsA4(filtered as any).catch(() => toast.error("Impression impossible"))
            }
          >
            <Printer className="mr-1 h-4 w-4" /> Imprimer stock (A4)
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSortieOpen(true)}>
            <ScanLine className="mr-1 h-4 w-4" /> Scanner sortie
          </Button>
          {selIds.length > 0 && (
            <>
              <Badge variant="secondary">{selIds.length} sélectionné(s)</Badge>
              <Button size="sm" variant="outline" onClick={clear}>Tout désélectionner</Button>
              <Button size="sm" onClick={() => setSortieOpen(true)}>
                <ArrowLeftRight className="mr-1 h-4 w-4" /> Sortir du stock
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p: any) => {
          const isSel = has(p.id);
          return (
            <div
              key={p.id}
              className={cn(
                "relative text-left rounded-xl border bg-card p-4 transition group",
                isSel ? "border-primary ring-2 ring-primary/30" : "hover:border-primary",
              )}
            >
              <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={isSel} onCheckedChange={() => toggle(p.id)} />
              </div>
              <button onClick={() => setSelected(p)} className="text-left w-full pl-7">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                    <p className="font-semibold">{p.produit}</p>
                    <p className="text-sm text-muted-foreground">{[p.animal, p.fruit].filter(Boolean).join(" / ")}</p>
                  </div>
                  <Badge variant="secondary">×{p.quantite}</Badge>
                </div>
                <p className="text-xs mt-2 text-muted-foreground">{p.emplacement}</p>
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-muted-foreground col-span-full text-center py-12">Aucun produit.</p>}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">{selected.code}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-[160px_1fr] gap-4">
                <QrCode value={JSON.stringify({ id: selected.code, produit: selected.produit, animal: selected.animal, bague: selected.bague, date: selected.date_creation, poids: selected.poids, unite: selected.unite_poids })} />
                <div className="space-y-1 text-sm">
                  <Info l="Produit" v={selected.produit} />
                  <Info l="Animal" v={selected.animal} />
                  <Info l="Fruit/Légume" v={selected.fruit} />
                  <Info l="Bague" v={selected.bague} />
                  <Info l="Emplacement" v={selected.emplacement} />
                  <Info l="Date" v={selected.date_creation} />
                  <Info l="Version" v={selected.version} />
                  <Info l="Poids" v={selected.poids ? `${selected.poids} ${selected.unite_poids}` : null} />
                  <Info l="Quantité" v={selected.quantite} />
                  <Info l="Étiquette" v={selected.etiquette_format} />
                </div>
              </div>
              {selected.notes && <p className="text-sm text-muted-foreground border-t pt-3">{selected.notes}</p>}
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="outline" onClick={() => setPreviewing(selected)}><Eye className="mr-2 h-4 w-4" /> Aperçu</Button>
                <Button variant="outline" onClick={() => downloadLabelPdf(selected.etiquette_format ?? "62", { id: selected.code, produit: selected.produit, animal: selected.animal, fruit: selected.fruit, bague: selected.bague, date: selected.date_creation, poids: selected.poids, unite: selected.unite_poids }, 1).catch(() => toast.error("Téléchargement impossible"))}><Download className="mr-2 h-4 w-4" /> Télécharger PDF</Button>
                <Button variant="outline" onClick={() => printLabelAirprint(selected.etiquette_format ?? "62", { id: selected.code, produit: selected.produit, animal: selected.animal, fruit: selected.fruit, bague: selected.bague, date: selected.date_creation, poids: selected.poids, unite: selected.unite_poids }, 1).catch(() => toast.error("Impression impossible"))}><Printer className="mr-2 h-4 w-4" /> Imprimer</Button>
                <Button onClick={() => shareLabelPdf(selected.etiquette_format ?? "62", { id: selected.code, produit: selected.produit, animal: selected.animal, fruit: selected.fruit, bague: selected.bague, date: selected.date_creation, poids: selected.poids, unite: selected.unite_poids }, 1).then((ok) => ok && toast.success("Choisissez iPrint&Label dans le partage")).catch(() => toast.error("Partage impossible"))}><Share2 className="mr-2 h-4 w-4" /> iPrint&Label</Button>
                <Button variant="secondary" onClick={() => { setEditing(selected); setSelected(null); }}>
                  <Pencil className="mr-2 h-4 w-4" /> Modifier
                </Button>
                <Button variant="destructive" onClick={() => softDelete.mutate(selected.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <ProductEditDialog product={editing} open={!!editing} onClose={() => setEditing(null)} />
      {previewing && (
        <LabelPreviewDialog
          open={!!previewing}
          onClose={() => setPreviewing(null)}
          fmt={previewing.etiquette_format ?? "62"}
          data={{
            id: previewing.code,
            produit: previewing.produit,
            animal: previewing.animal,
            fruit: previewing.fruit,
            bague: previewing.bague,
            date: previewing.date_creation,
            poids: previewing.poids,
            unite: previewing.unite_poids,
          }}
        />
      )}
      <SortieDialog
        open={sortieOpen}
        onClose={() => setSortieOpen(false)}
        products={(products ?? []).filter((p: any) => selIds.includes(p.id))}
        onDone={clear}
      />
    </div>
  );
}

function useWinePhotos(wines: any[] | undefined) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!wines) return;
    const toFetch = wines.filter((w) => w.photo_url && !urls[w.id]);
    if (toFetch.length === 0) return;
    (async () => {
      const paths = toFetch.map((w) => w.photo_url as string);
      const { data } = await supabase.storage.from("wine-photos").createSignedUrls(paths, 600);
      if (!data) return;
      setUrls((prev) => {
        const next = { ...prev };
        data.forEach((d, i) => { if (d.signedUrl) next[toFetch[i].id] = d.signedUrl; });
        return next;
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wines]);
  return urls;
}

export function WinesList() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("recent");
  const [colorFilter, setColorFilter] = useState("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { data: wines } = useQuery({
    queryKey: ["wines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wines").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const colors = useMemo(
    () => Array.from(new Set((wines ?? []).map((w: any) => w.couleur).filter(Boolean))),
    [wines],
  );

  const filtered = useMemo(() => {
    let list = wines ?? [];
    if (q) {
      const s = q.toLowerCase();
      list = list.filter((w: any) =>
        [w.chateau, w.type_vin, w.couleur, w.code_barre, w.emplacement, String(w.millesime)]
          .filter(Boolean).some((v: string) => v.toLowerCase().includes(s)));
    }
    if (colorFilter !== "all") list = list.filter((w: any) => w.couleur === colorFilter);
    const sorted = [...list];
    sorted.sort((a: any, b: any) => {
      switch (sort) {
        case "chateau": return (a.chateau ?? "").localeCompare(b.chateau ?? "");
        case "millesime": return (b.millesime ?? 0) - (a.millesime ?? 0);
        case "favori": return Number(b.favori) - Number(a.favori);
        case "quantite": return b.quantite - a.quantite;
        case "medailles": {
          const rank = (m: string[] | null) => {
            const arr = m ?? [];
            if (arr.includes("reserve")) return 4;
            if (arr.includes("or")) return 3;
            if (arr.includes("argent")) return 2;
            if (arr.includes("bronze")) return 1;
            return 0;
          };
          const diff = rank(b.medailles) - rank(a.medailles);
          if (diff !== 0) return diff;
          return (a.millesime ?? 0) - (b.millesime ?? 0);
        }
        default: return b.created_at.localeCompare(a.created_at);
      }
    });
    return sorted;
  }, [wines, q, sort, colorFilter]);

  const photoUrls = useWinePhotos(filtered);

  const toggleFavori = useMutation({
    mutationFn: async ({ id, fav }: { id: string; fav: boolean }) => {
      const { error } = await supabase.from("wines").update({ favori: fav }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wines"] }),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wines").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Déplacé dans la corbeille");
      setSelected(null);
    },
  });

  async function openDetail(w: any) {
    setSelected(w);
    if (w.photo_url) {
      const { data } = await supabase.storage.from("wine-photos").createSignedUrl(w.photo_url, 600);
      setPhotoUrl(data?.signedUrl ?? null);
    } else setPhotoUrl(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Château, type, code-barres…" className="pl-9" />
        </div>
        <Select value={colorFilter} onValueChange={setColorFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Couleur" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes couleurs</SelectItem>
            {colors.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Plus récents</SelectItem>
            <SelectItem value="chateau">Château (A→Z)</SelectItem>
            <SelectItem value="millesime">Millésime</SelectItem>
            <SelectItem value="quantite">Quantité</SelectItem>
            <SelectItem value="favori">Favoris d'abord</SelectItem>
            <SelectItem value="medailles">Médailles</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{filtered.length} vin(s)</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            printStockWinesA4(filtered as any).catch(() => toast.error("Impression impossible"))
          }
        >
          <Printer className="mr-1 h-4 w-4" /> Imprimer stock (A4)
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((w: any) => (
          <button key={w.id} onClick={() => openDetail(w)} className="text-left rounded-xl border bg-card p-3 hover:border-primary transition relative flex gap-3">
            {w.photo_url && photoUrls[w.id] ? (
              <img src={photoUrls[w.id]} alt="" className="h-20 w-20 rounded-md object-cover shrink-0" />
            ) : (
              <div className="h-20 w-20 rounded-md border-2 border-dashed shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <button
                onClick={(e) => { e.stopPropagation(); toggleFavori.mutate({ id: w.id, fav: !w.favori }); }}
                className="absolute top-2 right-2"
                aria-label="favori"
              >
                <Heart className={`h-5 w-5 ${w.favori ? "fill-accent text-accent" : "text-muted-foreground"}`} />
              </button>
              <p className="font-semibold pr-6 truncate">{w.chateau || "(Sans nom)"}</p>
              <p className="text-xs text-muted-foreground truncate">{w.type_vin} · {w.couleur}</p>
              <p className="text-xs mt-0.5">{w.millesime ?? "—"} · ×{w.quantite}</p>
              <div className="flex items-center gap-1 mt-1">
                {(w.medailles ?? []).map((m: string) => (
                  <MedalIcon key={m} m={m} className="h-4 w-4" />
                ))}
                {w.comme_racheter && <Badge variant="outline" className="text-[10px] h-4 px-1">comme</Badge>}
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-muted-foreground col-span-full text-center py-12">Aucun vin.</p>}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.chateau || "Vin"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-[140px_1fr] gap-4">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-full rounded-md object-cover aspect-square" />
                ) : (
                  <div className="aspect-square rounded-md border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground">Pas de photo</div>
                )}
                <div className="space-y-1 text-sm">
                  <Info l="Type" v={selected.type_vin} />
                  <Info l="Couleur" v={selected.couleur} />
                  <Info l="Millésime" v={selected.millesime} />
                  <Info l="Emplacement" v={selected.emplacement} />
                  <Info l="Quantité" v={selected.quantite} />
                  <Info l="Code-barres" v={selected.code_barre} />
                  <Info l="Favori" v={selected.favori ? "Oui" : "Non"} />
                  {(selected.medailles ?? []).length > 0 && (
                    <p className="flex items-center gap-1"><span className="text-muted-foreground">Médailles :</span>
                      {selected.medailles.map((m: string) => <MedalIcon key={m} m={m} className="h-4 w-4" />)}
                    </p>
                  )}
                </div>
              </div>
              {selected.notes && <p className="text-sm text-muted-foreground border-t pt-3">{selected.notes}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => toggleFavori.mutate({ id: selected.id, fav: !selected.favori })}>
                  <Heart className={`mr-2 h-4 w-4 ${selected.favori ? "fill-accent text-accent" : ""}`} /> {selected.favori ? "Retirer" : "À racheter"}
                </Button>
                <Button variant="secondary" onClick={() => { setEditing(selected); setSelected(null); }}>
                  <Pencil className="mr-2 h-4 w-4" /> Modifier
                </Button>
                <Button variant="destructive" onClick={() => softDelete.mutate(selected.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <WineEditDialog wine={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function Info({ l, v }: { l: string; v: any }) {
  return (
    <p><span className="text-muted-foreground">{l} :</span> <span className="font-medium">{v ?? "—"}</span></p>
  );
}
