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
    const square   = Math.abs(w - h) < 2; // labels carrés (23×23) → QR + animal + ID compact

    // QR : toujours carré, jamais distordu.
    // 62×30 (continu) → QR réduit d'1/3 (étiquette spécifiquement étroite).
    // Autres landscape (17×54, 62×29…) → QR = pleine hauteur pour libérer texte.
    const isReducedRoll = Math.abs(w - 62) < 0.5 && Math.abs(h - 30) < 0.5;
    const qrLandscapeFull = Math.min(w * 0.5, h - pad * 2);
    const qrLandscape = isReducedRoll ? qrLandscapeFull * (2 / 3) : qrLandscapeFull;
    const qrMax = portrait
      ? Math.min(w - pad * 2, h * 0.6)
      : qrLandscape;
    // 23×23 : QR remonté et agrandi (12 mm) tout en laissant la place au texte.
    const qrSize = square ? 12 : qrMax;
    const qx = square ? 3 : (portrait ? (w - qrSize) / 2 : pad);
    const qy = square ? 6.5 : (portrait ? pad : (h - qrSize) / 2);
    doc.addImage(qr, "PNG", qx, qy, qrSize, qrSize);

    if (square) {
      // 23×23 : ID au-dessus du QR — gras 10pt.
      if (data.id) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(String(data.id), 3, 5.2, { maxWidth: w - 6 });
      }
      // Animal : horizontal, centré sous le QR, gras 10pt.
      if (data.animal) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(String(data.animal), w / 2, h - 2, {
          align: "center",
          maxWidth: w - 2,
        });
      }
      continue;
    }


    // Zone texte — occupe TOUT l'espace restant à droite du QR.
    const tx = portrait ? pad : qx + qrSize + pad * 1.5;
    const ty = portrait ? qy + qrSize + pad + 2.6 : pad + 3;
    const tw = portrait ? w - pad * 2 : w - tx - pad;
    const th = portrait ? h - ty - pad : h - pad * 2;
    let y = ty;

    // Tailles dimensionnées en fonction de la hauteur réellement disponible :
    // étiquettes étroites comme 17×54 → texte agrandi pour remplir le ruban.
    const tall = th >= 25;            // 62×30, 62×29 → 3-4 lignes confortables
    const titleSize = portrait ? 11 : (tall ? 10 : 9);
    const bodySize = portrait ? 8 : (tall ? 7.5 : 7);
    const lh = portrait ? 3.6 : (tall ? 3.4 : 3.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleSize);
    if (data.id) { doc.text(String(data.id), tx, y, { maxWidth: tw }); }
    y += lh + 0.4;

    // produit + animal : taille DOUBLÉE sur 62×30 et 17×54 (rouleaux étroits)
    // pour maximiser la lisibilité à distance.
    const isWide62x30 = isReducedRoll;
    const isNarrow17x54 = Math.abs(w - 54) < 0.5 && Math.abs(h - 17) < 0.5;
    const boostProductAnimal = isWide62x30 || isNarrow17x54;
    const productAnimalSize = boostProductAnimal ? bodySize * 2 : bodySize;
    const productAnimalLh = boostProductAnimal ? lh * 1.9 : lh;

    const pa = [data.produit, data.animal].filter((v) => v != null && String(v).trim() !== "").join(" / ");
    if (pa) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(productAnimalSize);
      doc.text(pa, tx, y, { maxWidth: tw });
      y += productAnimalLh;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    if (data.fruit && String(data.fruit).trim() !== "") {
      doc.text(String(data.fruit), tx, y, { maxWidth: tw }); y += lh;
    }
    const poidsTxt = data.poids != null && String(data.poids).trim() !== "" ? `${data.poids} ${data.unite ?? ""}`.trim() : "";
    const bagueTxt = data.bague && String(data.bague).trim() !== "" ? `Bague ${data.bague}` : "";
    const l2 = [poidsTxt, bagueTxt].filter(Boolean).join(" · ");
    if (l2) { doc.text(l2, tx, y, { maxWidth: tw }); y += lh; }
    if (data.date && String(data.date).trim() !== "") doc.text(String(data.date), tx, y, { maxWidth: tw });
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
/** Partage le PDF vers une app native (iPrint&Label sur Android/iOS). */
export async function shareLabelPdf(
  fmt: LabelFormat | string,
  data: LabelData,
  quantite = 1,
): Promise<boolean> {
  const b64 = await generateLabelPdf(fmt, data, quantite);
  const blob = b64ToBlob(b64, "application/pdf");
  const file = new File([blob], `etiquette-${data.id}.pdf`, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `Étiquette ${data.id}` });
      return true;
    } catch (e: any) {
      if (e?.name === "AbortError") return false;
      throw e;
    }
  }
  // Fallback : téléchargement (l'utilisateur ouvre ensuite avec iPrint&Label)
  await downloadLabelPdf(fmt, data, quantite);
  return true;
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
