import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, Save, Upload, X, Heart } from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import { EMPLACEMENTS, TYPES_VIN, COULEURS_VIN } from "@/lib/constants";

export const Route = createFileRoute("/_authed/vin")({ component: VinPage });

type Form = {
  type_vin: string;
  chateau: string;
  millesime: string;
  couleur: string;
  code_barre: string;
  emplacement: string;
  quantite: number;
  favori: boolean;
  notes: string;
};

const empty: Form = {
  type_vin: "Bordeaux",
  chateau: "",
  millesime: String(new Date().getFullYear()),
  couleur: "Rouge",
  code_barre: "",
  emplacement: "Cave à Vin JP",
  quantite: 1,
  favori: false,
  notes: "",
};

function VinPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(empty);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | null) {
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non connecté");
      let photo_url: string | null = null;
      if (photoFile) {
        const path = `${user.id}/${Date.now()}-${photoFile.name}`;
        const { error: upErr } = await supabase.storage.from("wine-photos").upload(path, photoFile);
        if (upErr) throw upErr;
        photo_url = path;
      }
      const { error } = await supabase.from("wines").insert({
        user_id: user.id,
        photo_url,
        type_vin: f.type_vin,
        chateau: f.chateau || null,
        millesime: f.millesime ? Number(f.millesime) : null,
        couleur: f.couleur,
        code_barre: f.code_barre || null,
        emplacement: f.emplacement,
        quantite: f.quantite,
        favori: f.favori,
        notes: f.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(`Vin ajouté × ${f.quantite}`);
      setF(empty);
      handleFile(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Entrée — Vin</h1>
      <p className="text-muted-foreground mb-6">Pas d'identifiant ni d'étiquette pour les vins.</p>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-xl border bg-card p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Type de vin">
              <Select value={f.type_vin} onValueChange={(v) => setF({ ...f, type_vin: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES_VIN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Château / Domaine">
              <Input value={f.chateau} onChange={(e) => setF({ ...f, chateau: e.target.value })} />
            </Field>
            <Field label="Millésime">
              <Input type="number" min="1900" max="2100" value={f.millesime} onChange={(e) => setF({ ...f, millesime: e.target.value })} />
            </Field>
            <Field label="Couleur">
              <Select value={f.couleur} onValueChange={(v) => setF({ ...f, couleur: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{COULEURS_VIN.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Emplacement">
              <Select value={f.emplacement} onValueChange={(v) => setF({ ...f, emplacement: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMPLACEMENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Quantité">
              <Select value={String(f.quantite)} onValueChange={(v) => setF({ ...f, quantite: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {Array.from({ length: 100 }, (_, i) => i + 1).map((n) =>
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Code-barres">
              <div className="flex gap-2">
                <Input value={f.code_barre} onChange={(e) => setF({ ...f, code_barre: e.target.value })} placeholder="Scanner ou saisir" />
                <Button type="button" variant="outline" size="icon" onClick={() => setScanning(!scanning)}>
                  {scanning ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                </Button>
              </div>
            </Field>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={f.favori} onCheckedChange={(v) => setF({ ...f, favori: v })} />
              <Label className="flex items-center gap-1"><Heart className="h-4 w-4 text-accent" /> À racheter</Label>
            </div>
          </div>

          {scanning && (
            <CameraScanner
              onScan={(t) => { setF((p) => ({ ...p, code_barre: t })); setScanning(false); toast.success("Code-barres lu : " + t); }}
              onClose={() => setScanning(false)}
            />
          )}

          <Field label="Notes">
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} />
          </Field>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" /> Enregistrer
            </Button>
            <Button variant="ghost" onClick={() => { setF(empty); handleFile(null); }}>Réinitialiser</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-3">
          <p className="text-sm font-medium">Photo de l'étiquette</p>
          {photoPreview ? (
            <img src={photoPreview} alt="aperçu" className="w-full rounded-md object-cover aspect-square" />
          ) : (
            <div className="aspect-square rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground text-xs">
              Aucune photo
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> {photoFile ? "Remplacer" : "Prendre / Importer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
