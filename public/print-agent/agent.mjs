#!/usr/bin/env node
/**
 * Agent d'impression local — Stock JP/JC → Brother QL-810Wc
 *
 * Scrute la file print_jobs côté cloud, télécharge le PDF et l'envoie à
 * l'imprimante locale via CUPS (lp) sur macOS/Linux ou PowerShell sur Windows.
 *
 * Usage :
 *   1. cp config.example.json config.json
 *   2. Remplir : SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL, PASSWORD, PRINTER
 *   3. node agent.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const cfgPath = path.resolve(process.cwd(), "config.json");
if (!fs.existsSync(cfgPath)) {
  console.error("config.json introuvable. Copiez config.example.json → config.json et remplissez-le.");
  process.exit(1);
}
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

console.log("→ Connexion…");
const { error: authErr } = await supabase.auth.signInWithPassword({
  email: cfg.EMAIL, password: cfg.PASSWORD,
});
if (authErr) { console.error("Auth :", authErr.message); process.exit(1); }
console.log(`✓ Connecté · imprimante cible: ${cfg.PRINTER}`);

const POLL_MS = cfg.POLL_MS ?? 4000;
const isWin = os.platform() === "win32";

// Mapping format → option media CUPS (doit correspondre à src/lib/print.ts ROLL_SPECS)
const CUPS_MEDIA = {
  "23x23":  "Custom.23x23mm",
  "17x54":  "Custom.17x54mm",
  "62x29":  "Custom.29x62mm",
  "62x100": "Custom.62x100mm",
  "62":     "Custom.62x30mm",
  // tolérance ancien libellé
  "30x62":  "Custom.62x30mm",
  "62x30":  "Custom.62x30mm",
};

async function printPdf(pdfBuffer, jobId, format) {
  const tmp = path.join(os.tmpdir(), `stockjp-${jobId}.pdf`);
  fs.writeFileSync(tmp, pdfBuffer);
  const media = CUPS_MEDIA[format] ?? "Custom.62x30mm";
  return new Promise((resolve, reject) => {
    let cmd, args;
    if (isWin) {
      cmd = "powershell";
      args = ["-Command", `Start-Process -FilePath '${tmp}' -Verb Print -PassThru | %{ Start-Sleep 4; $_ } | kill`];
    } else {
      cmd = "lp";
      args = ["-d", cfg.PRINTER, "-o", `media=${media}`, "-o", "fit-to-page", tmp];
    }
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("close", (code) => {
      try { fs.unlinkSync(tmp); } catch {}
      code === 0 ? resolve() : reject(new Error(`${cmd} a retourné ${code}`));
    });
  });
}

async function pollOnce() {
  const { data: jobs, error } = await supabase
    .from("print_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(5);
  if (error) { console.error("Poll :", error.message); return; }
  for (const j of jobs ?? []) {
    console.log(`→ Job ${j.id.slice(0, 8)} (${j.format})`);
    await supabase.from("print_jobs").update({ status: "printing" }).eq("id", j.id);
    try {
      if (!j.pdf_base64) throw new Error("PDF absent");
      const buf = Buffer.from(j.pdf_base64, "base64");
      await printPdf(buf, j.id, j.format);
      await supabase.from("print_jobs").update({
        status: "printed", printed_at: new Date().toISOString(), error: null,
      }).eq("id", j.id);
      console.log(`  ✓ imprimé`);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
      await supabase.from("print_jobs").update({
        status: "error", error: String(e.message ?? e),
      }).eq("id", j.id);
    }
  }
}

console.log(`Polling toutes les ${POLL_MS}ms…`);
setInterval(pollOnce, POLL_MS);
pollOnce();
