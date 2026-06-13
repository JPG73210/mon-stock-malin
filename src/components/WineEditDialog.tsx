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
import { Switch } from "@/components/ui/switch";
import { ManagedSelect } from "@/components/ManagedSelect";
import { toast } from "sonner";
import { Save, Trash2, Heart, Trophy, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import coffreReserve from "@/assets/coffre-reserve.png";
import { enqueuePrintJob } from "@/lib/print";

const MEDAL_COLORS: Record<string, string> = {
  or: "text-yellow-500",
  argent: "text-zinc-400",
  bronze: "text-amber-700",
};

const MEDAL_LABELS: Record<string, string> = {
  or: "Or",
  argent: "Argent",
  bronze: "Bronze",
  reserve: "Vieille Réserve",
};

export function WineEditDialog({
  wine, open, onClose,
}: { wine: any | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>(wine ?? {});
  useEffect(() => { if (wine) setF({ ...wine }); }, [wine]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wines").update({
        chateau: f.chateau || null, type_vin: f.type_vin, couleur: f.couleur,
        millesime: f.millesime ? Number(f.millesime) : null,
        emplacement: f.emplacement, code_barre: f.code_barre || null,
        quantite: Number(f.quantite) || 1, favori: !!f.favori,
        medailles: f.medailles ?? [],
        notes: f.notes || null,
      }).eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["recent-wines"] });
      toast.success("Vin modifié"); onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wines")
        .update({ deleted_at: new Date().toISOString() }).eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["recent-wines"] });
      toast.success("Déplacé dans la corbeille"); onClose();
    },
  });

  if (!wine) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>{f.chateau || "Vin"}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <Row l="Château / Domaine"><ManagedSelect field="chateau" value={f.chateau ?? ""} onChange={(v) => setF({ ...f, chateau: v })} /></Row>
          <Row l="Type"><ManagedSelect field="type_vin" value={f.type_vin ?? ""} onChange={(v) => setF({ ...f, type_vin: v })} /></Row>
          <Row l="Couleur"><ManagedSelect field="couleur_vin" value={f.couleur ?? ""} onChange={(v) => setF({ ...f, couleur: v })} /></Row>
          <Row l="Millésime"><ManagedSelect field="millesime" value={f.millesime ? String(f.millesime) : ""} onChange={(v) => setF({ ...f, millesime: v })} /></Row>
          <Row l="Emplacement"><ManagedSelect field="emplacement" value={f.emplacement ?? ""} onChange={(v) => setF({ ...f, emplacement: v })} /></Row>
          <Row l="Quantité"><Input type="number" value={f.quantite ?? 1} onChange={(e) => setF({ ...f, quantite: e.target.value })} /></Row>
          <Row l="Code-barres"><Input value={f.code_barre ?? ""} onChange={(e) => setF({ ...f, code_barre: e.target.value })} /></Row>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={!!f.favori} onCheckedChange={(v) => setF({ ...f, favori: v })} />
            <Label className="flex items-center gap-1"><Heart className="h-4 w-4 text-accent" /> À racheter</Label>
          </div>
        </div>
        <div className="p-3 rounded-md border">
          <p className="text-sm font-medium mb-2">Médailles</p>
          <div className="flex gap-2 flex-wrap">
            {(["or", "argent", "bronze", "reserve"] as const).map((m) => {
              const list: string[] = f.medailles ?? [];
              const active = list.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setF({
                    ...f,
                    medailles: active ? list.filter((x) => x !== m) : [...list, m],
                  })}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border p-3 transition w-24",
                    active ? "border-primary bg-primary/10" : "border-input hover:bg-muted",
                  )}
                >
                  {m === "reserve" ? (
                    <img src={coffreReserve} alt="" className="h-6 w-6 object-contain" />
                  ) : (
                    <Trophy className={cn("h-6 w-6", MEDAL_COLORS[m])} />
                  )}
                  <span className="text-[11px] text-center leading-tight">{MEDAL_LABELS[m]}</span>
                </button>
              );
            })}
          </div>
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
