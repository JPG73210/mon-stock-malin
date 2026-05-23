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
import { Camera, Save, Upload, X, Heart, Printer, Medal } from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import { ManagedSelect } from "@/components/ManagedSelect";
import { RecentEntries } from "@/components/RecentEntries";
import { QrCode } from "@/components/QrCode";
import { enqueuePrintJob } from "@/lib/print";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/vin")({ component: VinPage });

type Form = {
  type_vin: string; chateau: string; millesime: string; couleur: string;
  code_barre: string; emplacement: string; quantite: number;
  favori: boolean; comme_racheter: boolean; medailles: string[]; notes: string;
};

const empty: Form = {
  type_vin: "", chateau: "",
  millesime: "",
  couleur: "", code_barre: "",
  emplacement: "Cave à Vin JP",
  quantite: 1, favori: false, comme_racheter: false, medailles: [], notes: "",
};

const MEDAL_COLORS: Record<string, string> = {
  or: "text-yellow-500",
  argent: "text-zinc-400",
  bronze: "text-amber-700",
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

  function toggleMedal(m: string) {
    setF((p) => ({
      ...p,
      medailles: p.medailles.includes(m) ? p.medailles.filter((x) => x !== m) : [...p.medailles, m],
    }));
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
        user_id: user.id, photo_url,
        type_vin: f.type_vin || null, chateau: f.chateau || null,
        millesime: f.millesime ? Number(f.millesime) : null,
        couleur: f.couleur || null, code_barre: f.code_barre || null,
        emplacement: f.emplacement, quantite: f.quantite,
        favori: f.favori, comme_racheter: f.comme_racheter,
        medailles: f.medailles,
        notes: f.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["recent-wines"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["a-racheter"] });
      toast.success(`Vin ajouté × ${f.quantite}`);
      // Pas de reset (reset à la fermeture de l'app)
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  async function printQrLabel() {
    const id = f.code_barre || f.chateau || `VIN-${Date.now()}`;
    try {
      await enqueuePrintJob("23x23", {
        id, produit: f.chateau, animal: f.type_vin,
        date: f.millesime,
      }, 1);
      toast.success("Étiquette 23×23 envoyée à l'imprimante");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur impression");
    }
  }

  const qrValue = JSON.stringify({
    id: f.code_barre, chateau: f.chateau, type_vin: f.type_vin,
    couleur: f.couleur, millesime: f.millesime,
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Entrée — Vin</h1>
      <p className="text-muted-foreground mb-6">Code-barres EAN supporté (douchette ou caméra).</p>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-xl border bg-card p-6 space-y-4">
          {/* 1) Photo en premier */}
          <div className="grid sm:grid-cols-[160px_1fr] gap-4 items-start">
            <div className="space-y-2">
              <p className="text-sm font-medium">Photo de l'étiquette</p>
              {photoPreview ? (
                <img src={photoPreview} alt="aperçu" className="w-full rounded-md object-cover aspect-square" />
              ) : (
                <div className="aspect-square rounded-md border-2 border-dashed flex items-center justify-center text-muted-foreground text-xs">
                  Aucune photo
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
              <Button variant="outline" className="w-full" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> {photoFile ? "Remplacer" : "Prendre / Importer"}
              </Button>
            </div>
            <div className="space-y-3">
              {/* 2) Code-barres */}
              <Field label="Code-barres EAN">
                <div className="flex gap-2">
                  <Input value={f.code_barre} onChange={(e) => setF({ ...f, code_barre: e.target.value.toUpperCase() })} placeholder="Scanner ou saisir" />
                  <Button type="button" variant="outline" size="icon" onClick={() => setScanning(!scanning)}>
                    {scanning ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  </Button>
                </div>
              </Field>
              {scanning && (
                <CameraScanner
                  onScan={(t) => { setF((p) => ({ ...p, code_barre: t })); setScanning(false); toast.success("Code lu : " + t); }}
                  onClose={() => setScanning(false)}
                />
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Type de vin">
              <ManagedSelect field="type_vin" value={f.type_vin} onChange={(v) => setF({ ...f, type_vin: v })} allowEmpty />
            </Field>
            <Field label="Château / Domaine">
              <ManagedSelect field="chateau" value={f.chateau} onChange={(v) => setF({ ...f, chateau: v })} placeholder="Choisir ou ajouter…" />
            </Field>
            <Field label="Millésime">
              <ManagedSelect field="millesime" value={f.millesime} onChange={(v) => setF({ ...f, millesime: v })} allowEmpty />
            </Field>
            <Field label="Couleur">
              <ManagedSelect field="couleur_vin" value={f.couleur} onChange={(v) => setF({ ...f, couleur: v })} allowEmpty />
            </Field>
            <Field label="Emplacement *">
              <ManagedSelect field="emplacement" value={f.emplacement} onChange={(v) => setF({ ...f, emplacement: v })} />
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
          </div>

          {/* Comme racheter + impression QR */}
          <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
            <Switch checked={f.comme_racheter} onCheckedChange={(v) => setF({ ...f, comme_racheter: v })} />
            <Label className="flex-1">Comme racheter</Label>
            <Button type="button" size="icon" variant="outline" onClick={printQrLabel} title="Imprimer étiquette QR 23×23">
              <Printer className="h-4 w-4" />
            </Button>
          </div>

          {/* À racheter */}
          <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
            <Switch checked={f.favori} onCheckedChange={(v) => setF({ ...f, favori: v })} />
            <Label className="flex items-center gap-1"><Heart className="h-4 w-4 text-accent" /> À racheter</Label>
          </div>

          {/* Médailles */}
          <div className="p-3 rounded-md border">
            <p className="text-sm font-medium mb-2">Médailles</p>
            <div className="flex gap-2">
              {(["or", "argent", "bronze"] as const).map((m) => {
                const active = f.medailles.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMedal(m)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border p-3 transition w-20",
                      active ? "border-primary bg-primary/10" : "border-input hover:bg-muted",
                    )}
                  >
                    <Medal className={cn("h-6 w-6", MEDAL_COLORS[m])} />
                    <span className="text-xs capitalize">{m}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Notes">
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} />
          </Field>

          {/* Aperçu QR */}
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium">Aperçu QR code</p>
            <div className="flex justify-center">
              <QrCode value={qrValue} size={140} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" /> Enregistrer
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-3 text-sm">
          <p className="font-medium">Résumé</p>
          <div className="space-y-1 text-muted-foreground">
            <p>Château&nbsp;: {f.chateau || "—"}</p>
            <p>Type&nbsp;: {f.type_vin || "—"} {f.couleur && `· ${f.couleur}`}</p>
            <p>Millésime&nbsp;: {f.millesime || "—"}</p>
            <p>Emplacement&nbsp;: {f.emplacement || "—"}</p>
            <p>Code-barres&nbsp;: {f.code_barre || "—"}</p>
            {f.medailles.length > 0 && (
              <p className="flex items-center gap-1">Médailles&nbsp;:
                {f.medailles.map((m) => <Medal key={m} className={cn("h-4 w-4", MEDAL_COLORS[m])} />)}
              </p>
            )}
          </div>
        </div>
      </div>

      <RecentEntries kind="wine" />
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
