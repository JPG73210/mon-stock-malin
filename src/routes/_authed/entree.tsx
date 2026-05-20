import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { QrCode, qrDataUrl } from "@/components/QrCode";
import { EMPLACEMENTS, VERSIONS, UNITES_POIDS, ETIQUETTE_FORMATS } from "@/lib/constants";
import { Printer, Save } from "lucide-react";

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
};

const empty: Form = {
  emplacement: EMPLACEMENTS[0],
  date_creation: new Date().toISOString().slice(0, 7),
  version: "V1",
  bague: "",
  produit: "",
  animal: "",
  fruit: "",
  quantite: 1,
  poids: "",
  unite_poids: "Gr",
  etiquette_format: "Pas d'étiquettes",
  needs_label: false,
  notes: "",
};

function EntreePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(empty);

  const save = useMutation({
    mutationFn: async (printAfter: boolean) => {
      if (!user) throw new Error("Non connecté");
      if (!f.produit) throw new Error("Le produit est obligatoire");
      const dateFull = `${f.date_creation}-01`;
      const { data: codeData, error: codeErr } = await supabase.rpc("generate_product_code", {
        _user_id: user.id,
        _date: dateFull,
        _produit: f.produit,
        _animal: f.animal,
        _fruit: f.fruit,
      });
      if (codeErr) throw codeErr;
      const code = codeData as string;
      const needsLabel = f.etiquette_format !== "Pas d'étiquettes";
      const { error } = await supabase.from("products").insert({
        user_id: user.id,
        code,
        emplacement: f.emplacement,
        date_creation: dateFull,
        version: f.version,
        bague: f.bague || null,
        produit: f.produit,
        animal: f.animal || null,
        fruit: f.fruit || null,
        quantite: f.quantite,
        poids: f.poids ? Number(f.poids) : null,
        unite_poids: f.unite_poids,
        etiquette_format: f.etiquette_format,
        needs_label: needsLabel,
        notes: f.notes || null,
      });
      if (error) throw error;
      return { code, printAfter };
    },
    onSuccess: async ({ code, printAfter }) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(`Produit ${code} enregistré × ${f.quantite}`);
      setF(empty);
      if (printAfter) await printLabel(code);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  async function printLabel(code: string) {
    const payload = JSON.stringify({
      id: code, produit: f.produit, animal: f.animal, fruit: f.fruit,
      bague: f.bague, date: f.date_creation, poids: f.poids, unite: f.unite_poids,
    });
    const qr = await qrDataUrl(payload, 280);
    const w = window.open("", "_blank", "width=420,height=620");
    if (!w) return toast.error("Pop-up bloquée");
    const fmt = f.etiquette_format;
    const size = fmt === "23x23" ? { w: 23, h: 23 } : fmt === "17x54" ? { w: 54, h: 17 } : { w: 62, h: 30 };
    w.document.write(`<!doctype html><html><head><title>${code}</title>
<style>
@page { size: ${size.w}mm ${size.h}mm; margin: 0; }
body { margin: 0; font-family: system-ui, sans-serif; }
.lbl { width: ${size.w}mm; height: ${size.h}mm; display:flex; gap:2mm; padding:1mm; box-sizing:border-box; align-items:center; }
.qr { height: 100%; aspect-ratio:1; }
.info { font-size: 2.4mm; line-height:1.15; }
.info b { font-size:3mm; }
${Array.from({ length: f.quantite }).map(() => "").join("")}
</style></head><body>
${Array.from({ length: f.quantite }).map(() => `
<div class="lbl">
  <img class="qr" src="${qr}" />
  <div class="info">
    <div><b>${code}</b></div>
    <div>${[f.produit, f.animal, f.fruit].filter(Boolean).join(" / ")}</div>
    <div>${[f.poids ? f.poids + " " + f.unite_poids : "", f.bague ? "Bague " + f.bague : ""].filter(Boolean).join(" · ")}</div>
    <div>${f.date_creation}</div>
  </div>
</div>`).join("")}
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    w.document.close();
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Entrée — Viande / Légumes</h1>
      <p className="text-muted-foreground mb-6">Un identifiant unique est généré automatiquement.</p>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4 rounded-xl border bg-card p-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Emplacement">
              <Select value={f.emplacement} onValueChange={(v) => setF({ ...f, emplacement: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMPLACEMENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Date (mm/aaaa)">
              <Input type="month" value={f.date_creation} onChange={(e) => setF({ ...f, date_creation: e.target.value })} />
            </Field>
            <Field label="Version">
              <Select value={f.version} onValueChange={(v) => setF({ ...f, version: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VERSIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="N° Bague / Marque">
              <Input value={f.bague} onChange={(e) => setF({ ...f, bague: e.target.value })} placeholder="ex: FR123456" />
            </Field>
            <Field label="Produit *">
              <Input value={f.produit} onChange={(e) => setF({ ...f, produit: e.target.value })} placeholder="Steak, Filet, Tomate…" />
            </Field>
            <Field label="Animal">
              <Input value={f.animal} onChange={(e) => setF({ ...f, animal: e.target.value })} placeholder="Bœuf, Veau, Poulet…" />
            </Field>
            <Field label="Fruit / Légume">
              <Input value={f.fruit} onChange={(e) => setF({ ...f, fruit: e.target.value })} placeholder="Tomate, Pomme…" />
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
              <Select value={f.unite_poids} onValueChange={(v) => setF({ ...f, unite_poids: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITES_POIDS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Format d'étiquette">
              <Select value={f.etiquette_format} onValueChange={(v) => setF({ ...f, etiquette_format: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ETIQUETTE_FORMATS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
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
            <Button onClick={() => save.mutate(false)} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" /> Enregistrer
            </Button>
            <Button
              variant="secondary"
              onClick={() => save.mutate(true)}
              disabled={save.isPending || f.etiquette_format === "Pas d'étiquettes"}
            >
              <Printer className="mr-2 h-4 w-4" /> Enregistrer &amp; Imprimer
            </Button>
            <Button variant="ghost" onClick={() => setF(empty)}>Réinitialiser</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-3">
          <p className="text-sm font-medium">Aperçu QR code</p>
          <QrCode
            value={JSON.stringify({
              produit: f.produit, animal: f.animal, fruit: f.fruit,
              bague: f.bague, date: f.date_creation,
              poids: f.poids, unite: f.unite_poids,
            })}
            size={160}
          />
          <p className="text-xs text-muted-foreground">
            L'ID définitif sera attribué à l'enregistrement.
          </p>
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
