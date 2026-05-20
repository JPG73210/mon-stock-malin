import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ManagedSelect } from "@/components/ManagedSelect";
import { Trash2, Upload as UploadIcon, FileImage } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/etiquettes")({
  component: EtiquettesPage,
});

function EtiquettesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [format, setFormat] = useState("30x62");
  const [file, setFile] = useState<File | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["label-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("label_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const upload = useMutation({
    mutationFn: async () => {
      if (!name) throw new Error("Nom requis");
      if (!file) throw new Error("Fichier requis");
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Non authentifié");
      const path = `${user.user.id}/${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage.from("label-templates").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("label_templates").insert({
        user_id: user.user.id, name, format, file_url: path,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label-templates"] });
      toast.success("Modèle enregistré");
      setName(""); setFile(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const del = useMutation({
    mutationFn: async (t: any) => {
      if (t.file_url) await supabase.storage.from("label-templates").remove([t.file_url]);
      const { error } = await supabase.from("label_templates").delete().eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["label-templates"] });
      toast.success("Modèle supprimé");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  async function download(t: any) {
    const { data, error } = await supabase.storage.from("label-templates").createSignedUrl(t.file_url, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Modèles d'étiquettes</h1>
      <p className="text-muted-foreground mb-6">Stockez vos modèles (PNG, PDF, .lbx Brother) par format.</p>

      <div className="border rounded-lg p-4 mb-6 space-y-3 bg-card">
        <h2 className="font-semibold">Ajouter un modèle</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Vin chateau standard" />
          </div>
          <div>
            <Label>Format</Label>
            <ManagedSelect field="etiquette_format" value={format} onChange={setFormat} />
          </div>
          <div>
            <Label>Fichier</Label>
            <Input type="file" accept=".lbx,.png,.jpg,.jpeg,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <Button onClick={() => upload.mutate()} disabled={upload.isPending}>
          <UploadIcon className="mr-2 h-4 w-4" /> Téléverser
        </Button>
      </div>

      <div className="space-y-2">
        {templates.length === 0 && <p className="text-muted-foreground text-sm">Aucun modèle pour l'instant.</p>}
        {templates.map((t: any) => (
          <div key={t.id} className="flex items-center justify-between border rounded-md p-3">
            <div className="flex items-center gap-3">
              <FileImage className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">Format {t.format}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => download(t)}>Voir</Button>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(t)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
