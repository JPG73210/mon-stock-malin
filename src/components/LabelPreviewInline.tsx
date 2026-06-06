import { useEffect, useRef, useState } from "react";
import { generateLabelPdf, formatSize, type LabelData } from "@/lib/print";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - worker URL import
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/** Aperçu inline (non modal) de l'étiquette qui sera imprimée — rendu via canvas pdfjs. */
export function LabelPreviewInline({
  fmt, data, scale = 5,
}: { fmt: string; data: LabelData; scale?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState(false);
  const sz = formatSize(fmt);
  // Pour le 29×50, le PDF est généré en paysage 50×29 — on aligne l'aperçu.
  const isGrandFroid = (sz.w === 29 && sz.h === 50) || (sz.w === 50 && sz.h === 29);
  const w = isGrandFroid ? 50 : sz.w;
  const h = isGrandFroid ? 29 : sz.h;

  useEffect(() => {
    if (fmt === "Pas d'étiquettes") return;
    let cancelled = false;
    setErr(false);
    (async () => {
      try {
        const b64 = await generateLabelPdf(fmt, data, 1);
        if (cancelled) return;
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        const dpr = window.devicePixelRatio || 1;
        // Le PDF est en mm — un point PDF = 1/72 inch, et 1 mm ≈ 2.83465 pt.
        // On veut afficher w*scale × h*scale CSS pixels.
        const cssW = w * scale;
        const cssH = h * scale;
        const baseVp = page.getViewport({ scale: 1 });
        const renderScale = (cssW / baseVp.width) * dpr;
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
      } catch (e) {
        console.error("PDF preview render error", e);
        if (!cancelled) setErr(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fmt, JSON.stringify(data), scale]);

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
        className="border-2 border-dashed border-primary/40 bg-white overflow-hidden shadow-sm flex items-center justify-center"
        style={{ width: w * scale, height: h * scale }}
      >
        {err ? (
          <span className="text-[10px] text-destructive">Aperçu indisponible</span>
        ) : (
          <canvas ref={canvasRef} />
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">Aperçu {w}×{h} mm</p>
    </div>
  );
}
