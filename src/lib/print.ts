import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

export type LabelFormat = "23x23" | "17x54" | "30x62";

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

export function formatSize(fmt: string): { w: number; h: number } {
  if (fmt === "23x23") return { w: 23, h: 23 };
  if (fmt === "17x54") return { w: 54, h: 17 };
  return { w: 62, h: 30 }; // 30x62 (rouleau continu DK-44205)
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
    const qrSize = h - pad * 2;
    doc.addImage(qr, "PNG", pad, pad, qrSize, qrSize);
    const tx = qrSize + pad * 2;
    const tw = w - tx - pad;
    let y = pad + 2.6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(data.id, tx, y, { maxWidth: tw });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    y += 2.6;
    const l1 = [data.produit, data.animal, data.fruit].filter(Boolean).join(" / ");
    if (l1) { doc.text(l1, tx, y, { maxWidth: tw }); y += 2.4; }
    const l2 = [data.poids ? `${data.poids} ${data.unite ?? ""}`.trim() : "", data.bague ? `Bague ${data.bague}` : ""].filter(Boolean).join(" · ");
    if (l2) { doc.text(l2, tx, y, { maxWidth: tw }); y += 2.4; }
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
