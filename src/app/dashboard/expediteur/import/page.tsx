"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload, Download, FileSpreadsheet, Check, X, Loader2,
  ChevronRight, AlertTriangle, CheckCircle, RotateCcw,
  FileText, Info,
} from "lucide-react";
import * as Papa from "papaparse";
import { api } from "@/lib/api";
import { bulkCreatePackages, downloadTemplate, type BulkCreateResult } from "@/lib/expediteur";
import type { Wilaya, Commune } from "@/lib/geography";

/* ── Theme ─────────────────────────────────────────────────────────────── */
function useIsDark() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function useTokens(isDark: boolean) {
  return isDark ? {
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130", rowHover: "#1a1f2e",
    text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280", textFaint: "#4b5563",
    shadow: "none", inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

/* ── CSV row shape ─────────────────────────────────────────────────────── */
interface CsvRow {
  recipient_name?: string;
  recipient_phone?: string;
  recipient_wilaya?: string;
  recipient_commune?: string;
  recipient_address?: string;
  delivery_type?: string;
  cod_amount?: string;
  content_description?: string;
  weight?: string;
  payment_type?: string;
  special_instructions?: string;
  [key: string]: string | undefined;
}

interface ValidatedRow {
  index: number;
  raw: CsvRow;
  resolved: {
    recipient_name: string;
    recipient_phone: string;
    recipient_wilaya_id: number | null;
    recipient_commune_id: number | null;
    recipient_address: string | null;
    delivery_type: "home_delivery" | "stop_desk";
    cod_amount: number;
    content_description: string;
    weight: number | null;
    payment_type: "sender" | "recipient";
    special_instructions: string | null;
  };
  errors: string[];
  valid: boolean;
}

/* ── Template column descriptions ──────────────────────────────────────── */
const TEMPLATE_COLUMNS: { col: string; description: string; example: string; required: boolean }[] = [
  { col: "recipient_name",      description: "Nom complet du destinataire",          example: "Ahmed Benaissa",          required: true },
  { col: "recipient_phone",     description: "Telephone du destinataire",            example: "0555123456",              required: true },
  { col: "recipient_wilaya",    description: "Nom de la wilaya de destination",      example: "Alger",                   required: true },
  { col: "recipient_commune",   description: "Nom de la commune de destination",     example: "Bab El Oued",             required: false },
  { col: "recipient_address",   description: "Adresse complete",                     example: "12 Rue Didouche Mourad",  required: false },
  { col: "delivery_type",       description: "Mode de livraison (domicile/bureau)",  example: "domicile",                required: false },
  { col: "cod_amount",          description: "Montant COD en DA",                    example: "2500",                    required: false },
  { col: "content_description", description: "Description du contenu",               example: "Chaussures",              required: false },
  { col: "weight",              description: "Poids en kg",                          example: "1.5",                     required: false },
  { col: "payment_type",        description: "Payeur (sender/recipient)",            example: "recipient",               required: false },
  { col: "special_instructions",description: "Notes pour le livreur",                example: "Appeler avant livraison", required: false },
];

/* ── Step indicator ────────────────────────────────────────────────────── */
const STEPS = [
  { num: 1, label: "Modele" },
  { num: 2, label: "Upload" },
  { num: 3, label: "Validation" },
  { num: 4, label: "Resultats" },
];

/* ── Component ─────────────────────────────────────────────────────────── */
export default function ImportPage() {
  const isDark = useIsDark();
  const t      = useTokens(isDark);

  const [step, setStep] = useState(1);

  /* Reference data */
  const [wilayas, setWilayas]   = useState<Wilaya[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [refLoading, setRefLoading] = useState(true);

  /* CSV data */
  const [fileName, setFileName]         = useState<string | null>(null);
  const [parsedRows, setParsedRows]     = useState<CsvRow[]>([]);
  const [validated, setValidated]       = useState<ValidatedRow[]>([]);

  /* Import result */
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState<BulkCreateResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  /* Drag state */
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Load reference data ── */
  useEffect(() => {
    async function load() {
      const [wRes, cRes] = await Promise.all([
        api<Wilaya[]>("/wilayas"),
        api<Commune[]>("/communes"),
      ]);
      if (wRes.success && wRes.data) setWilayas(wRes.data);
      if (cRes.success && cRes.data) setCommunes(cRes.data);
      setRefLoading(false);
    }
    load();
  }, []);

  /* ── Parse CSV ── */
  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) return;
    setFileName(file.name);

    Papa.parse<CsvRow>(file, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      complete(results) {
        const rows = results.data.filter(
          row => Object.values(row).some(v => typeof v === "string" && v.trim()),
        );
        setParsedRows(rows);
        setStep(3); // auto-advance
      },
      error() {
        setParsedRows([]);
      },
    });
  }, []);

  /* ── Validate rows once we have parsed + reference data ── */
  useEffect(() => {
    if (step !== 3 || parsedRows.length === 0 || refLoading) return;

    const result: ValidatedRow[] = parsedRows.map((raw, i) => {
      const errors: string[] = [];

      const name = (raw.recipient_name ?? "").trim();
      const phone = (raw.recipient_phone ?? "").trim();
      const wilayaStr = (raw.recipient_wilaya ?? "").trim();
      const communeStr = (raw.recipient_commune ?? "").trim();
      const codStr = (raw.cod_amount ?? "").trim();
      const weightStr = (raw.weight ?? "").trim();
      const deliveryRaw = (raw.delivery_type ?? "").trim().toLowerCase();
      const paymentRaw = (raw.payment_type ?? "").trim().toLowerCase();

      if (!name) errors.push("Nom destinataire requis");
      if (!phone) errors.push("Telephone requis");
      if (!wilayaStr) errors.push("Wilaya requise");

      // Resolve wilaya
      let wilayaId: number | null = null;
      if (wilayaStr) {
        const match = wilayas.find(w => w.name.toLowerCase() === wilayaStr.toLowerCase());
        if (match) {
          wilayaId = match.id;
        } else {
          // Try matching by code
          const codeMatch = wilayas.find(w => w.code === wilayaStr);
          if (codeMatch) wilayaId = codeMatch.id;
          else errors.push(`Wilaya "${wilayaStr}" introuvable`);
        }
      }

      // Resolve commune
      let communeId: number | null = null;
      if (communeStr && wilayaId) {
        const match = communes.find(
          c => c.wilaya_id === wilayaId && c.name.toLowerCase() === communeStr.toLowerCase(),
        );
        if (match) communeId = match.id;
        // Not required, so no error if not found
      }

      // Validate cod_amount
      let codAmount = 0;
      if (codStr) {
        const parsed = parseFloat(codStr.replace(",", "."));
        if (isNaN(parsed)) errors.push("Montant COD invalide");
        else codAmount = parsed;
      }

      // Weight
      let weightVal: number | null = null;
      if (weightStr) {
        const parsed = parseFloat(weightStr.replace(",", "."));
        if (!isNaN(parsed)) weightVal = parsed;
      }

      // Delivery type
      let deliveryType: "home_delivery" | "stop_desk" = "home_delivery";
      if (deliveryRaw === "bureau" || deliveryRaw === "stop_desk" || deliveryRaw === "desk") {
        deliveryType = "stop_desk";
      }

      // Payment type
      let paymentType: "sender" | "recipient" = "recipient";
      if (paymentRaw === "sender" || paymentRaw === "expediteur") {
        paymentType = "sender";
      }

      return {
        index: i,
        raw,
        resolved: {
          recipient_name: name,
          recipient_phone: phone,
          recipient_wilaya_id: wilayaId,
          recipient_commune_id: communeId,
          recipient_address: (raw.recipient_address ?? "").trim() || null,
          delivery_type: deliveryType,
          cod_amount: codAmount,
          content_description: (raw.content_description ?? "").trim() || "Colis",
          weight: weightVal,
          payment_type: paymentType,
          special_instructions: (raw.special_instructions ?? "").trim() || null,
        },
        errors,
        valid: errors.length === 0,
      };
    });

    setValidated(result);
  }, [step, parsedRows, wilayas, communes, refLoading]);

  /* ── Remove row ── */
  function removeRow(index: number) {
    setValidated(prev => prev.filter(r => r.index !== index));
  }

  /* ── Import ── */
  async function handleImport() {
    const validRows = validated.filter(r => r.valid);
    if (validRows.length === 0) return;

    setImporting(true);
    setImportError(null);

    const packages = validRows.map(r => ({
      ...r.resolved,
    }));

    const res = await bulkCreatePackages(packages);
    setImporting(false);

    if (res.success && res.data) {
      setResult(res.data);
      setStep(4);
    } else {
      setImportError(res.message || "Erreur lors de l'import.");
    }
  }

  /* ── Full reset ── */
  function handleReset() {
    setStep(1);
    setFileName(null);
    setParsedRows([]);
    setValidated([]);
    setResult(null);
    setImportError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  /* ── Drag handlers ── */
  function onDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true); }
  function onDragLeave() { setDragging(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }
  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const validCount   = validated.filter(r => r.valid).length;
  const invalidCount = validated.filter(r => !r.valid).length;

  /* ── Styles ── */
  const btnPrimary: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px",
    borderRadius: 10, background: "linear-gradient(135deg, #f97316, #ea580c)",
    color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
    boxShadow: "0 2px 12px rgba(249,115,22,0.3)", transition: "all 0.2s",
  };
  const btnSecondary: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px",
    borderRadius: 10, background: t.card, color: t.text, fontSize: 13, fontWeight: 600,
    border: `1px solid ${t.border}`, cursor: "pointer", transition: "all 0.15s",
  };

  if (refLoading) {
    return (
      <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "#f97316" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: "linear-gradient(135deg, #f97316, #ea580c)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 10px rgba(249,115,22,0.3)",
        }}>
          <Upload size={20} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>Import CSV</h1>
          <p style={{ fontSize: 12, color: t.textMuted, margin: 0 }}>Importez vos colis en masse depuis un fichier CSV</p>
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 0, marginBottom: 28, flexWrap: "wrap",
      }}>
        {STEPS.map((s, i) => {
          const active  = step === s.num;
          const done    = step > s.num;
          return (
            <div key={s.num} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700,
                  background: done ? "#22c55e" : active ? "#f97316" : t.divider,
                  color: done || active ? "#fff" : t.textMuted,
                  transition: "all 0.2s",
                }}>
                  {done ? <Check size={14} /> : s.num}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: active ? 700 : 500,
                  color: active ? t.text : done ? "#22c55e" : t.textMuted,
                }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 32, height: 1, margin: "0 10px",
                  background: done ? "#22c55e" : t.divider,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Template ── */}
      {step === 1 && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          boxShadow: t.shadow, padding: 28,
        }}>
          {/* Download button */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: "0 4px 16px rgba(249,115,22,0.3)",
            }}>
              <FileSpreadsheet size={26} color="#fff" />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: t.text, margin: "0 0 6px" }}>
              Telecharger le modele CSV
            </h2>
            <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 16px", maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
              Utilisez ce modele pour preparer vos donnees. Remplissez les colonnes et importez le fichier.
            </p>
            <button onClick={downloadTemplate} style={btnPrimary}>
              <Download size={16} />
              Telecharger le modele
            </button>
          </div>

          {/* Column descriptions table */}
          <div style={{
            borderRadius: 10, border: `1px solid ${t.border}`, overflow: "hidden",
          }}>
            <div style={{
              display: "grid", gridTemplateColumns: "180px 1fr 160px 70px",
              background: isDark ? "#151821" : "#f9fafb", padding: "10px 14px",
              borderBottom: `1px solid ${t.border}`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Colonne</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Description</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Exemple</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>Requis</span>
            </div>
            {TEMPLATE_COLUMNS.map((col, i) => (
              <div
                key={col.col}
                style={{
                  display: "grid", gridTemplateColumns: "180px 1fr 160px 70px",
                  padding: "9px 14px", alignItems: "center",
                  borderBottom: i < TEMPLATE_COLUMNS.length - 1 ? `1px solid ${t.divider}` : "none",
                  background: i % 2 === 0 ? "transparent" : (isDark ? "rgba(255,255,255,0.015)" : "rgba(0,0,0,0.01)"),
                }}
              >
                <code style={{
                  fontSize: 12, fontWeight: 600, color: "#f97316",
                  background: isDark ? "rgba(249,115,22,0.1)" : "rgba(249,115,22,0.06)",
                  padding: "2px 8px", borderRadius: 4, display: "inline-block",
                }}>
                  {col.col}
                </code>
                <span style={{ fontSize: 12, color: t.textSub }}>{col.description}</span>
                <span style={{ fontSize: 12, color: t.textMuted, fontStyle: "italic" }}>{col.example}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: col.required ? "#ef4444" : t.textFaint,
                }}>
                  {col.required ? "Oui" : "Non"}
                </span>
              </div>
            ))}
          </div>

          {/* Info note */}
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10, marginTop: 16,
            padding: "12px 16px", borderRadius: 10,
            background: isDark ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.04)",
            border: `1px solid ${isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)"}`,
          }}>
            <Info size={16} style={{ color: "#3b82f6", flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>
              Le separateur utilise est le <strong>point-virgule (;)</strong>.
              Les noms de wilayas et communes seront resolus automatiquement (insensible a la casse).
            </div>
          </div>

          {/* Next */}
          <div style={{ textAlign: "right", marginTop: 24 }}>
            <button onClick={() => setStep(2)} style={btnPrimary}>
              Prochaine etape
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Upload ── */}
      {step === 2 && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          boxShadow: t.shadow, padding: 28,
        }}>
          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragging ? "#f97316" : t.border}`,
              borderRadius: 14, padding: "48px 20px", textAlign: "center",
              background: dragging
                ? (isDark ? "rgba(249,115,22,0.06)" : "rgba(249,115,22,0.03)")
                : "transparent",
              transition: "all 0.2s", cursor: "pointer",
            }}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
              background: isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Upload size={24} style={{ color: dragging ? "#f97316" : t.textMuted }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>
              Glissez un fichier CSV ici
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>
              ou cliquez pour parcourir vos fichiers
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              style={btnSecondary}
            >
              <FileText size={14} />
              Parcourir
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={onFileSelect}
              style={{ display: "none" }}
            />
          </div>

          {fileName && (
            <div style={{
              marginTop: 16, padding: "10px 16px", borderRadius: 8,
              background: isDark ? "rgba(34,197,94,0.06)" : "rgba(34,197,94,0.04)",
              border: `1px solid ${isDark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.1)"}`,
              display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: t.text,
            }}>
              <CheckCircle size={14} style={{ color: "#22c55e" }} />
              Fichier selectionne: <strong>{fileName}</strong>
            </div>
          )}

          {/* Back */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
            <button onClick={() => setStep(1)} style={btnSecondary}>
              Retour
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview & Validate ── */}
      {step === 3 && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          boxShadow: t.shadow, padding: 24,
        }}>
          {/* Stats bar */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 20, alignItems: "center",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              borderRadius: 8,
              background: isDark ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.05)",
              border: `1px solid ${isDark ? "rgba(34,197,94,0.2)" : "rgba(34,197,94,0.12)"}`,
            }}>
              <CheckCircle size={14} style={{ color: "#22c55e" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>{validCount} valides</span>
            </div>
            {invalidCount > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
                borderRadius: 8,
                background: isDark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)",
                border: `1px solid ${isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.12)"}`,
              }}>
                <AlertTriangle size={14} style={{ color: "#ef4444" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>{invalidCount} erreurs</span>
              </div>
            )}
            <div style={{ marginLeft: "auto", fontSize: 12, color: t.textMuted }}>
              {validated.length} ligne{validated.length > 1 ? "s" : ""} au total
            </div>
          </div>

          {/* Error banner */}
          {importError && (
            <div style={{
              padding: "12px 16px", borderRadius: 10, marginBottom: 16,
              background: isDark ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.05)",
              border: `1px solid ${isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.15)"}`,
              fontSize: 13, color: "#ef4444", fontWeight: 500,
            }}>
              {importError}
            </div>
          )}

          {/* Table */}
          <div style={{ overflow: "auto", borderRadius: 10, border: `1px solid ${t.border}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 800 }}>
              <thead>
                <tr style={{ background: isDark ? "#151821" : "#f9fafb" }}>
                  {["#", "Nom", "Telephone", "Wilaya", "Commune", "Type", "COD", "Contenu", "Statut", ""].map(
                    (h, i) => (
                      <th key={i} style={{
                        padding: "9px 12px", textAlign: "left", fontWeight: 700,
                        color: t.textMuted, borderBottom: `1px solid ${t.border}`,
                        fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5,
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {validated.map(row => (
                  <tr
                    key={row.index}
                    style={{
                      borderLeft: `3px solid ${row.valid ? "#22c55e" : "#ef4444"}`,
                      background: "transparent",
                    }}
                  >
                    <td style={{ padding: "8px 12px", color: t.textMuted, borderBottom: `1px solid ${t.divider}` }}>
                      {row.index + 1}
                    </td>
                    <td style={{ padding: "8px 12px", color: t.text, fontWeight: 500, borderBottom: `1px solid ${t.divider}` }}>
                      {row.resolved.recipient_name || <span style={{ color: t.textFaint }}>--</span>}
                    </td>
                    <td style={{ padding: "8px 12px", color: t.textSub, borderBottom: `1px solid ${t.divider}` }}>
                      {row.resolved.recipient_phone || <span style={{ color: t.textFaint }}>--</span>}
                    </td>
                    <td style={{ padding: "8px 12px", color: t.textSub, borderBottom: `1px solid ${t.divider}` }}>
                      {row.resolved.recipient_wilaya_id
                        ? wilayas.find(w => w.id === row.resolved.recipient_wilaya_id)?.name ?? (row.raw.recipient_wilaya || "--")
                        : <span style={{ color: "#ef4444" }}>{row.raw.recipient_wilaya || "--"}</span>
                      }
                    </td>
                    <td style={{ padding: "8px 12px", color: t.textSub, borderBottom: `1px solid ${t.divider}` }}>
                      {row.resolved.recipient_commune_id
                        ? communes.find(c => c.id === row.resolved.recipient_commune_id)?.name ?? "--"
                        : <span style={{ color: t.textFaint }}>{row.raw.recipient_commune || "--"}</span>
                      }
                    </td>
                    <td style={{ padding: "8px 12px", color: t.textSub, borderBottom: `1px solid ${t.divider}` }}>
                      {row.resolved.delivery_type === "home_delivery" ? "Domicile" : "Bureau"}
                    </td>
                    <td style={{ padding: "8px 12px", color: t.text, fontWeight: 600, borderBottom: `1px solid ${t.divider}` }}>
                      {row.resolved.cod_amount > 0 ? `${row.resolved.cod_amount.toLocaleString("fr-DZ")} DA` : "0"}
                    </td>
                    <td style={{
                      padding: "8px 12px", color: t.textSub, borderBottom: `1px solid ${t.divider}`,
                      maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {row.resolved.content_description}
                    </td>
                    <td style={{ padding: "8px 12px", borderBottom: `1px solid ${t.divider}` }}>
                      {row.valid ? (
                        <span style={{
                          fontSize: 11, fontWeight: 600, color: "#22c55e",
                          background: isDark ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.08)",
                          padding: "2px 8px", borderRadius: 4,
                        }}>Valide</span>
                      ) : (
                        <div>
                          {row.errors.map((err, ei) => (
                            <div key={ei} style={{
                              fontSize: 11, color: "#ef4444", fontWeight: 500,
                              lineHeight: 1.4,
                            }}>{err}</div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px", borderBottom: `1px solid ${t.divider}` }}>
                      <button
                        onClick={() => removeRow(row.index)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: t.textMuted, padding: 4, borderRadius: 4,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                        title="Supprimer cette ligne"
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validated.length === 0 && (
            <div style={{
              textAlign: "center", padding: "32px 20px", color: t.textMuted, fontSize: 13,
            }}>
              Aucune donnee a afficher. Verifiez votre fichier CSV.
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24, flexWrap: "wrap", gap: 12 }}>
            <button onClick={() => { setStep(2); setValidated([]); setParsedRows([]); setFileName(null); }} style={btnSecondary}>
              Changer de fichier
            </button>
            <button
              onClick={handleImport}
              disabled={validCount === 0 || importing}
              style={{
                ...btnPrimary,
                opacity: validCount === 0 || importing ? 0.5 : 1,
                cursor: validCount === 0 || importing ? "not-allowed" : "pointer",
              }}
            >
              {importing ? (
                <>
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  Import en cours...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Importer {validCount} colis
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Results ── */}
      {step === 4 && result && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          boxShadow: t.shadow, padding: 28,
        }}>
          {/* Success summary */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto 14px",
              background: result.created_count > 0
                ? "linear-gradient(135deg, #22c55e, #16a34a)"
                : "linear-gradient(135deg, #ef4444, #dc2626)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: result.created_count > 0
                ? "0 4px 16px rgba(34,197,94,0.3)"
                : "0 4px 16px rgba(239,68,68,0.3)",
            }}>
              {result.created_count > 0
                ? <Check size={26} color="#fff" />
                : <AlertTriangle size={26} color="#fff" />
              }
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: t.text, margin: "0 0 6px" }}>
              {result.created_count} colis crees avec succes
            </h2>
            {result.error_count > 0 && (
              <p style={{ fontSize: 13, color: "#ef4444", margin: 0, fontWeight: 500 }}>
                {result.error_count} erreur{result.error_count > 1 ? "s" : ""} rencontree{result.error_count > 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* Summary stats */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24,
            maxWidth: 400, margin: "0 auto 24px",
          }}>
            <div style={{
              padding: "14px 16px", borderRadius: 10, textAlign: "center",
              background: isDark ? "rgba(34,197,94,0.06)" : "rgba(34,197,94,0.04)",
              border: `1px solid ${isDark ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.1)"}`,
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#22c55e" }}>{result.created_count}</div>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>CREES</div>
            </div>
            <div style={{
              padding: "14px 16px", borderRadius: 10, textAlign: "center",
              background: isDark ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.04)",
              border: `1px solid ${isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)"}`,
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: result.error_count > 0 ? "#ef4444" : t.textFaint }}>
                {result.error_count}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>ERREURS</div>
            </div>
          </div>

          {/* Created packages */}
          {result.created.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={14} style={{ color: "#22c55e" }} />
                Colis crees
              </h3>
              <div style={{ overflow: "auto", borderRadius: 10, border: `1px solid ${t.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 500 }}>
                  <thead>
                    <tr style={{ background: isDark ? "#151821" : "#f9fafb" }}>
                      {["Tracking", "Destinataire", "Wilaya", "COD"].map(h => (
                        <th key={h} style={{
                          padding: "8px 12px", textAlign: "left", fontWeight: 700,
                          color: t.textMuted, borderBottom: `1px solid ${t.border}`,
                          fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.created.map(pkg => (
                      <tr key={pkg.id}>
                        <td style={{ padding: "8px 12px", borderBottom: `1px solid ${t.divider}` }}>
                          <code style={{
                            fontSize: 12, fontWeight: 700, color: "#f97316",
                            background: isDark ? "rgba(249,115,22,0.1)" : "rgba(249,115,22,0.06)",
                            padding: "2px 8px", borderRadius: 4,
                          }}>
                            {pkg.tracking_number}
                          </code>
                        </td>
                        <td style={{ padding: "8px 12px", color: t.text, fontWeight: 500, borderBottom: `1px solid ${t.divider}` }}>
                          {pkg.recipient_name}
                        </td>
                        <td style={{ padding: "8px 12px", color: t.textSub, borderBottom: `1px solid ${t.divider}` }}>
                          {pkg.recipient_wilaya?.name ?? "--"}
                        </td>
                        <td style={{ padding: "8px 12px", color: t.text, fontWeight: 600, borderBottom: `1px solid ${t.divider}` }}>
                          {pkg.cod_amount > 0 ? `${pkg.cod_amount.toLocaleString("fr-DZ")} DA` : "0"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors list */}
          {result.errors.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={14} style={{ color: "#ef4444" }} />
                Erreurs
              </h3>
              <div style={{
                borderRadius: 10, border: `1px solid ${isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.12)"}`,
                overflow: "hidden",
              }}>
                {result.errors.map((err, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 14px", display: "flex", gap: 12, alignItems: "flex-start",
                      borderBottom: i < result.errors.length - 1 ? `1px solid ${t.divider}` : "none",
                      background: i % 2 === 0 ? "transparent" : (isDark ? "rgba(239,68,68,0.02)" : "rgba(239,68,68,0.02)"),
                    }}
                  >
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: "#ef4444",
                      background: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.08)",
                      padding: "2px 8px", borderRadius: 4, flexShrink: 0,
                    }}>
                      Ligne {err.row}
                    </span>
                    <div>
                      {err.messages.map((msg, mi) => (
                        <div key={mi} style={{ fontSize: 12, color: t.textSub, lineHeight: 1.5 }}>{msg}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          <div style={{ textAlign: "center" }}>
            <button onClick={handleReset} style={btnPrimary}>
              <RotateCcw size={16} />
              Nouvel import
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
