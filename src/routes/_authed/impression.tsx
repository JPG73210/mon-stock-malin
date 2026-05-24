import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Printer, RotateCcw, Trash2, Download, FlaskConical, Eraser } from "lucide-react";
import { toast } from "sonner";
import { enqueuePrintJob } from "@/lib/print";

export const Route = createFileRoute("/_authed/impression")({
  component: ImpressionPage,
});

function ImpressionPage() {
  const qc = useQueryClient();
  const { data: jobs = [] } = useQuery({
    queryKey: ["print-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("print_jobs").select("*").order("created_at", { ascending: false }).limit(100);
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

  const createTest = useMutation({
    mutationFn: async () => {
      await enqueuePrintJob("62", { id: `TEST-${new Date().toISOString().slice(11, 19)}`, produit: "Test impression", date: new Date().toLocaleDateString("fr-FR") }, 1);
    },
    onSuccess: () => { toast.success("Job de test créé"); qc.invalidateQueries({ queryKey: ["print-jobs"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const clearDone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("print_jobs").delete().in("status", ["printed", "error"]);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Historique vidé"); qc.invalidateQueries({ queryKey: ["print-jobs"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("print_jobs").delete().not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("File entièrement vidée"); qc.invalidateQueries({ queryKey: ["print-jobs"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });


  function downloadPdf(j: any) {
    if (!j.pdf_base64) return toast.error("Pas de PDF disponible");
    const bin = atob(j.pdf_base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `etiquette-${(j.label_data as any)?.id ?? j.id}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Impression</h1>
      <p className="text-muted-foreground mb-6">File d'impression vers la Brother QL-810Wc. Pilotée par un agent local connecté au NAS / Home Assistant.</p>

      <Accordion type="single" collapsible className="mb-6 border rounded-xl bg-card">
        <AccordionItem value="how" className="border-0">
          <AccordionTrigger className="px-4">Comment fonctionne l'impression ?</AccordionTrigger>
          <AccordionContent className="px-4 space-y-4 text-sm">
            <div>
              <p className="font-semibold mb-1">1. L'application met les étiquettes en file d'attente</p>
              <p className="text-muted-foreground">
                À chaque enregistrement avec étiquette, l'app génère un PDF calibré au mm et crée une ligne dans la table <code className="text-xs bg-muted px-1 rounded">print_jobs</code> avec le statut <code className="text-xs bg-muted px-1 rounded">pending</code>.
              </p>
            </div>

            <div>
              <p className="font-semibold mb-1">2. Un agent local consomme la file</p>
              <p className="text-muted-foreground">
                L'agent (Node.js / Python / add-on Home Assistant) tourne en permanence sur le NAS ou Home Assistant et scrute la file toutes les quelques secondes. Quand il trouve un job pending, il télécharge le PDF, l'envoie à la Brother QL-810Wc via son IP WiFi, puis met le statut à <code className="text-xs bg-muted px-1 rounded">printed</code> ou <code className="text-xs bg-muted px-1 rounded">error</code>.
              </p>
            </div>

            <div>
              <p className="font-semibold mb-1">3. Heartbeat de l'agent</p>
              <p className="text-muted-foreground">
                Toutes les 20 secondes, l'agent met à jour la table <code className="text-xs bg-muted px-1 rounded">agent_status</code> (champ <code className="text-xs bg-muted px-1 rounded">last_seen</code>). Le tableau de bord affiche une icône imprimante verte si le dernier ping date de moins de 60 s, sinon rouge.
              </p>
            </div>

            <div>
              <p className="font-semibold mb-1">4. Démarrage à la demande</p>
              <p className="text-muted-foreground">
                Si l'icône est rouge, un clic dessus envoie un POST à <code className="text-xs bg-muted px-1 rounded">https://serpolet.eu/api/webhook/start_print_agent</code>. Home Assistant reçoit le webhook et déclenche le démarrage du conteneur agent sur le NAS via SSH/automation.
              </p>
            </div>

            <div>
              <p className="font-semibold mb-1">5. NAS + Home Assistant</p>
              <ul className="text-muted-foreground space-y-1 list-disc pl-5">
                <li><strong>NAS</strong> : héberge l'agent dans un conteneur Docker. Sur le même WiFi que la QL-810W.</li>
                <li><strong>Home Assistant</strong> (serpolet.eu) : expose le webhook public et orchestre le démarrage / arrêt de l'agent.</li>
                <li><strong>Brother QL-810W</strong> : imprimante thermique pilotée par son IP WiFi.</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold mb-2">Fichiers de programmation</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <a href="/print-agent.zip" download className="border rounded-md p-3 hover:bg-muted text-xs">
                  <p className="font-medium">Agent Node.js (.zip)</p>
                  <p className="text-muted-foreground">PC + Sumatra PDF</p>
                </a>
                <a href="/print-agent-py/README.md" target="_blank" rel="noreferrer" className="border rounded-md p-3 hover:bg-muted text-xs">
                  <p className="font-medium">Agent Python</p>
                  <p className="text-muted-foreground">IP directe WiFi (recommandé)</p>
                </a>
                <a href="/ha-addon/README.md" target="_blank" rel="noreferrer" className="border rounded-md p-3 hover:bg-muted text-xs">
                  <p className="font-medium">Add-on Home Assistant</p>
                  <p className="text-muted-foreground">stockjp-print</p>
                </a>
                <a href="/print-agent/agent.mjs" target="_blank" rel="noreferrer" className="border rounded-md p-3 hover:bg-muted text-xs">
                  <p className="font-medium">Source agent.mjs</p>
                  <p className="text-muted-foreground">Code de l'agent Node</p>
                </a>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <h2 className="font-semibold mb-3 flex items-center justify-between">
        <span>File ({jobs.length})</span>
        <Button size="sm" variant="outline" onClick={() => createTest.mutate()} disabled={createTest.isPending}>
          <FlaskConical className="h-4 w-4 mr-1" /> Créer un job de test
        </Button>
      </h2>
      <div className="space-y-2">
        {jobs.length === 0 && <p className="text-muted-foreground text-sm">Aucun travail d'impression.</p>}
        {jobs.map((j: any) => (
          <div key={j.id} className="flex items-center justify-between border rounded-md p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-muted-foreground" />
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
