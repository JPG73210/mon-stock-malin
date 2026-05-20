import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { QrCode } from "@/components/QrCode";
import { ManagedSelect } from "@/components/ManagedSelect";
import { RecentEntries } from "@/components/RecentEntries";
import { CameraScanner } from "@/components/CameraScanner";
import { printLabelAirprint, enqueuePrintJob, downloadLabelPdf } from "@/lib/print";
import { Camera, Printer, Save, X, Send, Download } from "lucide-react";

export const Route = createFileRoute("/_authed/entree")({ component: EntreePage });

type Form = {
  emplacement: string;
  date_creation: string;
  version: string;
  bague: string;
  produit: string;
  animal: string;
  fruit: string;
  quantite: number;
  poids: string;
  unite_poids: string;
  etiquette_format: string;
  needs_label: boolean;
  notes: string;
  legacy_code: string;
  use_legacy: boolean;
};

const empty: Form = {
  emplacement: "Congélateur à Tiroir Garage",
  date_creation: new Date().toISOString().slice(0, 7),
  version: "V1", bague: "", produit: "", animal: "", fruit: "",
  quantite: 1, poids: "", unite_poids: "Gr",
  etiquette_format: "Pas d'étiquettes",
  needs_label: false, notes: "",
  legacy_code: "", use_legacy: false,
};

function EntreePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(empty);
  const [scanLegacy, setScanLegacy] = useState(false);

  const save = useMutation({
    mutationFn: async (mode: "none" | "airprint" | "agent" | "download") => {
      if (!user) throw new Error("Non connecté");
      if (!f.produit) throw new Error("Le produit est obligatoire");
      const dateFull = `${f.date_creation}-01`;
      let code: string;
      if (f.use_legacy) {
        if (!f.legacy_code.trim()) throw new Error("Code existant requis");
        code = f.legacy_code.trim();
      } else {
        const { data: codeData, error: codeErr } = await supabase.rpc("generate_product_code", {
          _user_id: user.id, _date: dateFull,
          _produit: f.produit, _animal: f.animal, _fruit: f.fruit,
        });
        if (codeErr) throw codeErr;
        code = codeData as string;
      }
      const needsLabel = f.etiquette_format !== "Pas d'étiquettes";
      const { error } = await supabase.from("products").insert({
        user_id: user.id, code,
        emplacement: f.emplacement, date_creation: dateFull,
        version: f.version, bague: f.bague || null,
        produit: f.produit, animal: f.animal || null, fruit: f.fruit || null,
        quantite: f.quantite,
        poids: f.poids ? Number(f.poids) : null, unite_poids: f.unite_poids,
        etiquette_format: f.etiquette_format, needs_label: needsLabel,
        notes: f.notes || null,
      });
      if (error) {
        if (String(error.message).includes("duplicate")) throw new Error("Ce code existe déjà");
        throw error;
      }
      return { code, mode };
    },
    onSuccess: async ({ code, mode }) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["recent-products"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["print-jobs"] });
      toast.success(`Produit ${code} enregistré × ${f.quantite}`);
      if (mode === "airprint") await printLabel(code);
      if (mode === "agent") await sendToAgent(code);
      if (mode === "download") await downloadPdf(code);
      setF(empty);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  async function printLabel(code: string) {
    const data = {
      id: code, produit: f.produit, animal: f.animal, fruit: f.fruit,
      bague: f.bague, date: f.date_creation,
      poids: f.poids, unite: f.unite_poids,
    };
    try {
      await printLabelAirprint(f.etiquette_format, data, f.quantite);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur PDF");
    }
  }

  async function sendToAgent(code: string) {
    const data = {
      id: code, produit: f.produit, animal: f.animal, fruit: f.fruit,
      bague: f.bague, date: f.date_creation,
      poids: f.poids, unite: f.unite_poids,
    };
    try {
      await enqueuePrintJob(f.etiquette_format, data, f.quantite);
      toast.success("Envoyé à l'agent d'impression");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur file");
    }
  }

  async function downloadPdf(code: string) {
    const data = {
      id: code, produit: f.produit, animal: f.animal, fruit: f.fruit,
      bague: f.bague, date: f.date_creation,
      poids: f.poids, unite: f.unite_poids,
    };
    try {
      await downloadLabelPdf(f.etiquette_format, data, f.quantite);
      toast.success("PDF téléchargé");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur PDF");
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Entrée — Viande / Légumes</h1>
      <p className="text-muted-foreground mb-6">Un identifiant unique est généré, sauf si vous saisissez un code existant.</p>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4 rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
            <Switch checked={f.use_legacy} onCheckedChange={(v) => setF({ ...f, use_legacy: v })} />
            <Label className="text-sm">J'ai déjà un QR code / une étiquette existante</Label>
          </div>
          {f.use_legacy && (
            <div className="space-y-2">
              <Label className="text-xs">Code existant</Label>
              <div className="flex gap-2">
                <Input value={f.legacy_code} onChange={(e) => setF({ ...f, legacy_code: e.target.value })}
                  placeholder="Scanner ou saisir l'ID de l'étiquette" />
                <Button type="button" variant="outline" size="icon" onClick={() => setScanLegacy(!scanLegacy)}>
                  {scanLegacy ? <X className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                </Button>
              </div>
              {scanLegacy && (
                <CameraScanner
                  onScan={(t) => {
                    let v = t;
                    try { const p = JSON.parse(t); if (p.id) v = p.id; } catch {}
                    setF((p) => ({ ...p, legacy_code: v })); setScanLegacy(false);
                    toast.success("Code lu : " + v);
                  }}
                  onClose={() => setScanLegacy(false)}
                />
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Emplacement">
              <ManagedSelect field="emplacement" value={f.emplacement} onChange={(v) => setF({ ...f, emplacement: v })} />
            </Field>
            <Field label="Date (mm/aaaa)">
              <Input type="month" value={f.date_creation} onChange={(e) => setF({ ...f, date_creation: e.target.value })} />
            </Field>
            <Field label="Version">
              <ManagedSelect field="version" value={f.version} onChange={(v) => setF({ ...f, version: v })} />
            </Field>
            <Field label="N° Bague / Marque">
              <Input value={f.bague} onChange={(e) => setF({ ...f, bague: e.target.value })} placeholder="ex: FR123456" />
            </Field>
            <Field label="Produit *">
              <ManagedSelect field="produit" value={f.produit} onChange={(v) => setF({ ...f, produit: v })} placeholder="Steak, Filet, Tomate…" />
            </Field>
            <Field label="Animal">
              <ManagedSelect field="animal" value={f.animal} onChange={(v) => setF({ ...f, animal: v })} placeholder="Bœuf, Veau…" />
            </Field>
            <Field label="Fruit / Légume">
              <ManagedSelect field="fruit" value={f.fruit} onChange={(v) => setF({ ...f, fruit: v })} placeholder="Tomate, Pomme…" />
            </Field>
            <Field label="Quantité (étiquettes)">
              <Select value={String(f.quantite)} onValueChange={(v) => setF({ ...f, quantite: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {Array.from({ length: 100 }, (_, i) => i + 1).map((n) =>
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Poids">
              <Input type="number" step="0.01" value={f.poids} onChange={(e) => setF({ ...f, poids: e.target.value })} />
            </Field>
            <Field label="Unité">
              <ManagedSelect field="unite_poids" value={f.unite_poids} onChange={(v) => setF({ ...f, unite_poids: v })} />
            </Field>
            <Field label="Format d'étiquette">
              <ManagedSelect field="etiquette_format" value={f.etiquette_format} onChange={(v) => setF({ ...f, etiquette_format: v })} />
            </Field>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={f.needs_label} onCheckedChange={(v) => setF({ ...f, needs_label: v })} />
              <Label>Suivi par étiquette individuelle</Label>
            </div>
          </div>
          <Field label="Notes">
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} />
          </Field>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={() => save.mutate("none")} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" /> Enregistrer
            </Button>
            <Button variant="secondary" onClick={() => save.mutate("airprint")}
              disabled={save.isPending || f.etiquette_format === "Pas d'étiquettes"}>
              <Printer className="mr-2 h-4 w-4" /> Enregistrer &amp; AirPrint
            </Button>
            <Button variant="outline" onClick={() => save.mutate("agent")}
              disabled={save.isPending || f.etiquette_format === "Pas d'étiquettes"}
              title="Envoyer à la file d'impression de l'agent local">
              <Send className="mr-2 h-4 w-4" /> Enregistrer &amp; envoyer à l'agent
            </Button>
            <Button variant="ghost" onClick={() => setF(empty)}>Réinitialiser</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-3">
          <p className="text-sm font-medium">Aperçu QR code</p>
          <QrCode value={JSON.stringify({
            produit: f.produit, animal: f.animal, fruit: f.fruit,
            bague: f.bague, date: f.date_creation,
            poids: f.poids, unite: f.unite_poids,
          })} size={160} />
          <p className="text-xs text-muted-foreground">
            {f.use_legacy ? "L'ID utilisé sera le code existant scanné." : "L'ID définitif sera attribué à l'enregistrement."}
          </p>
        </div>
      </div>

      <RecentEntries kind="product" />
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
