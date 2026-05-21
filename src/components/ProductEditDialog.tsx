import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ManagedSelect } from "@/components/ManagedSelect";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";

export function ProductEditDialog({
  product, open, onClose,
}: { product: any | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>(product ?? {});
  useEffect(() => { if (product) setF({ ...product }); }, [product]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").update({
        produit: f.produit, animal: f.animal || null, fruit: f.fruit || null,
        emplacement: f.emplacement, bague: f.bague || null, version: f.version,
        quantite: Number(f.quantite) || 1,
        poids: f.poids ? Number(f.poids) : null, unite_poids: f.unite_poids,
        etiquette_format: f.etiquette_format, notes: f.notes || null,
        code: f.code, ancien_code: f.ancien_code || null,
      }).eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["recent-products"] });
      toast.success("Produit modifié"); onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products")
        .update({ deleted_at: new Date().toISOString() }).eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["recent-products"] });
      toast.success("Déplacé dans la corbeille"); onClose();
    },
  });

  if (!product) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle className="font-mono">{f.code}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Row l="Code (ID)"><Input value={f.code ?? ""} onChange={(e) => setF({ ...f, code: e.target.value })} /></Row>
          <Row l="Ancien code (QR)"><Input value={f.ancien_code ?? ""} placeholder="ex: SP0013" onChange={(e) => setF({ ...f, ancien_code: e.target.value })} /></Row>
          <Row l="Produit"><ManagedSelect field="produit" value={f.produit ?? ""} onChange={(v) => setF({ ...f, produit: v })} /></Row>
          <Row l="Animal"><ManagedSelect field="animal" value={f.animal ?? ""} onChange={(v) => setF({ ...f, animal: v })} /></Row>
          <Row l="Fruit/Légume"><ManagedSelect field="fruit" value={f.fruit ?? ""} onChange={(v) => setF({ ...f, fruit: v })} /></Row>
          <Row l="Emplacement"><ManagedSelect field="emplacement" value={f.emplacement ?? ""} onChange={(v) => setF({ ...f, emplacement: v })} /></Row>
          <Row l="Bague"><Input value={f.bague ?? ""} onChange={(e) => setF({ ...f, bague: e.target.value })} /></Row>
          <Row l="Version"><ManagedSelect field="version" value={f.version ?? ""} onChange={(v) => setF({ ...f, version: v })} allowEmpty /></Row>
          <Row l="Quantité"><Input type="number" value={f.quantite ?? 1} onChange={(e) => setF({ ...f, quantite: e.target.value })} /></Row>
          <Row l="Poids"><Input type="number" step="0.01" value={f.poids ?? ""} onChange={(e) => setF({ ...f, poids: e.target.value })} /></Row>
          <Row l="Unité"><ManagedSelect field="unite_poids" value={f.unite_poids ?? ""} onChange={(v) => setF({ ...f, unite_poids: v })} allowEmpty /></Row>
          <Row l="Format étiquette"><ManagedSelect field="etiquette_format" value={f.etiquette_format ?? ""} onChange={(v) => setF({ ...f, etiquette_format: v })} /></Row>
        </div>
        <Row l="Notes"><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} /></Row>
        <DialogFooter>
          <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 className="mr-2 h-4 w-4" /> Supprimer
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="mr-2 h-4 w-4" /> Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ l, children }: { l: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{l}</Label>
      {children}
    </div>
  );
}
