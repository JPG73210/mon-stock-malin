import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

/**
 * Formats étiquettes Brother QL-810Wc — calés sur les références DK officielles.
 *  - "23x23"  → DK-11221 (pré-découpée carrée 23×23 mm)
 *  - "17x54"  → DK-11204 (pré-découpée 17×54 mm — adresse standard)
 *  - "62x29"  → DK-11209 (pré-découpée 29×62 mm — petite adresse)
 *  - "62x100" → DK-11202 (pré-découpée 62×100 mm — expédition)
 *  - "62"     → DK-44205 (rouleau CONTINU amovible, largeur 62 mm).
 *               Longueur logicielle = 30 mm (modifiable dans ROLL_SPECS).
 */
export type LabelFormat = "23x23" | "17x54" | "62x29" | "62x100" | "62";

export type LabelData = {
  id: string;
  produit?: string;
  animal?: string;
  fruit?: string;
  bague?: string;
  date?: string;
  poids?: number | string;
  unite?: string;
};

export const ROLL_SPECS: Record<LabelFormat, {
  dk: string;
  label: string;
  mediaWidth: number;   // largeur physique du média (mm)
  mediaHeight: number;  // hauteur de l'étiquette (mm, axe d'avance papier)
  printable: { w: number; h: number };
  continuous: boolean;
  cupsMedia: string;    // option `lp -o media=` pour CUPS
}> = {
  "23x23":  { dk: "DK-11221", label: "Carrée 23×23",      mediaWidth: 23, mediaHeight: 23,  printable: { w: 23, h: 23  }, continuous: false, cupsMedia: "Custom.23x23mm"  },
  "17x54":  { dk: "DK-11204", label: "17×54 adresse",     mediaWidth: 17, mediaHeight: 54,  printable: { w: 54, h: 17  }, continuous: false, cupsMedia: "Custom.17x54mm"  },
  "62x29":  { dk: "DK-11209", label: "29×62 petite adr.", mediaWidth: 62, mediaHeight: 29,  printable: { w: 62, h: 29  }, continuous: false, cupsMedia: "Custom.29x62mm"  },
  "62x100": { dk: "DK-11202", label: "62×100 expédition", mediaWidth: 62, mediaHeight: 100, printable: { w: 62, h: 100 }, continuous: false, cupsMedia: "Custom.62x100mm" },
  "62":     { dk: "DK-44205", label: "Continu 62 mm (30 mm)", mediaWidth: 62, mediaHeight: 30, printable: { w: 62, h: 30 }, continuous: true, cupsMedia: "Custom.62x30mm" },
};

function normalizeFormat(fmt: string): LabelFormat {
  const f = (fmt ?? "").trim();
  if (f === "62" || f === "30x62" || f === "62x30") return "62";
  if (f === "62x29" || f === "29x62") return "62x29";
  if (f === "62x100" || f === "100x62") return "62x100";
  if (f === "17x54" || f === "54x17") return "17x54";
  if (f === "23x23") return "23x23";
  return "62";
}

export function formatSize(fmt: string): { w: number; h: number } {
  const s = ROLL_SPECS[normalizeFormat(fmt)];
  return { w: s.printable.w, h: s.printable.h };
}

export function rollSpec(fmt: string) {
  return ROLL_SPECS[normalizeFormat(fmt)];
}

/** Génère un PDF base64 (sans préfixe data:) calibré au mm. */
export async function generateLabelPdf(
  fmt: LabelFormat | string,
  data: LabelData,
  quantite = 1,
): Promise<string> {
  const { w, h } = formatSize(fmt);
  const doc = new jsPDF({ unit: "mm", format: [w, h], orientation: w > h ? "landscape" : "portrait" });
  const payload = JSON.stringify({
    id: data.id, produit: data.produit, animal: data.animal, fruit: data.fruit,
    bague: data.bague, date: data.date, poids: data.poids, unite: data.unite,
  });
  const qrPx = Math.round(Math.min(w, h) * 8); // ~8px/mm
  const qr = await QRCode.toDataURL(payload, { width: qrPx, margin: 0 });

  for (let i = 0; i < quantite; i++) {
    if (i > 0) doc.addPage([w, h], w > h ? "landscape" : "portrait");
    const pad = 1;
    const portrait = h > w * 1.4; // tall labels → QR en haut, texte en bas
    const square   = Math.abs(w - h) < 2; // labels carrés → QR seul

    // QR : toujours carré, jamais distordu.
    const qrMax = portrait
      ? Math.min(w - pad * 2, h * 0.6)
      : Math.min(w * 0.5, h - pad * 2);
    const qrSize = square ? Math.min(w, h) - pad * 2 : qrMax;
    const qx = portrait ? (w - qrSize) / 2 : pad;
    const qy = pad;
    doc.addImage(qr, "PNG", qx, qy, qrSize, qrSize);

    if (square) continue; // 23×23 : QR seul, aucun texte (illisible sinon).

    // Zone texte
    const tx = portrait ? pad : qrSize + pad * 2;
    const ty = portrait ? qy + qrSize + pad + 2.6 : pad + 2.6;
    const tw = portrait ? w - pad * 2 : w - tx - pad;
    let y = ty;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(portrait ? 11 : 8);
    doc.text(data.id, tx, y, { maxWidth: tw });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(portrait ? 8 : 6);
    const lh = portrait ? 3.6 : 2.4;
    y += portrait ? 4 : 2.6;
    const l1 = [data.produit, data.animal, data.fruit].filter(Boolean).join(" / ");
    if (l1) { doc.text(l1, tx, y, { maxWidth: tw }); y += lh; }
    const l2 = [data.poids ? `${data.poids} ${data.unite ?? ""}`.trim() : "", data.bague ? `Bague ${data.bague}` : ""].filter(Boolean).join(" · ");
    if (l2) { doc.text(l2, tx, y, { maxWidth: tw }); y += lh; }
    if (data.date) doc.text(String(data.date), tx, y, { maxWidth: tw });
  }
  const ab = doc.output("arraybuffer");
  const bytes = new Uint8Array(ab);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Génère le PDF et déclenche la boîte d'impression du navigateur (AirPrint). */
export async function printLabelAirprint(
  fmt: LabelFormat | string,
  data: LabelData,
  quantite = 1,
) {
  const b64 = await generateLabelPdf(fmt, data, quantite);
  const blob = b64ToBlob(b64, "application/pdf");
  const url = URL.createObjectURL(blob);

  // 1) Tente d'ouvrir dans un iframe caché pour appeler print() directement
  //    (contourne le blocage des pop-ups sur iOS/Safari).
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // 2) Fallback : téléchargement explicite que l'utilisateur ouvre puis Partager → Imprimer.
      const a = document.createElement("a");
      a.href = url;
      a.download = `etiquette-${data.id}.pdf`;
      a.click();
    }
  };
  setTimeout(() => {
    URL.revokeObjectURL(url);
    iframe.remove();
  }, 120_000);
}

/** Téléchargement direct du PDF (utile si l'iframe est bloquée). */
export async function downloadLabelPdf(
  fmt: LabelFormat | string,
  data: LabelData,
  quantite = 1,
) {
  const b64 = await generateLabelPdf(fmt, data, quantite);
  const blob = b64ToBlob(b64, "application/pdf");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `etiquette-${data.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Pousse un job d'impression dans la file (consommée par l'agent local). */
export async function enqueuePrintJob(
  fmt: LabelFormat | string,
  data: LabelData,
  quantite = 1,
  printerName?: string,
) {
  const pdf_base64 = await generateLabelPdf(fmt, data, quantite);
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Non authentifié");
  const { error } = await supabase.from("print_jobs").insert({
    user_id: user.user.id,
    format: fmt,
    label_data: { ...data, quantite } as any,
    pdf_base64,
    printer_name: printerName ?? null,
    status: "pending",
  });
  if (error) throw error;
}

function b64ToBlob(b64: string, type: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
