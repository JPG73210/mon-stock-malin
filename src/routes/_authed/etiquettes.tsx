import { createFileRoute } from "@tanstack/react-router";
import { LabelPreviewInline } from "@/components/LabelPreviewInline";
import { ETIQUETTE_FORMATS } from "@/lib/constants";
import { rollSpec, enqueuePrintJob } from "@/lib/print";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/etiquettes")({
  component: EtiquettesPage,
});

const DEMO = {
  id: "25-SP-001",
  produit: "Saucisson",
  animal: "Porc",
  fruit: "",
  bague: "FR123456",
  date: "2025-11",
  poids: 250,
  unite: "Gr",
};

function EtiquettesPage() {
  const HIDDEN = new Set(["62x29", "62x100"]);
  const formats = ETIQUETTE_FORMATS.filter((f) => f !== "Pas d'étiquettes" && !HIDDEN.has(f));

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Modèles d'étiquettes</h1>
      <p className="text-muted-foreground mb-6">
        Aperçu de tous les formats disponibles avec un produit fictif. Les modèles se mettent à jour automatiquement.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        {formats.map((fmt) => {
          const spec = rollSpec(fmt);
          return (
            <div key={fmt} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{spec.label}</p>
                  <p className="text-xs text-muted-foreground">{spec.dk} · {spec.mediaWidth}×{spec.mediaHeight} mm</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await enqueuePrintJob(fmt, DEMO, 1);
                      toast.success(`Impression ${spec.label} envoyée`);
                    } catch (e: any) {
                      toast.error(e?.message ?? "Erreur impression");
                    }
                  }}
                >
                  <Printer className="mr-1 h-4 w-4" /> Imprimer
                </Button>
              </div>
              <div className="flex justify-center bg-muted/30 rounded p-3">
                <LabelPreviewInline fmt={fmt} data={DEMO} scale={5} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
