import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, Wine } from "lucide-react";

export const Route = createFileRoute("/_authed/import")({ component: ImportPage });

type Row = Record<string, string>;

function parseCSV(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = l.split(sep);
    const r: Row = {};
    headers.forEach((h, i) => { r[h] = (cells[i] ?? "").trim(); });
    return r;
  });
}

function ImportPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import CSV</h1>
        <p className="text-muted-foreground">Importez votre stock existant depuis un fichier CSV (export Excel).</p>
      </div>
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products"><FileSpreadsheet className="mr-2 h-4 w-4" />Viande / Légumes</TabsTrigger>
          <TabsTrigger value="wines"><Wine className="mr-2 h-4 w-4" />Vins</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-4"><ProductImport /></TabsContent>
        <TabsContent value="wines" className="mt-4"><WineImport /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProductImport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setRows(parseCSV(text));
  }

  const importAll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non connecté");
      const today = new Date().toISOString().slice(0, 10);
      const payload = rows.map((r) => ({
        user_id: user.id,
        code: r.code || r.id,
        produit: r.produit || r.product || "Inconnu",
        animal: r.animal || null,
        fruit: r.fruit || r.legume || null,
        emplacement: r.emplacement || r.location || "Import",
        bague: r.bague || null,
        version: r.version || "V1",
        date_creation: r.date || r.date_creation || today,
        quantite: Number(r.quantite || r.qty || 1),
        poids: r.poids ? Number(r.poids) : null,
        unite_poids: r.unite || r.unite_poids || "Gr",
        etiquette_format: r.format || r.etiquette_format || "Pas d'étiquettes",
        needs_label: false,
        notes: r.notes || null,
      })).filter((p) => p.code);
      if (!payload.length) throw new Error("Aucune ligne valide (colonne 'code' requise)");
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["recent-products"] });
      toast.success(`${n} produit(s) importé(s)`);
      setRows([]); setFileName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm">
          <strong>Colonnes attendues</strong> (insensible à la casse, séparateur <code>,</code> ou <code>;</code>) :<br />
          <code className="text-xs">code, produit, animal, fruit, emplacement, bague, version, date, quantite, poids, unite, format, notes</code>
        </p>
        <Label className="block">
          <span className="text-xs">Fichier CSV</span>
          <Input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </Label>
        {fileName && <p className="text-xs text-muted-foreground">{fileName} · {rows.length} ligne(s)</p>}
      </div>

      {rows.length > 0 && (
        <>
          <div className="rounded-xl border bg-card max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>{Object.keys(rows[0]).map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t">
                    {Object.keys(rows[0]).map((h) => <td key={h} className="p-2">{r[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && <p className="p-2 text-center text-xs text-muted-foreground">… {rows.length - 50} lignes supplémentaires</p>}
          </div>
          <Button onClick={() => importAll.mutate()} disabled={importAll.isPending}>
            <Check className="mr-2 h-4 w-4" /> Importer {rows.length} ligne(s)
          </Button>
        </>
      )}
    </div>
  );
}

function WineImport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setRows(parseCSV(text));
  }

  const importAll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non connecté");
      const payload = rows.map((r) => ({
        user_id: user.id,
        chateau: r.chateau || r.domaine || r.nom || null,
        type_vin: r.type || r.type_vin || "Autre",
        couleur: r.couleur || r.color || "Rouge",
        millesime: r.millesime || r.annee ? Number(r.millesime || r.annee) : null,
        emplacement: r.emplacement || r.location || "Cave",
        code_barre: r.code_barre || r.ean || null,
        quantite: Number(r.quantite || r.qty || 1),
        favori: ["1", "oui", "true", "yes"].includes((r.favori || "").toLowerCase()),
        notes: r.notes || null,
      }));
      if (!payload.length) throw new Error("Aucune ligne");
      const { error } = await supabase.from("wines").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["wines"] });
      qc.invalidateQueries({ queryKey: ["recent-wines"] });
      toast.success(`${n} vin(s) importé(s)`);
      setRows([]); setFileName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm">
          <strong>Colonnes attendues</strong> : <code className="text-xs">chateau, type, couleur, millesime, emplacement, code_barre, quantite, favori, notes</code>
        </p>
        <Label className="block">
          <span className="text-xs">Fichier CSV</span>
          <Input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </Label>
        {fileName && <p className="text-xs text-muted-foreground">{fileName} · {rows.length} ligne(s)</p>}
      </div>

      {rows.length > 0 && (
        <>
          <div className="rounded-xl border bg-card max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted">
                <tr>{Object.keys(rows[0]).map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t">
                    {Object.keys(rows[0]).map((h) => <td key={h} className="p-2">{r[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={() => importAll.mutate()} disabled={importAll.isPending}>
            <Upload className="mr-2 h-4 w-4" /> Importer {rows.length} vin(s)
          </Button>
        </>
      )}
    </div>
  );
}
