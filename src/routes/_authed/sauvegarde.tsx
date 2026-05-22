import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Upload, Database, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authed/sauvegarde")({ component: BackupPage });

type Backup = {
  version: 1;
  exported_at: string;
  user_id: string;
  products: any[];
  wines: any[];
};

function BackupPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Backup | null>(null);
  const [fileName, setFileName] = useState("");

  async function doExport() {
    if (!user) return;
    setBusy(true);
    try {
      const [p, w] = await Promise.all([
        supabase.from("products").select("*").eq("user_id", user.id).is("deleted_at", null),
        supabase.from("wines").select("*").eq("user_id", user.id).is("deleted_at", null),
      ]);
      if (p.error) throw p.error;
      if (w.error) throw w.error;
      const backup: Backup = {
        version: 1,
        exported_at: new Date().toISOString(),
        user_id: user.id,
        products: p.data ?? [],
        wines: w.data ?? [],
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      a.href = url;
      a.download = `sauvegarde-stock-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Sauvegarde : ${backup.products.length} produits + ${backup.wines.length} vins`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Backup;
      if (!data.products || !data.wines) throw new Error("Fichier invalide");
      setPreview(data);
    } catch (e: any) {
      toast.error("Fichier invalide : " + e.message);
      setPreview(null);
    }
  }

  async function doImport(mode: "merge" | "replace") {
    if (!user || !preview) return;
    if (mode === "replace" && !confirm("⚠️ Cela SUPPRIMERA tout le stock actuel avant de réimporter. Continuer ?")) return;
    setBusy(true);
    try {
      if (mode === "replace") {
        const [dp, dw] = await Promise.all([
          supabase.from("products").delete().eq("user_id", user.id),
          supabase.from("wines").delete().eq("user_id", user.id),
        ]);
        if (dp.error) throw dp.error;
        if (dw.error) throw dw.error;
      }
      const products = preview.products.map((p) => ({ ...p, user_id: user.id }));
      const wines = preview.wines.map((w) => ({ ...w, user_id: user.id }));
      const chunks = <T,>(arr: T[], n = 500) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, (i + 1) * n));
      for (const c of chunks(products)) {
        const { error } = await supabase.from("products").upsert(c, { onConflict: "id" });
        if (error) throw error;
      }
      for (const c of chunks(wines)) {
        const { error } = await supabase.from("wines").upsert(c, { onConflict: "id" });
        if (error) throw error;
      }
      toast.success(`Restauré : ${products.length} produits + ${wines.length} vins`);
      qc.invalidateQueries();
      setPreview(null);
      setFileName("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sauvegarde / Restauration</h1>
        <p className="text-muted-foreground">Exportez votre stock dans un fichier que vous pouvez conserver ailleurs, et restaurez-le en cas de problème.</p>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Exporter</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Télécharge un fichier <code>.json</code> contenant tous vos vins et produits (viande / légumes). Conservez-le sur un disque, un cloud, un mail à vous-même…
        </p>
        <Button onClick={doExport} disabled={busy}>
          <Download className="mr-2 h-4 w-4" /> Télécharger la sauvegarde
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Restaurer</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Importez un fichier <code>.json</code> de sauvegarde précédemment exporté.
        </p>
        <Label className="block">
          <span className="text-xs">Fichier de sauvegarde</span>
          <Input type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </Label>
        {fileName && preview && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex items-center gap-2"><Database className="h-4 w-4" /> {fileName}</div>
            <div>Export du : {new Date(preview.exported_at).toLocaleString("fr-FR")}</div>
            <div>{preview.products.length} produit(s) · {preview.wines.length} vin(s)</div>
          </div>
        )}
        {preview && (
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => doImport("merge")} disabled={busy}>
              <Upload className="mr-2 h-4 w-4" /> Fusionner (ajouter / mettre à jour)
            </Button>
            <Button variant="destructive" onClick={() => doImport("replace")} disabled={busy}>
              <AlertTriangle className="mr-2 h-4 w-4" /> Remplacer tout
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          <strong>Fusionner</strong> : ajoute les éléments manquants et met à jour ceux du même identifiant. <strong>Remplacer</strong> : supprime tout votre stock actuel puis restaure le fichier.
        </p>
      </div>
    </div>
  );
}
