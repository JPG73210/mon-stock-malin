import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, RotateCcw, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/impression")({
  component: ImpressionPage,
});

function ImpressionPage() {
  const qc = useQueryClient();
  const { data: jobs = [] } = useQuery({
    queryKey: ["print-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  const retry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("print_jobs").update({ status: "pending", error: null, printed_at: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["print-jobs"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("print_jobs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["print-jobs"] }),
  });

  function downloadPdf(j: any) {
    if (!j.pdf_base64) return toast.error("Pas de PDF disponible");
    const bin = atob(j.pdf_base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etiquette-${(j.label_data as any)?.id ?? j.id}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Impression</h1>
      <p className="text-muted-foreground mb-6">File d'impression vers la Brother QL-810Wc. Deux options : AirPrint (PDF direct) ou agent local.</p>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="border rounded-lg p-4 bg-card">
          <h2 className="font-semibold flex items-center gap-2"><Printer className="h-4 w-4" /> Option 1 — AirPrint</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Depuis iPhone/iPad/Mac : cliquez sur « Imprimer » dans l'app → le PDF s'ouvre → Partager → Imprimer → choisissez votre Brother QL-810Wc. Aucune installation requise.
          </p>
        </div>
        <div className="border rounded-lg p-4 bg-card">
          <h2 className="font-semibold flex items-center gap-2"><Download className="h-4 w-4" /> Option 2 — Agent local</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Sur un PC/Mac/Raspberry Pi allumé : un petit script Node.js scrute la file et imprime via CUPS (<code>lp</code>) sur votre QL-810Wc. 100% automatique.
          </p>
          <Button size="sm" variant="outline" className="mt-3" asChild>
            <a href="/print-agent.zip" download>Télécharger l'agent</a>
          </Button>
        </div>
      </div>

      <h2 className="font-semibold mb-3">File ({jobs.length})</h2>
      <div className="space-y-2">
        {jobs.length === 0 && <p className="text-muted-foreground text-sm">Aucun travail d'impression.</p>}
        {jobs.map((j: any) => (
          <div key={j.id} className="flex items-center justify-between border rounded-md p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{(j.label_data as any)?.id ?? "—"}</p>
                <Badge variant={j.status === "printed" ? "default" : j.status === "error" ? "destructive" : "secondary"}>
                  {j.status === "pending" ? "En attente" : j.status === "printed" ? "Imprimé" : j.status === "printing" ? "En cours" : "Erreur"}
                </Badge>
                <span className="text-xs text-muted-foreground">{j.format} × {(j.label_data as any)?.quantite ?? 1}</span>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString("fr-FR")}{j.error && ` · ${j.error}`}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => downloadPdf(j)} title="Aperçu PDF"><Download className="h-4 w-4" /></Button>
              {j.status !== "pending" && (
                <Button size="sm" variant="ghost" onClick={() => retry.mutate(j.id)} title="Relancer"><RotateCcw className="h-4 w-4" /></Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => del.mutate(j.id)} title="Supprimer"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
