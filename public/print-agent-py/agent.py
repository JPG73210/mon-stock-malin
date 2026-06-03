#!/usr/bin/env python3
"""
Agent d'impression Stock JP/JC -> Brother QL-810W (IP directe, port 9100)

Pipeline :
  1. Poll Supabase pour les print_jobs en status 'pending'
  2. Décode le PDF (base64) et le rastérise en image 1-bit via PyMuPDF
  3. Convertit en commandes raster Brother via brother_ql
  4. Envoie le flux binaire en TCP direct à l'imprimante (tcp://IP:9100)

Aucune installation de driver côté Windows requise.

Usage :
  pip install -r requirements.txt
  cp config.example.json config.json
  # éditer config.json (SUPABASE_URL/KEY, EMAIL/PASSWORD, PRINTER_IP)
  python agent.py
"""
import base64
import io
import json
import os
import sys
import time
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image
from supabase import create_client
from brother_ql.raster import BrotherQLRaster
from brother_ql.conversion import convert
from brother_ql.backends.helpers import send

CFG_PATH = Path(__file__).parent / "config.json"
if not CFG_PATH.exists():
    print("config.json introuvable. Copiez config.example.json -> config.json")
    sys.exit(1)

cfg = json.loads(CFG_PATH.read_text(encoding="utf-8"))

SUPABASE_URL = cfg["SUPABASE_URL"]
SUPABASE_KEY = cfg["SUPABASE_ANON_KEY"]
EMAIL = cfg["EMAIL"]
PASSWORD = cfg["PASSWORD"]
PRINTER_IP = cfg["PRINTER_IP"]
MODEL = cfg.get("MODEL", "QL-810W")
POLL_MS = cfg.get("POLL_MS", 4000)
DPI = cfg.get("DPI", 300)  # 300 = standard Brother QL

# Mapping format app -> label brother_ql
# voir https://github.com/pklaus/brother_ql#supported-media
LABELS = {
    "23x23":  "23x23",
    "17x54":  "17x54",
    "62x29":  "29x62",
    "62x100": "62x100",
    "62":     "62",        # rouleau continu 62 mm
    "29x50":  "29",        # rouleau continu 29 mm (DK-22211)
    "50x29":  "29",
    "30x62":  "62",
    "62x30":  "62",
}

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
print("-> Connexion...")
auth = sb.auth.sign_in_with_password({"email": EMAIL, "password": PASSWORD})
if not auth.user:
    print("Auth échouée")
    sys.exit(1)
print(f"OK  Connecté · imprimante tcp://{PRINTER_IP}:9100 · modèle {MODEL}")


def pdf_to_images(pdf_bytes: bytes) -> list[Image.Image]:
    """Rastérise chaque page du PDF en image PIL (mode RGB)."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for page in doc:
        # zoom = DPI / 72 (PDF est en 72 dpi)
        mat = fitz.Matrix(DPI / 72, DPI / 72)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        images.append(img)
    doc.close()
    return images


def print_pdf(pdf_b64: str, fmt: str) -> None:
    label = LABELS.get(fmt)
    if not label:
        raise RuntimeError(f"Format d'étiquette non supporté par l'agent: {fmt}")
    pdf_bytes = base64.b64decode(pdf_b64)
    pages = pdf_to_images(pdf_bytes)
    if not pages:
        raise RuntimeError("PDF sans page")

    qlr = BrotherQLRaster(MODEL)
    qlr.exception_on_warning = True

    # brother_ql redimensionne et tourne automatiquement selon le label
    instructions = convert(
        qlr=qlr,
        images=pages,
        label=label,
        rotate="auto",
        threshold=70.0,
        dither=False,
        compress=False,
        red=False,
        dpi_600=False,
        hq=True,
        cut=True,
    )
    send(
        instructions=instructions,
        printer_identifier=f"tcp://{PRINTER_IP}:9100",
        backend_identifier="network",
        blocking=True,
    )


def poll_once() -> None:
    try:
        res = (
            sb.table("print_jobs")
            .select("*")
            .eq("status", "pending")
            .order("created_at", desc=False)
            .limit(5)
            .execute()
        )
    except Exception as e:
        print(f"Poll: {e}")
        return

    for j in res.data or []:
        jid = j["id"]
        fmt = j["format"]
        print(f"-> Job {jid[:8]} ({fmt})")
        sb.table("print_jobs").update({"status": "printing"}).eq("id", jid).execute()
        try:
            if not j.get("pdf_base64"):
                raise RuntimeError("PDF absent")
            print_pdf(j["pdf_base64"], fmt)
            sb.table("print_jobs").update({
                "status": "printed",
                "printed_at": "now()",
                "error": None,
            }).eq("id", jid).execute()
            print("   OK imprimé")
        except Exception as e:
            msg = str(e)
            print(f"   FAIL {msg}")
            sb.table("print_jobs").update({
                "status": "error",
                "error": msg[:500],
            }).eq("id", jid).execute()


print(f"Polling toutes les {POLL_MS}ms... (Ctrl+C pour arrêter)")
try:
    while True:
        poll_once()
        time.sleep(POLL_MS / 1000)
except KeyboardInterrupt:
    print("\nArrêt.")
