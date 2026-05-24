import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateLabelPdf, formatSize, type LabelData } from "@/lib/print";
import { LabelPreviewInline } from "@/components/LabelPreviewInline";
import { Download, X } from "lucide-react";

export function LabelPreviewDialog({
  open, onClose, fmt, data,
}: {
  open: boolean;
  onClose: () => void;
  fmt: string;
  data: LabelData;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const { w, h } = formatSize(fmt);

  useEffect(() => {
    if (!open) return;
    let revoke: string | null = null;
    (async () => {
      const b64 = await generateLabelPdf(fmt, data, 1);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const u = URL.createObjectURL(blob);
      revoke = u;
      setUrl(u);
    })();
    return () => { if (revoke) URL.revokeObjectURL(revoke); setUrl(null); };
  }, [open, fmt, data]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aperçu étiquette {w}×{h} mm</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <LabelPreviewInline fmt={fmt} data={data} scale={6} />
          <p className="text-xs text-muted-foreground">
            Échelle réelle (1&nbsp;mm ≈ 6&nbsp;px). Cadre pointillé = bord physique de l'étiquette.
          </p>
        </div>
        <DialogFooter>
          {url && (
            <a href={url} download={`apercu-${data.id}.pdf`}>
              <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Télécharger le PDF</Button>
            </a>
          )}
          <Button onClick={onClose}><X className="mr-2 h-4 w-4" /> Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
