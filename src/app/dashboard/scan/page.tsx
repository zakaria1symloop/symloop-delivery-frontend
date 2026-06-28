"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ScanBarcode, Loader2, CheckCircle2, AlertCircle, Package2,
  MapPin, User, Clock, Truck, Banknote, Gift, Printer,
  ArrowRight, ListChecks, X,
} from "lucide-react";
import {
  scanAcceptPackage,
  updatePackageStatus,
  type Package,
  type ServiceType,
  type WorkflowNextStep,
  STATUS_LABELS, STATUS_COLORS, SERVICE_LABELS,
} from "@/lib/packages";
import { api, getStoredUser } from "@/lib/api";
import { createCaisseTransaction } from "@/lib/caisse";
import PackageLabel from "@/components/PackageLabel";

/* ── theme ───────────────────────────────────────────────── */
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
    bg:        "#0e1017",
    card:      "#111827",
    border:    "#1e2130",
    divider:   "#1e2130",
    rowHover:  "#1a1f2e",
    text:      "#f0f0f5",
    textSub:   "#d1d5db",
    textMuted: "#6b7280",
    textFaint: "#4b5563",
    shadow:    "none",
    modalBg:   "#111827",
    overlay:   "rgba(0,0,0,0.6)",
    inp:       { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
    chipActive:  { bg: "rgba(249,115,22,0.15)", text: "#fb923c", border: "#f97316" },
    chipDefault: { bg: "#1e2130", text: "#6b7280", border: "#2a3145" },
    iconBg:    "rgba(255,255,255,0.07)",
  } : {
    bg:        "#ffffff",
    card:      "#ffffff",
    border:    "#e5e7eb",
    divider:   "#f3f4f6",
    rowHover:  "#f9fafb",
    text:      "#111827",
    textSub:   "#374151",
    textMuted: "#6b7280",
    textFaint: "#9ca3af",
    shadow:    "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    modalBg:   "#ffffff",
    overlay:   "rgba(0,0,0,0.35)",
    inp:       { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    chipActive:  { bg: "rgba(249,115,22,0.1)", text: "#ea580c", border: "#f97316" },
    chipDefault: { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb" },
    iconBg:    "#f3f4f6",
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── helpers ──────────────────────────────────────────────── */
const SERVICE_COLORS_MAP: Record<ServiceType, { bg: string; text: string }> = {
  livraison:    { bg: "rgba(59,130,246,0.1)",  text: "#2563eb" },
  pickup:       { bg: "rgba(16,185,129,0.1)",  text: "#059669" },
  echange:      { bg: "rgba(245,158,11,0.1)",  text: "#d97706" },
  recouvrement: { bg: "rgba(168,85,247,0.1)",  text: "#7c3aed" },
};

function formatTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/* ── components ──────────────────────────────────────────── */
function ServiceBadge({ type }: { type: ServiceType }) {
  const c = SERVICE_COLORS_MAP[type] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>
      {SERVICE_LABELS[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? { bg: "rgba(107,114,128,0.1)", text: "#6b7280", dot: "#6b7280" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
    </span>
  );
}

/* ── scanned item type ───────────────────────────────────── */
interface ScannedItem {
  pkg: Package;
  scannedAt: Date;
}

/* ── main page ───────────────────────────────────────────── */
export default function ScanReceptionPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  // State
  const [inputValue, setInputValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; pkg?: Package; error?: string } | null>(null);
  const [driverPaid, setDriverPaid] = useState<Record<number, boolean>>({});
  const [showLabel, setShowLabel] = useState(false);
  const [flashBorder, setFlashBorder] = useState<"success" | "error" | "workflow" | null>(null);
  const [scannedToday, setScannedToday] = useState<ScannedItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Workflow advance state ──────────────────────────────────
  // When scan-accept returns workflow_next, the colis must advance one step
  // (via the manual status endpoint) BEFORE it can be accepted.
  const [workflow, setWorkflow] = useState<{
    pkgId: number;
    tracking: string;
    message: string;
    options: WorkflowNextStep[];
  } | null>(null);
  const [noteFor, setNoteFor] = useState<WorkflowNextStep | null>(null);
  const [noteText, setNoteText] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [advanceMsg, setAdvanceMsg] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Focus the note input when a require_note step is selected
  useEffect(() => {
    if (noteFor) setTimeout(() => noteInputRef.current?.focus(), 50);
  }, [noteFor]);

  // Flash border effect
  const triggerFlash = useCallback((type: "success" | "error" | "workflow") => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashBorder(type);
    flashTimerRef.current = setTimeout(() => setFlashBorder(null), 1500);
  }, []);

  // Advance the colis one workflow step via the manual status endpoint, which
  // validates the transition and enforces require_note (422) + authorization (403).
  const advanceStep = useCallback(async (pkgId: number, option: WorkflowNextStep, note?: string) => {
    setAdvancing(true);
    setWorkflowError(null);
    try {
      const res = await updatePackageStatus(pkgId, option.key, note);
      if (res.success) {
        setWorkflow(null);
        setNoteFor(null);
        setNoteText("");
        setLastResult(null);
        setAdvanceMsg(`Colis avancé à ${option.label}. Scannez à nouveau pour continuer.`);
        triggerFlash("success");
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        // 422 (note required) / 403 (not authorized) → show backend message, retry
        const msg = (res as any).message || (res as any).error || "Impossible d'avancer le colis.";
        setWorkflowError(msg);
        triggerFlash("error");
      }
    } catch (err: any) {
      setWorkflowError(err?.message || "Erreur de connexion");
      triggerFlash("error");
    } finally {
      setAdvancing(false);
    }
  }, [triggerFlash]);

  // Picker: operator chose a next step. If it needs a note, prompt first.
  const chooseOption = useCallback((pkgId: number, option: WorkflowNextStep) => {
    setWorkflowError(null);
    if (option.require_note) {
      setNoteFor(option);
      setNoteText("");
    } else {
      advanceStep(pkgId, option);
    }
  }, [advanceStep]);

  // Submit the note prompt then advance.
  const submitNote = useCallback(() => {
    if (!workflow || !noteFor) return;
    const note = noteText.trim();
    if (!note) { setWorkflowError("Une note est requise pour cette étape."); return; }
    advanceStep(workflow.pkgId, noteFor, note);
  }, [workflow, noteFor, noteText, advanceStep]);

  // Handle scan
  const handleScan = useCallback(async () => {
    const tracking = inputValue.trim();
    if (!tracking || scanning) return;

    setScanning(true);
    setLastResult(null);
    // Fresh scan → clear any pending workflow picker / note / messages.
    setWorkflow(null);
    setNoteFor(null);
    setNoteText("");
    setAdvanceMsg(null);
    setWorkflowError(null);

    // When a note prompt opens, keep focus on the note input (not the scanner).
    let promptingNote = false;
    try {
      const res = await scanAcceptPackage(tracking);
      const wf = res.data?.workflow_next;
      if (res.success && res.data && wf && wf.length > 0) {
        // The colis must advance one workflow step BEFORE it can be accepted.
        const pkgId = res.data.id;
        const message = res.data.workflow_message
          || "Ce colis doit avancer d'une étape avant d'être accepté.";
        triggerFlash("workflow");
        if (wf.length === 1) {
          const only = wf[0];
          if (only.require_note) {
            // Single step needing a note → prompt for it first.
            setWorkflow({ pkgId, tracking, message, options: wf });
            setNoteFor(only);
            promptingNote = true;
          } else {
            // Single step, no note → advance straight away.
            await advanceStep(pkgId, only);
          }
        } else {
          // Multiple steps → show the picker.
          setWorkflow({ pkgId, tracking, message, options: wf });
        }
      } else if (res.success && res.data) {
        const pkg = res.data;
        const needsPayment = (res as any).needs_payment === true;
        setLastResult({ success: true, pkg, needsPayment } as any);
        triggerFlash("success");
        setScannedToday(prev => [{ pkg, scannedAt: new Date() }, ...prev]);
      } else {
        const errorMsg = (res as any).message || (res as any).error || "Erreur lors du scan";
        setLastResult({ success: false, error: errorMsg });
        triggerFlash("error");
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Erreur de connexion";
      setLastResult({ success: false, error: errorMsg });
      triggerFlash("error");
    } finally {
      setScanning(false);
      setInputValue("");
      // Re-focus the scanner input, unless a note prompt just opened (which
      // needs focus itself).
      if (!promptingNote) setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [inputValue, scanning, triggerFlash, advanceStep]);

  // Handle key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  }, [handleScan]);

  // Compute flash border color
  const getInputBorderColor = (): string => {
    if (flashBorder === "success") return "#22c55e";
    if (flashBorder === "error") return "#ef4444";
    if (flashBorder === "workflow") return "#f97316";
    return t.inp.border;
  };

  const getInputBorderWidth = (): string => {
    if (flashBorder) return "2px";
    return "1px";
  };

  return (
    <div style={{ fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans', sans-serif)" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "rgba(16,185,129,0.1)",
          }}>
            <ScanBarcode size={20} style={{ color: "#10b981" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0 }}>
              Scan Reception
            </h1>
            <p style={{ fontSize: 13, color: t.textMuted, margin: 0 }}>
              {scannedToday.length} colis {scannedToday.length === 1 ? "scanne" : "scannes"} aujourd&apos;hui
            </p>
          </div>
        </div>

        {/* Counter badge */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center",
          background: "rgba(16,185,129,0.1)", borderRadius: 14,
          padding: "10px 22px", minWidth: 80,
          border: "1px solid rgba(16,185,129,0.2)",
        }}>
          <span style={{
            fontSize: 32, fontWeight: 900, color: "#10b981",
            lineHeight: 1,
          }}>
            {scannedToday.length}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: "#059669",
            textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2,
          }}>
            scans
          </span>
        </div>
      </div>

      {/* Giant scan input */}
      <div style={{
        background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
        padding: 24, marginBottom: 20, boxShadow: t.shadow,
        display: "flex", flexDirection: "column", alignItems: "center",
      }}>
        <div style={{
          width: "100%", maxWidth: 600, position: "relative",
        }}>
          <ScanBarcode
            size={22}
            style={{
              position: "absolute", left: 16, top: "50%",
              transform: "translateY(-50%)", color: t.textFaint,
              pointerEvents: "none",
            }}
          />
          <input
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scanner un colis..."
            disabled={scanning}
            autoFocus
            style={{
              width: "100%",
              background: t.inp.bg,
              border: `${getInputBorderWidth()} solid ${getInputBorderColor()}`,
              borderRadius: 12,
              padding: "16px 56px 16px 50px",
              fontSize: 28,
              fontWeight: 700,
              fontFamily: "monospace",
              color: t.inp.text,
              outline: "none",
              textAlign: "center",
              transition: "border-color 0.2s, border-width 0.2s",
              boxSizing: "border-box",
              opacity: scanning ? 0.6 : 1,
            }}
          />
          {scanning && (
            <Loader2
              size={22}
              style={{
                position: "absolute", right: 16, top: "50%",
                transform: "translateY(-50%)",
                color: t.textMuted,
                animation: "spin 1s linear infinite",
              }}
            />
          )}
        </div>
        <p style={{
          fontSize: 12, color: t.textFaint, marginTop: 10, marginBottom: 0,
          textAlign: "center",
        }}>
          Scannez ou saisissez le numero de tracking puis appuyez sur Entree
        </p>
      </div>

      {/* Scan feedback */}
      {lastResult && !lastResult.success && lastResult.error && (
        <div style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <AlertCircle size={18} style={{ color: "#ef4444", flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: "#ef4444", fontWeight: 600 }}>
            {lastResult.error}
          </span>
        </div>
      )}

      {/* Workflow advance success banner */}
      {advanceMsg && (
        <div style={{
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <ArrowRight size={18} style={{ color: "#16a34a", flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: "#16a34a", fontWeight: 600 }}>
            {advanceMsg}
          </span>
        </div>
      )}

      {/* Workflow next-step picker / note prompt */}
      {workflow && (
        <div style={{
          background: t.card, borderRadius: 14,
          border: "1px solid rgba(249,115,22,0.35)",
          boxShadow: t.shadow, padding: 20, marginBottom: 20,
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(249,115,22,0.1)",
            }}>
              <ListChecks size={18} style={{ color: "#f97316" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>
                {noteFor ? "Ajouter une note" : "Choisissez la prochaine étape"}
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>
                {workflow.message}
              </div>
              <div style={{
                fontSize: 12, color: t.textFaint, marginTop: 4,
                fontFamily: "monospace", fontWeight: 700,
              }}>
                {workflow.tracking}
              </div>
            </div>
            <button
              onClick={() => { setWorkflow(null); setNoteFor(null); setNoteText(""); setWorkflowError(null); inputRef.current?.focus(); }}
              title="Fermer"
              style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: `1px solid ${t.border}`,
                color: t.textMuted, cursor: "pointer",
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Error (422 note required / 403 not authorized) */}
          {workflowError && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 10, padding: "10px 14px", margin: "12px 0",
            }}>
              <AlertCircle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>{workflowError}</span>
            </div>
          )}

          {noteFor ? (
            /* Note prompt for a require_note step */
            <div style={{ marginTop: 14 }}>
              <input
                ref={noteInputRef}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitNote(); } }}
                placeholder="Saisir une note (obligatoire)…"
                disabled={advancing}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: t.inp.bg, border: `1px solid ${t.inp.border}`,
                  borderRadius: 10, padding: "12px 14px", fontSize: 14,
                  color: t.inp.text, outline: "none",
                }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                {workflow.options.length > 1 && (
                  <button
                    onClick={() => { setNoteFor(null); setNoteText(""); setWorkflowError(null); }}
                    disabled={advancing}
                    style={{
                      padding: "10px 16px", borderRadius: 10,
                      background: t.iconBg, border: `1px solid ${t.border}`,
                      color: t.textSub, fontSize: 13, fontWeight: 600,
                      cursor: advancing ? "not-allowed" : "pointer",
                    }}
                  >
                    Retour
                  </button>
                )}
                <button
                  onClick={submitNote}
                  disabled={advancing}
                  style={{
                    flex: 1, padding: "10px 16px", borderRadius: 10, border: "none",
                    background: "#f97316", color: "#fff", fontSize: 14, fontWeight: 700,
                    cursor: advancing ? "not-allowed" : "pointer", opacity: advancing ? 0.7 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {advancing
                    ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    : <ArrowRight size={16} />}
                  Avancer à {noteFor.label}
                </button>
              </div>
            </div>
          ) : (
            /* Picker: one button per available next step */
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
              {workflow.options.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => chooseOption(workflow.pkgId, opt)}
                  disabled={advancing}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "11px 18px", borderRadius: 10,
                    background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.35)",
                    color: "#ea580c", fontSize: 14, fontWeight: 700,
                    cursor: advancing ? "not-allowed" : "pointer", opacity: advancing ? 0.7 : 1,
                  }}
                >
                  <ArrowRight size={15} />
                  {opt.label}
                  {opt.require_note && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 5,
                      background: "rgba(249,115,22,0.18)", color: "#c2410c",
                    }}>note</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Last scanned package */}
      {lastResult?.success && lastResult.pkg && (
        <div style={{
          background: t.card, borderRadius: 14,
          border: "1px solid rgba(34,197,94,0.3)",
          boxShadow: t.shadow, padding: 20, marginBottom: 20,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
          }}>
            <CheckCircle2 size={20} style={{ color: "#22c55e" }} />
            <span style={{
              fontSize: 14, fontWeight: 700, color: "#16a34a", flex: 1,
            }}>
              Colis accepte avec succes
            </span>
            <button onClick={() => setShowLabel(true)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 8,
              border: "1px solid #e5e7eb", background: "transparent", color: "#6b7280",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>
              <Printer size={12} /> Étiquette
            </button>
          </div>
          {showLabel && lastResult?.pkg && <PackageLabel pkg={lastResult.pkg} onClose={() => setShowLabel(false)} />}

          <div style={{
            display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start",
          }}>
            {/* Tracking */}
            <div style={{ minWidth: 160 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: t.textMuted,
                textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
              }}>
                N Tracking
              </div>
              <div style={{
                fontSize: 18, fontWeight: 800, fontFamily: "monospace",
                color: t.text,
              }}>
                {lastResult.pkg.external_shipment?.external_tracking ?? lastResult.pkg.tracking_number}
              </div>
              {lastResult.pkg.routing_type === "external" && (
                <span style={{
                  display: "inline-block", marginTop: 4,
                  padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
                  background: "rgba(249,115,22,0.12)", color: "#ea580c",
                  letterSpacing: "0.5px",
                }}>EXTERNE</span>
              )}
            </div>

            {/* Sender */}
            <div style={{ minWidth: 140 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: t.textMuted,
                textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <User size={11} /> Expediteur
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                {lastResult.pkg.sender_name}
              </div>
            </div>

            {/* Recipient + Wilaya */}
            <div style={{ minWidth: 160 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: t.textMuted,
                textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <MapPin size={11} /> Destinataire
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                {lastResult.pkg.recipient_name}
              </div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                {lastResult.pkg.recipient_wilaya?.name ?? "---"}
              </div>
            </div>

            {/* Service type */}
            <div style={{ minWidth: 100 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: t.textMuted,
                textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <Truck size={11} /> Service
              </div>
              <ServiceBadge type={lastResult.pkg.service_type} />
            </div>

            {/* Status */}
            <div style={{ minWidth: 120 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: t.textMuted,
                textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <Package2 size={11} /> Statut
              </div>
              <StatusBadge status={lastResult.pkg.status} />
            </div>

            {/* Delivery type */}
            <div style={{ minWidth: 100 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: t.textMuted,
                textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4,
              }}>
                Type livraison
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: lastResult.pkg.delivery_type === "home_delivery" ? "#f97316" : "#3b82f6",
              }}>
                {lastResult.pkg.delivery_type === "home_delivery" ? "À domicile" : "Stop desk"}
              </span>
            </div>
          </div>

          {/* Pickup: Gratuit/Payant info + pay driver button */}
          {lastResult.pkg.service_type === "pickup" && (
            <div style={{
              marginTop: 16, padding: "14px 18px", borderRadius: 12,
              background: (lastResult.pkg as any).pickup_free
                ? "rgba(16,185,129,0.06)" : "rgba(249,115,22,0.06)",
              border: `1px solid ${(lastResult.pkg as any).pickup_free
                ? "rgba(16,185,129,0.15)" : "rgba(249,115,22,0.15)"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {(lastResult.pkg as any).pickup_free
                  ? <Gift size={18} style={{ color: "#10b981" }} />
                  : <Banknote size={18} style={{ color: "#f97316" }} />
                }
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                    Ramassage {(lastResult.pkg as any).pickup_free ? "gratuit" : "payant"}
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted }}>
                    {(lastResult.pkg as any).pickup_free
                      ? `Le SD doit payer le chauffeur ${(lastResult.pkg as any).pickup_fee ?? 0} DA`
                      : "Le chauffeur a déjà été payé par l'expéditeur"
                    }
                  </div>
                  {lastResult.pkg.driver && (
                    <div style={{ fontSize: 11, color: "#0ea5e9", fontWeight: 500, marginTop: 2 }}>
                      Chauffeur: {(lastResult.pkg.driver as any).first_name} {(lastResult.pkg.driver as any).last_name}
                    </div>
                  )}
                </div>
              </div>
              {(lastResult.pkg as any).pickup_free && (lastResult.pkg as any).pickup_fee > 0 && !driverPaid[lastResult.pkg.id] && (
                <button
                  onClick={async () => {
                    const pkg = lastResult.pkg!;
                    const fee = (pkg as any).pickup_fee ?? 0;
                    const user = getStoredUser();
                    // 1. Pay driver from SD caisse
                    const caisseRes = await api<any[]>("/caisse/balances");
                    if (caisseRes.success && caisseRes.data) {
                      const myCaisse = caisseRes.data.find((c: any) => c.stop_desk?.id === user?.stop_desk_id);
                      if (myCaisse) {
                        await createCaisseTransaction({
                          caisse_id: myCaisse.id,
                          type: "expense",
                          amount: fee,
                          description: `Frais ramassage chauffeur — ${pkg.tracking_number}`,
                        });
                      }
                    }
                    // 2. Package already accepted on scan; just mark driver as paid
                    setDriverPaid(prev => ({ ...prev, [pkg.id]: true }));
                  }}
                  style={{
                    padding: "8px 18px", borderRadius: 10, border: "none",
                    background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Banknote size={14} /> Payer {(lastResult.pkg as any).pickup_fee} DA et accepter
                </button>
              )}
              {driverPaid[lastResult.pkg.id] && (
                <span style={{
                  fontSize: 12, fontWeight: 700, color: "#10b981",
                  background: "rgba(16,185,129,0.1)", padding: "6px 14px", borderRadius: 99,
                }}>
                  ✓ Payé et accepté
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scanned today list */}
      {scannedToday.length > 0 && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          boxShadow: t.shadow, overflow: "hidden",
        }}>
          {/* List header */}
          <div style={{
            padding: "14px 18px",
            borderBottom: `1px solid ${t.border}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Clock size={15} style={{ color: t.textMuted }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
              Colis scannes ({scannedToday.length})
            </span>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 520px)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{
                    padding: "10px 14px", fontSize: 11, fontWeight: 700,
                    color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
                    textAlign: "left", whiteSpace: "nowrap", position: "sticky", top: 0,
                    background: t.card, borderBottom: `1px solid ${t.border}`, zIndex: 2,
                  }}>
                    # Tracking
                  </th>
                  <th style={{
                    padding: "10px 14px", fontSize: 11, fontWeight: 700,
                    color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
                    textAlign: "left", whiteSpace: "nowrap", position: "sticky", top: 0,
                    background: t.card, borderBottom: `1px solid ${t.border}`, zIndex: 2,
                  }}>
                    Expediteur
                  </th>
                  <th style={{
                    padding: "10px 14px", fontSize: 11, fontWeight: 700,
                    color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
                    textAlign: "left", whiteSpace: "nowrap", position: "sticky", top: 0,
                    background: t.card, borderBottom: `1px solid ${t.border}`, zIndex: 2,
                  }}>
                    Destination
                  </th>
                  <th style={{
                    padding: "10px 14px", fontSize: 11, fontWeight: 700,
                    color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
                    textAlign: "left", whiteSpace: "nowrap", position: "sticky", top: 0,
                    background: t.card, borderBottom: `1px solid ${t.border}`, zIndex: 2,
                  }}>
                    Service
                  </th>
                  <th style={{
                    padding: "10px 14px", fontSize: 11, fontWeight: 700,
                    color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.5px",
                    textAlign: "right", whiteSpace: "nowrap", position: "sticky", top: 0,
                    background: t.card, borderBottom: `1px solid ${t.border}`, zIndex: 2,
                  }}>
                    Heure
                  </th>
                </tr>
              </thead>
              <tbody>
                {scannedToday.map((item, idx) => (
                  <tr
                    key={`${item.pkg.tracking_number}-${idx}`}
                    style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{
                      padding: "10px 14px", fontSize: 12, color: t.text,
                      borderBottom: `1px solid ${t.divider}`, whiteSpace: "nowrap",
                      fontFamily: "monospace", fontWeight: 700,
                    }}>
                      {item.pkg.external_shipment?.external_tracking ?? item.pkg.tracking_number}
                      {item.pkg.routing_type === "external" && (
                        <span style={{ marginLeft: 6, padding: "1px 5px", borderRadius: 4, fontSize: 9, fontWeight: 700, background: "rgba(249,115,22,0.1)", color: "#ea580c" }}>EXT</span>
                      )}
                    </td>
                    <td style={{
                      padding: "10px 14px", fontSize: 13, color: t.text,
                      borderBottom: `1px solid ${t.divider}`, whiteSpace: "nowrap",
                    }}>
                      <span style={{ fontWeight: 600 }}>{item.pkg.sender_name}</span>
                    </td>
                    <td style={{
                      padding: "10px 14px", fontSize: 13, color: t.textSub,
                      borderBottom: `1px solid ${t.divider}`, whiteSpace: "nowrap",
                    }}>
                      {item.pkg.recipient_wilaya?.name ?? "---"}
                    </td>
                    <td style={{
                      padding: "10px 14px", fontSize: 13, color: t.text,
                      borderBottom: `1px solid ${t.divider}`, whiteSpace: "nowrap",
                    }}>
                      <ServiceBadge type={item.pkg.service_type} />
                    </td>
                    <td style={{
                      padding: "10px 14px", fontSize: 12, color: t.textMuted,
                      borderBottom: `1px solid ${t.divider}`, whiteSpace: "nowrap",
                      textAlign: "right", fontFamily: "monospace",
                    }}>
                      {formatTime(item.scannedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state when no scans yet */}
      {scannedToday.length === 0 && !lastResult && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          boxShadow: t.shadow, padding: "48px 24px",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: t.iconBg, marginBottom: 14,
          }}>
            <ScanBarcode size={26} style={{ color: t.textFaint }} />
          </div>
          <p style={{
            fontSize: 15, fontWeight: 700, color: t.textMuted,
            margin: 0, marginBottom: 4,
          }}>
            Aucun colis scanne
          </p>
          <p style={{
            fontSize: 13, color: t.textFaint, margin: 0,
            textAlign: "center", maxWidth: 320,
          }}>
            Scannez le code-barres d&apos;un colis pour changer son statut de
            &quot;Pret a expedier&quot; vers &quot;Accepte operateur&quot;
          </p>
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
