import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";

/** Format A4 portrait en mm. */
const A4 = { w: 210, h: 297 };
const MARGIN = 12;

type Product = {
  code: string;
  produit?: string;
  animal?: string;
  fruit?: string;
  poids?: number | string | null;
  unite_poids?: string | null;
  date_creation?: string | null;
  bague?: string | null;
  emplacement: string;
  version?: string | null;
  quantite?: number | null;
  notes?: string | null;
};

type Wine = {
  id: string;
  chateau?: string | null;
  type_vin?: string | null;
  couleur?: string | null;
  millesime?: number | null;
  emplacement: string;
  quantite?: number | null;
  medailles?: string[] | null;
  code_barre?: string | null;
  photo_url?: string | null;
  notes?: string | null;
};

function groupBy<T extends { emplacement: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = it.emplacement || "(sans emplacement)";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

async function qrDataUrl(payload: string) {
  return QRCode.toDataURL(payload, { width: 256, margin: 2 });
}

/** Charge la photo Supabase et retourne un data URL JPEG, ou null. */
async function fetchPhoto(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from("wine-photos").createSignedUrl(path, 600);
    if (!data?.signedUrl) return null;
    const res = await fetch(data.signedUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

function todayStr() {
  const d = new Date();
  return d.toLocaleDateString("fr-FR");
}

/* =====================================================================
 * PRODUITS — A4 portrait, groupé par emplacement.
 * Tableau : QR | ID | Produit | Animal/Fruit | Poids | Date | Bague | Version | Qté | Notes
 * ===================================================================== */
export async function printStockProductsA4(products: Product[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const groups = groupBy(products);

  // colonnes (mm) — somme = 210 - 2*MARGIN = 186
  const cols: { key: string; label: string; w: number }[] = [
    { key: "qr",    label: "QR",          w: 16 },
    { key: "code",  label: "ID",          w: 20 },
    { key: "prod",  label: "Produit",     w: 30 },
    { key: "sec",   label: "Animal/Fruit",w: 24 },
    { key: "poids", label: "Poids",       w: 16 },
    { key: "date",  label: "Date",        w: 18 },
    { key: "bag",   label: "N° Bague",    w: 18 },
    { key: "ver",   label: "Ver.",        w: 10 },
    { key: "qte",   label: "Qté",         w: 10 },
    { key: "notes", label: "Notes",       w: 24 },
  ];
  const rowH = 18;          // hauteur d'une ligne (assez grande pour le QR 16 mm)
  const headerH = 7;

  let first = true;
  for (const [emp, items] of groups) {
    if (!first) doc.addPage("a4", "portrait");
    first = false;
    await renderProductsPage(doc, emp, items, cols, rowH, headerH);
  }

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // fallback : téléchargement
    const a = document.createElement("a");
    a.href = url; a.download = `stock-${todayStr()}.pdf`; a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function renderProductsPage(
  doc: jsPDF, emp: string, items: Product[],
  cols: { key: string; label: string; w: number }[],
  rowH: number, headerH: number,
) {
  let y = MARGIN;
  doc.setFont("helvetica", "bold"); doc.setFontSize(14);
  doc.text(`Emplacement : ${emp}`, MARGIN, y + 5);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(`${items.length} produit(s) — ${todayStr()}`, A4.w - MARGIN, y + 5, { align: "right" });
  y += 9;

  drawProductsHeader(doc, y, cols, headerH);
  y += headerH;

  for (const p of items) {
    if (y + rowH > A4.h - MARGIN) {
      doc.addPage("a4", "portrait");
      y = MARGIN;
      doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text(`Emplacement : ${emp} (suite)`, MARGIN, y + 5);
      y += 9;
      drawProductsHeader(doc, y, cols, headerH);
      y += headerH;
    }
    await drawProductRow(doc, p, y, cols, rowH);
    y += rowH;
  }
}

function drawProductsHeader(
  doc: jsPDF, y: number,
  cols: { key: string; label: string; w: number }[], headerH: number,
) {
  doc.setFillColor(230, 230, 230);
  doc.rect(MARGIN, y, A4.w - MARGIN * 2, headerH, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.setTextColor(0);
  let x = MARGIN;
  for (const c of cols) {
    doc.text(c.label, x + 1, y + 4.5);
    x += c.w;
  }
  doc.setDrawColor(180);
  doc.line(MARGIN, y + headerH, A4.w - MARGIN, y + headerH);
}

async function drawProductRow(
  doc: jsPDF, p: Product, y: number,
  cols: { key: string; label: string; w: number }[], rowH: number,
) {
  doc.setDrawColor(220);
  doc.line(MARGIN, y + rowH, A4.w - MARGIN, y + rowH);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(0);

  const secondary = [p.animal, p.fruit].filter(Boolean).join(" / ");
  const poids = p.poids != null && String(p.poids).trim() !== ""
    ? `${p.poids} ${p.unite_poids ?? ""}`.trim() : "";

  const payload = JSON.stringify({
    id: p.code, produit: p.produit, animal: p.animal, bague: p.bague,
    date: p.date_creation, poids: p.poids, unite: p.unite_poids,
  });
  const qr = await qrDataUrl(payload);

  let x = MARGIN;
  for (const c of cols) {
    const cellX = x + 1;
    const cellY = y + 4;
    switch (c.key) {
      case "qr":
        doc.addImage(qr, "PNG", x + 1, y + 1, rowH - 2, rowH - 2);
        break;
      case "code":
        doc.setFont("helvetica", "bold"); doc.setFontSize(8);
        doc.text(String(p.code ?? ""), cellX, cellY, { maxWidth: c.w - 2 });
        doc.setFont("helvetica", "normal");
        break;
      case "prod": writeMulti(doc, p.produit ?? "", cellX, cellY, c.w - 2, rowH); break;
      case "sec":  writeMulti(doc, secondary, cellX, cellY, c.w - 2, rowH); break;
      case "poids": doc.text(poids, cellX, cellY, { maxWidth: c.w - 2 }); break;
      case "date":  doc.text(p.date_creation ?? "", cellX, cellY, { maxWidth: c.w - 2 }); break;
      case "bag":   doc.text(p.bague ?? "", cellX, cellY, { maxWidth: c.w - 2 }); break;
      case "ver":   doc.text(p.version ?? "", cellX, cellY, { maxWidth: c.w - 2 }); break;
      case "qte":   doc.text(String(p.quantite ?? ""), cellX, cellY, { maxWidth: c.w - 2 }); break;
      case "notes": writeMulti(doc, p.notes ?? "", cellX, cellY, c.w - 2, rowH); break;
    }
    x += c.w;
  }
}

function writeMulti(doc: jsPDF, text: string, x: number, y: number, w: number, rowH: number) {
  if (!text) return;
  const lines = doc.splitTextToSize(text, w);
  const maxLines = Math.max(1, Math.floor((rowH - 2) / 3.2));
  doc.text(lines.slice(0, maxLines), x, y);
}

/* =====================================================================
 * VINS — A4 portrait, groupé par emplacement.
 * Colonnes : Photo | Type | Château | Millésime | Couleur | Qté | Médailles | EAN
 * ===================================================================== */
export async function printStockWinesA4(wines: Wine[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const groups = groupBy(wines);

  const cols: { key: string; label: string; w: number }[] = [
    { key: "photo",   label: "Photo",     w: 22 },
    { key: "type",    label: "Type",      w: 24 },
    { key: "chateau", label: "Château",   w: 50 },
    { key: "mill",    label: "Millésime", w: 18 },
    { key: "coul",    label: "Couleur",   w: 18 },
    { key: "qte",     label: "Qté",       w: 12 },
    { key: "med",     label: "Médailles", w: 18 },
    { key: "ean",     label: "EAN",       w: 24 },
  ];
  const rowH = 24;
  const headerH = 7;

  // Pré-charge des photos en parallèle.
  const photos = new Map<string, string | null>();
  await Promise.all(wines.filter(w => w.photo_url).map(async (w) => {
    photos.set(w.id, await fetchPhoto(w.photo_url!));
  }));

  let first = true;
  for (const [emp, items] of groups) {
    if (!first) doc.addPage("a4", "portrait");
    first = false;
    let y = MARGIN;
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(`Emplacement : ${emp}`, MARGIN, y + 5);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`${items.length} vin(s) — ${todayStr()}`, A4.w - MARGIN, y + 5, { align: "right" });
    y += 9;
    drawProductsHeader(doc, y, cols, headerH);
    y += headerH;

    for (const w of items) {
      if (y + rowH > A4.h - MARGIN) {
        doc.addPage("a4", "portrait");
        y = MARGIN;
        doc.setFont("helvetica", "bold"); doc.setFontSize(14);
        doc.text(`Emplacement : ${emp} (suite)`, MARGIN, y + 5);
        y += 9;
        drawProductsHeader(doc, y, cols, headerH);
        y += headerH;
      }
      drawWineRow(doc, w, y, cols, rowH, photos.get(w.id) ?? null);
      y += rowH;
    }
  }

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url; a.download = `vins-${todayStr()}.pdf`; a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function drawWineRow(
  doc: jsPDF, w: Wine, y: number,
  cols: { key: string; label: string; w: number }[], rowH: number,
  photo: string | null,
) {
  doc.setDrawColor(220);
  doc.line(MARGIN, y + rowH, A4.w - MARGIN, y + rowH);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(0);

  let x = MARGIN;
  for (const c of cols) {
    const cellX = x + 1;
    const cellY = y + 4;
    switch (c.key) {
      case "photo":
        if (photo) {
          try { doc.addImage(photo, "JPEG", x + 1, y + 1, rowH - 2, rowH - 2); } catch {}
        } else {
          doc.setDrawColor(200);
          doc.rect(x + 1, y + 1, rowH - 2, rowH - 2);
          doc.setDrawColor(220);
        }
        break;
      case "type":    writeMulti(doc, w.type_vin ?? "", cellX, cellY, c.w - 2, rowH); break;
      case "chateau":
        doc.setFont("helvetica", "bold");
        writeMulti(doc, w.chateau ?? "(sans nom)", cellX, cellY, c.w - 2, rowH);
        doc.setFont("helvetica", "normal");
        break;
      case "mill":    doc.text(String(w.millesime ?? ""), cellX, cellY, { maxWidth: c.w - 2 }); break;
      case "coul":    doc.text(w.couleur ?? "", cellX, cellY, { maxWidth: c.w - 2 }); break;
      case "qte":     doc.text(String(w.quantite ?? ""), cellX, cellY, { maxWidth: c.w - 2 }); break;
      case "med":     doc.text((w.medailles ?? []).join(", "), cellX, cellY, { maxWidth: c.w - 2 }); break;
      case "ean":     doc.text(w.code_barre ?? "", cellX, cellY, { maxWidth: c.w - 2 }); break;
    }
    x += c.w;
  }
}
