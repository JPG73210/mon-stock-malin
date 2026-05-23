import { useEffect, useState } from "react";
import { generateLabelPdf, formatSize, type LabelData } from "@/lib/print";

/** Aperçu inline (non modal) de l'étiquette qui sera imprimée. */
export function LabelPreviewInline({
  fmt, data, scale = 5,
}: { fmt: string; data: LabelData; scale?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const { w, h } = formatSize(fmt);

  useEffect(() => {
    if (fmt === "Pas d'étiquettes") { setUrl(null); return; }
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const b64 = await generateLabelPdf(fmt, data, 1);
        if (cancelled) return;
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const u = URL.createObjectURL(blob);
        revoke = u;
        setUrl(u);
      } catch { setUrl(null); }
    })();
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmt, JSON.stringify(data)]);

  if (fmt === "Pas d'étiquettes") {
    return (
      <div className="rounded-md border-2 border-dashed p-4 text-center text-xs text-muted-foreground">
        Aucune étiquette ne sera imprimée (format « Pas d'étiquettes »).
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="border-2 border-dashed border-primary/40 bg-white overflow-hidden shadow-sm"
        style={{ width: w * scale, height: h * scale }}
      >
        {url && (
          <iframe
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
            title="Aperçu étiquette"
            className="w-full h-full"
            style={{ border: 0 }}
          />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Aperçu {w}×{h} mm</p>
    </div>
  );
}
