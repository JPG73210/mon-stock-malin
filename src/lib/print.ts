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
export type LabelFormat = "23x23" | "23x23v" | "17x54" | "62x29" | "62x100" | "62";

export type LabelData = {
  id: string;
  produit?: string;
  animal?: string;
  fruit?: string;
  bague?: string;
  date?: string;
  poids?: number | string;
  unite?: string;
  version?: string;
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
  "23x23":  { dk: "DK-11221", label: "Carrée 23×23",         mediaWidth: 23, mediaHeight: 23,  printable: { w: 23, h: 23  }, continuous: false, cupsMedia: "Custom.23x23mm"  },
  "23x23v": { dk: "DK-11221", label: "Carrée 23×23 (vin)",   mediaWidth: 23, mediaHeight: 23,  printable: { w: 23, h: 23  }, continuous: false, cupsMedia: "Custom.23x23mm"  },
  "17x54":  { dk: "DK-11204", label: "54×17 paysage",        mediaWidth: 54, mediaHeight: 17,  printable: { w: 54, h: 17  }, continuous: false, cupsMedia: "Custom.54x17mm"  },
  "62x29":  { dk: "DK-11209", label: "29×62 petite adr.",    mediaWidth: 62, mediaHeight: 29,  printable: { w: 62, h: 29  }, continuous: false, cupsMedia: "Custom.29x62mm"  },
  "62x100": { dk: "DK-11202", label: "62×100 expédition",    mediaWidth: 62, mediaHeight: 100, printable: { w: 62, h: 100 }, continuous: false, cupsMedia: "Custom.62x100mm" },
  "62":     { dk: "DK-44205", label: "Continu 62 mm (25 mm)", mediaWidth: 62, mediaHeight: 25, printable: { w: 62, h: 25 }, continuous: true, cupsMedia: "Custom.62x25mm" },
};

function normalizeFormat(fmt: string): LabelFormat {
  const f = (fmt ?? "").trim();
  if (f === "62" || f === "30x62" || f === "62x30") return "62";
  if (f === "62x29" || f === "29x62") return "62x29";
  if (f === "62x100" || f === "100x62") return "62x100";
  if (f === "17x54" || f === "54x17") return "17x54";
  if (f === "23x23v") return "23x23v";
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
  const qrPx = Math.max(512, Math.round(Math.min(w, h) * 32)); // ~32 px/mm pour modules nets
  const qr = await QRCode.toDataURL(payload, { width: qrPx, margin: 0 });

  for (let i = 0; i < quantite; i++) {
    if (i > 0) doc.addPage([w, h], w > h ? "landscape" : "portrait");
    const pad = 1;
    const portrait = h > w * 1.4; // tall labels → QR en haut, texte en bas
    const square   = Math.abs(w - h) < 2; // labels carrés (23×23) → QR + animal + ID compact
    const isWineSquare = normalizeFormat(fmt) === "23x23v";

    // Cas spécial : 23×23 vin — QR centré tout seul, prend toute la place.
    if (isWineSquare) {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, w, h, "F");
      const qrSide = Math.min(w, h) - pad * 2;
      const qrx = (w - qrSide) / 2;
      const qry = (h - qrSide) / 2;
      doc.addImage(qr, "PNG", qrx, qry, qrSide, qrSide);
      continue;
    }

    // QR : toujours carré, jamais distordu.
    // 62×25 (continu) → layout dédié ci-dessous (QR redessiné, on saute le calcul générique).
    // Autres landscape (17×54, 62×29…) → QR = pleine hauteur pour libérer texte.
    const isReducedRoll = Math.abs(w - 62) < 0.5 && Math.abs(h - 25) < 0.5;
    const qrLandscape = Math.min(w * 0.5, h - pad * 2);
    const qrMax = portrait
      ? Math.min(w - pad * 2, h * 0.6)
      : qrLandscape;
    // 17×54 paysage : QR centré à gauche (côté 17 mm), 2 lignes texte à droite.
    const isNarrow17x54 = Math.abs(w - 54) < 0.5 && Math.abs(h - 17) < 0.5;
    const qrSize = square ? 15.5 : (isNarrow17x54 ? Math.min(h - pad * 2, 15) : qrMax);
    const qx = square ? (w - qrSize) / 2 : (portrait ? (w - qrSize) / 2 : pad);
    const qy = square ? 4 : (portrait ? pad : (h - qrSize) / 2);
    doc.addImage(qr, "PNG", qx, qy, qrSize, qrSize);


    if (square) {
      // 23×23 : ID au-dessus du QR — gras, taille max.
      if (data.id) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(String(data.id), w / 2, 3.3, { align: "center", baseline: "alphabetic", maxWidth: w });
      }
      // Animal : horizontal, centré sous le QR, gras.
      if (data.animal) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(String(data.animal), w / 2, h - 0.5, {
          align: "center",
          maxWidth: w,
        });
      }
      continue;
    }

    if (isNarrow17x54) {
      // Repartir d'une page blanche (le QR initial était centré, on le redessine)
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, w, h, "F");

      // QR — compense la distorsion d'impression (sortie mesurée 13w × 11h
      // pour un PDF carré). On largue la largeur en conséquence.
      const qrH = h - pad * 2 - 1;        // 14 mm de haut
      const qrW = qrH * (11 / 13);        // ≈ 11.85 mm de large
      const qrX = pad;
      const qrY = (h - qrH) / 2;
      doc.addImage(qr, "PNG", qrX, qrY, qrW, qrH);

      const qrL = qrW; // pour le calcul de la zone texte ci-dessous

      // Zone texte à droite du QR
      const tx = qrX + qrL + 1.2;
      const tw = w - tx - pad;

      const id = data.id ? String(data.id) : "";
      const version = data.version ? String(data.version) : "";
      const secondary = data.animal || data.fruit;
      const parts = [data.produit, secondary]
        .filter((v) => v != null && String(v).trim() !== "")
        .map(String);
      const line2 = parts.join(" · ");

      // Plus grande taille égale qui rentre en largeur et hauteur
      const fits = (s: number) => {
        doc.setFont("helvetica", "bold"); doc.setFontSize(s);
        const idW = id ? doc.getTextWidth(id) : 0;
        const line2W = line2 ? doc.getTextWidth(line2) : 0;
        doc.setFont("helvetica", "normal"); doc.setFontSize(s);
        const verW = version ? doc.getTextWidth(version) : 0;
        const l1W = idW + (id && version ? s * 0.25 : 0) + verW;
        if (l1W > tw) return false;
        if (line2W > tw) return false;
        const total = s * 0.42 * 2 + s * 0.25;
        return total <= h - pad * 2;
      };
      let s = 14;
      while (s > 4 && !fits(s)) s -= 0.25;

      // Ligne 1 : ID (gras) + version (normal)
      doc.setFont("helvetica", "bold"); doc.setFontSize(s);
      const idW = id ? doc.getTextWidth(id) : 0;
      const y1 = pad + s * 0.42 + 0.6;
      if (id) doc.text(id, tx, y1);
      if (version) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(s);
        doc.text(version, tx + idW + (id ? s * 0.25 : 0), y1);
      }

      // Ligne 2 : produit · animal/fruit
      if (line2) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(s);
        const y2 = h - pad - 0.6;
        doc.text(line2, tx, y2);
      }
      continue;
    }

    if (isReducedRoll) {
      // 62×25 : page blanche, on redessine tout (ID en haut-gauche, QR dessous, 4 lignes à droite).
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, w, h, "F");

      const id = data.id ? String(data.id) : "";
      const produit = data.produit ? String(data.produit) : "";
      const secondary = [data.animal, data.fruit]
        .filter((v) => v != null && String(v).trim() !== "")
        .map(String).join(" / ");
      const poidsTxt = data.poids != null && String(data.poids).trim() !== ""
        ? `${data.poids} ${data.unite ?? ""}`.trim() : "";
      const bagueTxt = data.bague && String(data.bague).trim() !== "" ? `${data.bague}` : "";
      const rLines = [produit, secondary, poidsTxt, bagueTxt];

      const availH = h - pad * 2;
      const topLineH = availH / 4; // hauteur réservée à l'ID/QR en haut
      const idToQrGap = 1.8; // espace ID → QR (mm)
      const qrSize = availH - topLineH - idToQrGap - 0.5;

      // Lignes non vides uniquement → elles partagent l'espace disponible.
      const filled = rLines.filter((l) => l && l.trim() !== "");
      const nLines = Math.max(1, filled.length);

      // Largeur dispo pour le bloc texte (à droite du QR).
      const leftW = qrSize; // ID en haut-gauche n'élargit pas la colonne de droite
      const txLeft = pad + leftW + 1.2;
      const txRight = w - pad;
      const txAreaW = txRight - txLeft;
      const txCenter = (txLeft + txRight) / 2;
      const blockH = availH; // les lignes occupent toute la hauteur de l'étiquette

      const lineH = blockH / nLines;

      const fits = (sz: number) => {
        // hauteur de ligne suffisante
        if (sz * 0.42 > lineH - 0.5) return false;
        doc.setFont("helvetica", "bold"); doc.setFontSize(sz);
        for (const ln of filled) {
          if (doc.getTextWidth(ln) > txAreaW) return false;
        }
        return true;
      };
      let sz = 24;
      while (sz > 5 && !fits(sz)) sz -= 0.25;

      // ID en haut à gauche (taille indépendante, calée sur la ligne du haut)
      const idSize = Math.min(sz, 12);
      doc.setFont("helvetica", "bold"); doc.setFontSize(idSize);
      if (id) doc.text(id, pad, pad + idSize * 0.42 + 0.2);

      // QR sous l'ID, aligné à gauche
      const qrX = pad;
      const qrY = pad + topLineH + idToQrGap;
      doc.addImage(qr, "PNG", qrX, qrY, qrSize, qrSize);

      // Lignes à droite — centrées horizontalement et verticalement réparties
      doc.setFont("helvetica", "bold"); doc.setFontSize(sz);
      for (let li = 0; li < nLines; li++) {
        const ln = filled[li];
        const yL = pad + lineH * li + lineH / 2 + sz * 0.42 / 2 - 0.2;
        doc.text(ln, txCenter, yL, { align: "center" });
      }
      continue;
    }


    // Zone texte — occupe TOUT l'espace restant à droite du QR.
    const tx = portrait ? pad : qx + qrSize + pad * 1.5;
    const ty = portrait ? qy + qrSize + pad + 2.6 : pad + 3;
    const tw = portrait ? w - pad * 2 : w - tx - pad;
    const th = portrait ? h - ty - pad : h - pad * 2;
    let y = ty;

    const tall = th >= 25;
    const titleSize = portrait ? 11 : (tall ? 10 : 9);
    const bodySize = portrait ? 8 : (tall ? 7.5 : 7);
    const lh = portrait ? 3.6 : (tall ? 3.4 : 3.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(titleSize);
    if (data.id) { doc.text(String(data.id), tx, y, { maxWidth: tw }); }
    y += lh + 0.4;

    const pa = [data.produit, data.animal].filter((v) => v != null && String(v).trim() !== "").join(" / ");
    if (pa) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(bodySize);
      doc.text(pa, tx, y, { maxWidth: tw });
      y += lh;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodySize);
    if (data.fruit && String(data.fruit).trim() !== "") {
      doc.text(String(data.fruit), tx, y, { maxWidth: tw }); y += lh;
    }
    const poidsTxt = data.poids != null && String(data.poids).trim() !== "" ? `${data.poids} ${data.unite ?? ""}`.trim() : "";
    const bagueTxt = data.bague && String(data.bague).trim() !== "" ? `${data.bague}` : "";
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
