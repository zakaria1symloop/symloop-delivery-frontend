"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ScanBarcode, Search, Loader2, CheckCircle2, XCircle,
  Truck, MapPin, Package2, Banknote, X, AlertTriangle, Printer, ArrowLeftRight,
} from "lucide-react";
import { api, getStoredUser, isSDLocked, getLockedSDId } from "@/lib/api";
import { getLocalDrivers, assignPackageToDriver, type DriverKPIs } from "@/lib/drivers";
import type { Package } from "@/lib/packages";
import SDSelector from "@/components/SDSelector";
import DriverSelector from "@/components/DriverSelector";
import PackageLabel from "@/components/PackageLabel";

/* ── SD option type ──────────────────────────────────────── */
interface SDOption {
  id: number;
  name: string;
  code: string | null;
  type: string;
  parent_sd_id: number | null;
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

/* ── scanned item type ───────────────────────────────────── */
interface ScannedItem {
  package: Package;
  driver_fee: number;
  exchange_return?: Package | null;
}

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
    inp:       { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
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
    shadow:    "0 1px 2px rgba(0,0,0,0.06)",
    inp:       { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── helpers ─────────────────────────────────────────────── */
function formatDA(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  return Number(n).toLocaleString("fr-DZ") + " DA";
}

/* ── toast component ─────────────────────────────────────── */
function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const ms = type === "success" ? 3000 : 4000;
    const timer = setTimeout(onDone, ms);
    return () => clearTimeout(timer);
  }, [onDone, type]);

  return (
    <div style={{
      position: "fixed", top: 24, right: 24, zIndex: 99999,
      display: "flex", alignItems: "center", gap: 10,
      padding: "14px 22px", borderRadius: 12,
      background: type === "success" ? "#059669" : "#dc2626",
      color: "#fff", fontSize: 14, fontWeight: 600,
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      animation: "slideIn 0.3s ease-out",
    }}>
      {type === "success"
        ? <CheckCircle2 size={18} />
        : <AlertTriangle size={18} />}
      {message}
    </div>
  );
}

/* ── vehicle type labels ─────────────────────────────────── */
const VEHICLE_LABELS: Record<string, string> = {
  voiture: "Voiture",
  moto: "Moto",
  camionnette: "Camionnette",
  camion: "Camion",
  velo: "Velo",
};

const ATTRIB_SD_KEY = "attrib_chauffeur_selected_sd";

/* ── main page ───────────────────────────────────────────── */
export default function AttributionChauffeurPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  // SD context
  const [stopDesks, setStopDesks] = useState<SDOption[]>([]);
  const [selectedSD, setSelectedSD] = useState<number | null>(null);
  const sdLoaded = useRef(false);

  // Drivers
  const [drivers, setDrivers] = useState<DriverKPIs[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);

  // Scan
  const [scanValue, setScanValue] = useState("");
  const [scanFocused, setScanFocused] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // Scanned items
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [printLabelPkg, setPrintLabelPkg] = useState<Package | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const selectedDriver = drivers.find(d => d.id === selectedDriverId) ?? null;

  // ── Load stop desks ──────────────────────────────────────
  useEffect(() => {
    api<SDOption[]>("/stop-desks").then(res => {
      if (res.success && res.data) {
        setStopDesks(res.data);
        const lockedId = getLockedSDId(getStoredUser());
        if (lockedId !== null) { setSelectedSD(lockedId); sdLoaded.current = true; return; }
        const saved = localStorage.getItem(ATTRIB_SD_KEY);
        if (saved) {
          const id = Number(saved);
          if (res.data.some(sd => sd.id === id)) { setSelectedSD(id); sdLoaded.current = true; return; }
        }
        sdLoaded.current = true;
      }
    });
  }, []);

  // ── Persist SD selection ─────────────────────────────────
  useEffect(() => {
    if (selectedSD !== null && !isSDLocked(getStoredUser())) {
      localStorage.setItem(ATTRIB_SD_KEY, String(selectedSD));
    }
  }, [selectedSD]);

  // ── Load drivers when SD changes ─────────────────────────
  useEffect(() => {
    if (selectedSD === null) { setDrivers([]); setSelectedDriverId(null); return; }
    setDriversLoading(true);
    setSelectedDriverId(null);
    setScannedItems([]);
    getLocalDrivers({ stop_desk_id: selectedSD }).then(res => {
      if (res.success && res.data) {
        setDrivers(res.data);
      } else {
        setDrivers([]);
      }
    }).finally(() => setDriversLoading(false));
  }, [selectedSD]);

  // ── Reset scanned items when driver changes ──────────────
  useEffect(() => {
    setScannedItems([]);
  }, [selectedDriverId]);

  // ── Focus scan input when driver selected ────────────────
  useEffect(() => {
    if (selectedDriverId !== null) {
      setTimeout(() => scanRef.current?.focus(), 100);
    }
  }, [selectedDriverId]);

  // ── Handle scan ──────────────────────────────────────────
  const handleScan = useCallback(async () => {
    const tracking = scanValue.trim();
    if (!tracking || !selectedDriverId || scanning) return;

    setScanning(true);
    try {
      const res = await assignPackageToDriver(selectedDriverId, tracking);
      if (res.success && res.data) {
        const pkg = res.data as any;
        const driverFee = (res as any).driver_fee ?? pkg.driver_fee ?? 0;
        const exchReturn = (res as any).exchange_return ?? null;
        setScannedItems(prev => [{
          package: pkg,
          driver_fee: driverFee,
          exchange_return: exchReturn,
        }, ...prev]);
        setToast({
          message: exchReturn
            ? `Assigné — ${tracking} (ÉCHANGE: imprimer étiquette ${exchReturn.tracking_number})`
            : `Assigné — ${tracking}`,
          type: "success",
        });
        // Update driver's current_packages count locally
        setDrivers(prev => prev.map(d =>
          d.id === selectedDriverId
            ? { ...d, current_packages: d.current_packages + 1 }
            : d
        ));
      } else {
        setToast({ message: res.message || "Erreur lors de l'attribution", type: "error" });
      }
    } catch {
      setToast({ message: "Erreur de connexion au serveur", type: "error" });
    } finally {
      setScanValue("");
      setScanning(false);
      setTimeout(() => scanRef.current?.focus(), 50);
    }
  }, [scanValue, selectedDriverId, scanning]);

  // ── Handle "Terminer" ────────────────────────────────────
  const handleTerminer = useCallback(() => {
    setSelectedDriverId(null);
    setScannedItems([]);
    setScanValue("");
  }, []);

  // ── Compute totals ──────────────────────────────────────
  const totalCOD = scannedItems.reduce((sum, item) => sum + (item.package.cod_amount || 0), 0);
  const totalFrais = scannedItems.reduce((sum, item) => sum + (item.package.shipping_cost || 0), 0);
  const totalChauffeur = scannedItems.reduce((sum, item) => sum + (item.driver_fee || 0), 0);

  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, marginBottom: 20,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(249,115,22,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <ScanBarcode size={22} style={{ color: "#f97316" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: t.text, margin: 0, lineHeight: 1.2 }}>
            Attribution Chauffeur
          </h1>
          <p style={{ fontSize: 13, color: t.textMuted, margin: 0, marginTop: 2 }}>
            Scanner les colis pour les attribuer au chauffeur local
          </p>
        </div>
      </div>

      {/* SD Selector bar */}
      <div style={{
        background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
        padding: 16, marginBottom: 16, boxShadow: t.shadow,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 260px", minWidth: 200 }}>
          <SDSelector
            stopDesks={stopDesks}
            value={selectedSD}
            onChange={id => { setSelectedSD(id); }}
            disabled={isSDLocked(getStoredUser())}
          />
        </div>
        {isSDLocked(getStoredUser()) && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: "#f97316",
            background: "rgba(249,115,22,0.1)", padding: "4px 10px", borderRadius: 99,
          }}>
            Verrouille sur votre SD
          </span>
        )}
      </div>

      {/* Driver Selection */}
      {selectedSD !== null && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          padding: 20, marginBottom: 16, boxShadow: t.shadow,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: t.textMuted, marginBottom: 12,
            textTransform: "uppercase", letterSpacing: "0.04em",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Truck size={15} style={{ color: "#f97316" }} />
            Selectionner un chauffeur
          </div>

          {driversLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", color: t.textMuted, fontSize: 13 }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
              Chargement des chauffeurs...
            </div>
          ) : drivers.length === 0 ? (
            <div style={{
              padding: "20px 0", textAlign: "center", color: t.textMuted, fontSize: 13,
            }}>
              Aucun chauffeur local pour ce Stop Desk
            </div>
          ) : (
            <DriverSelector
              drivers={drivers}
              value={selectedDriverId}
              onChange={setSelectedDriverId}
            />
          )}

          {/* Driver info card */}
          {selectedDriver && (
            <div style={{
              marginTop: 16, padding: 16, borderRadius: 12,
              border: `1px solid ${t.border}`, background: isDark ? "#1a1f2e" : "#f9fafb",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                {/* Name & Phone */}
                <div style={{ flex: "1 1 180px", minWidth: 150 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t.text, lineHeight: 1.3 }}>
                    {selectedDriver.first_name} {selectedDriver.last_name}
                  </div>
                  {selectedDriver.phone && (
                    <div style={{ fontSize: 13, color: t.textSub, marginTop: 4 }}>
                      {selectedDriver.phone}
                    </div>
                  )}
                </div>

                {/* Vehicle */}
                <div style={{ flex: "0 0 auto" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8,
                    background: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.06)",
                    border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.15)"}`,
                  }}>
                    <Truck size={14} style={{ color: "#3b82f6" }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6" }}>
                      {VEHICLE_LABELS[selectedDriver.vehicle_type ?? ""] ?? selectedDriver.vehicle_type ?? "\u2014"}
                    </span>
                    {selectedDriver.vehicle_plate && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: t.text,
                        background: isDark ? "#2a3145" : "#e5e7eb",
                        padding: "2px 8px", borderRadius: 6, marginLeft: 4,
                        fontFamily: "monospace", letterSpacing: "0.05em",
                      }}>
                        {selectedDriver.vehicle_plate}
                      </span>
                    )}
                  </div>
                </div>

                {/* Current packages count */}
                <div style={{ flex: "0 0 auto" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8,
                    background: isDark ? "rgba(249,115,22,0.1)" : "rgba(249,115,22,0.06)",
                    border: `1px solid ${isDark ? "rgba(249,115,22,0.2)" : "rgba(249,115,22,0.15)"}`,
                  }}>
                    <Package2 size={14} style={{ color: "#f97316" }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#f97316" }}>
                      {selectedDriver.current_packages} colis
                    </span>
                  </div>
                </div>
              </div>

              {/* Communes chips */}
              {selectedDriver.communes.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: t.textMuted,
                    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <MapPin size={12} style={{ color: "#10b981" }} />
                    Communes ({selectedDriver.communes.length})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {selectedDriver.communes.map(c => (
                      <span key={c.id} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "4px 10px", borderRadius: 99,
                        fontSize: 11, fontWeight: 600,
                        background: isDark ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.06)",
                        color: "#10b981",
                        border: `1px solid ${isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.15)"}`,
                      }}>
                        {c.name}
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: isDark ? "#d1d5db" : "#374151",
                          background: isDark ? "#2a3145" : "#e5e7eb",
                          padding: "1px 6px", borderRadius: 99, marginLeft: 2,
                        }}>
                          {Number(c.price).toLocaleString("fr-DZ")} DA
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scan Input (visible when driver selected) */}
      {selectedDriverId !== null && selectedDriver && (
        <>
          <div style={{
            background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
            padding: 20, marginBottom: 16, boxShadow: t.shadow,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: t.textMuted, marginBottom: 12,
              textTransform: "uppercase", letterSpacing: "0.04em",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <ScanBarcode size={15} style={{ color: "#f97316" }} />
              Scanner un colis
            </div>

            <form
              onSubmit={e => { e.preventDefault(); handleScan(); }}
              style={{ display: "flex", gap: 10, alignItems: "center" }}
            >
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  ref={scanRef}
                  value={scanValue}
                  onChange={e => setScanValue(e.target.value)}
                  onFocus={() => setScanFocused(true)}
                  onBlur={() => setScanFocused(false)}
                  placeholder="Scanner le code-barres..."
                  disabled={scanning}
                  autoComplete="off"
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: 12,
                    border: `2px solid ${scanFocused ? "#f97316" : t.inp.border}`,
                    background: t.inp.bg, color: t.inp.text,
                    fontSize: 18, fontFamily: "monospace", letterSpacing: "0.05em",
                    fontWeight: 600, outline: "none",
                    transition: "border-color 150ms",
                  }}
                />
                {scanning && (
                  <div style={{
                    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  }}>
                    <Loader2 size={20} style={{ color: "#f97316", animation: "spin 1s linear infinite" }} />
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={!scanValue.trim() || scanning}
                style={{
                  padding: "14px 24px", borderRadius: 12, border: "none",
                  background: !scanValue.trim() || scanning ? (isDark ? "#2a3145" : "#e5e7eb") : "#f97316",
                  color: !scanValue.trim() || scanning ? t.textMuted : "#fff",
                  fontSize: 14, fontWeight: 700, cursor: !scanValue.trim() || scanning ? "default" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "all 150ms",
                  flexShrink: 0,
                }}
              >
                <ScanBarcode size={16} />
                Attribuer
              </button>
            </form>
          </div>

          {/* Scanned Packages Table */}
          {scannedItems.length > 0 && (
            <div style={{
              background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
              padding: 20, marginBottom: 16, boxShadow: t.shadow,
              overflowX: "auto",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 14,
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: t.textMuted,
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Package2 size={15} style={{ color: "#10b981" }} />
                  Colis attribues ({scannedItems.length})
                </div>
              </div>

              <table style={{
                width: "100%", borderCollapse: "collapse", fontSize: 13,
              }}>
                <thead>
                  <tr>
                    {["#", "Tracking", "Destinataire", "Commune", "COD", "Frais Livr.", "Frais Chauff.", ""].map((h, i) => (
                      <th key={i} style={{
                        padding: "10px 12px",
                        textAlign: i >= 4 ? "right" : "left",
                        fontSize: 11, fontWeight: 700, color: t.textMuted,
                        textTransform: "uppercase", letterSpacing: "0.04em",
                        borderBottom: `2px solid ${t.border}`,
                        whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scannedItems.map((item, idx) => (
                    <tr
                      key={item.package.id}
                      onMouseEnter={e => { e.currentTarget.style.background = t.rowHover; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                      style={{ transition: "background 100ms" }}
                    >
                      <td style={{
                        padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                        color: t.textFaint, fontSize: 12, fontWeight: 600,
                      }}>
                        {scannedItems.length - idx}
                      </td>
                      <td style={{
                        padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                        fontFamily: "monospace", fontWeight: 700, color: t.text,
                        letterSpacing: "0.03em", fontSize: 13,
                      }}>
                        {item.package.tracking_number}
                      </td>
                      <td style={{
                        padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                        color: t.text, fontWeight: 500,
                      }}>
                        {item.package.recipient_name}
                      </td>
                      <td style={{
                        padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                        color: t.textSub, fontSize: 12,
                      }}>
                        {item.package.recipient_commune?.name ?? "\u2014"}
                      </td>
                      <td style={{
                        padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                        textAlign: "right", fontWeight: 700, color: t.text,
                        fontFamily: "monospace",
                      }}>
                        {formatDA(item.package.cod_amount)}
                      </td>
                      <td style={{
                        padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                        textAlign: "right", fontWeight: 600, color: t.textSub,
                        fontFamily: "monospace",
                      }}>
                        {formatDA(item.package.shipping_cost)}
                      </td>
                      <td style={{
                        padding: "10px 12px", borderBottom: `1px solid ${t.divider}`,
                        textAlign: "right", fontWeight: 600, color: "#f97316",
                        fontFamily: "monospace",
                      }}>
                        {formatDA(item.driver_fee)}
                      </td>
                      <td style={{
                        padding: "10px 8px", borderBottom: `1px solid ${t.divider}`,
                        textAlign: "center",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                          <button onClick={() => setPrintLabelPkg(item.package)} title="Étiquette colis" style={{
                            width: 26, height: 26, borderRadius: 6, display: "inline-flex",
                            alignItems: "center", justifyContent: "center",
                            background: "transparent", border: "none", cursor: "pointer", color: t.textFaint,
                          }}
                            onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
                            onMouseLeave={e => (e.currentTarget.style.color = t.textFaint)}
                          >
                            <Printer size={14} />
                          </button>
                          {item.exchange_return && (
                            <button onClick={() => setPrintLabelPkg(item.exchange_return!)} title={`Étiquette retour échange ${item.exchange_return.tracking_number}`} style={{
                              display: "inline-flex", alignItems: "center", gap: 3,
                              padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer",
                              background: "rgba(139,92,246,0.1)", color: "#7c3aed",
                              fontSize: 10, fontWeight: 700,
                            }}>
                              <ArrowLeftRight size={11} /> ECH
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr style={{ background: isDark ? "#1a1f2e" : "#f9fafb" }}>
                    <td colSpan={4} style={{
                      padding: "12px 12px", borderTop: `2px solid ${t.border}`,
                      fontSize: 12, fontWeight: 800, color: t.textMuted,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      Totaux
                    </td>
                    <td style={{
                      padding: "12px 12px", borderTop: `2px solid ${t.border}`,
                      textAlign: "right", fontWeight: 800, color: t.text,
                      fontFamily: "monospace", fontSize: 14,
                    }}>
                      {formatDA(totalCOD)}
                    </td>
                    <td style={{
                      padding: "12px 12px", borderTop: `2px solid ${t.border}`,
                      textAlign: "right", fontWeight: 700, color: t.textSub,
                      fontFamily: "monospace", fontSize: 14,
                    }}>
                      {formatDA(totalFrais)}
                    </td>
                    <td style={{
                      padding: "12px 12px", borderTop: `2px solid ${t.border}`,
                      textAlign: "right", fontWeight: 800, color: "#f97316",
                      fontFamily: "monospace", fontSize: 14,
                    }}>
                      {formatDA(totalChauffeur)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Terminer button */}
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 20,
          }}>
            <button
              onClick={handleTerminer}
              style={{
                padding: "12px 32px", borderRadius: 12, border: "none",
                background: isDark ? "#2a3145" : "#1f2937",
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                transition: "opacity 150ms",
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
            >
              <X size={16} />
              Terminer
            </button>
          </div>
        </>
      )}

      {/* Empty state when no SD selected */}
      {selectedSD === null && (
        <div style={{
          background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
          padding: "48px 24px", textAlign: "center", boxShadow: t.shadow,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto 16px",
            background: "rgba(249,115,22,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ScanBarcode size={28} style={{ color: "#f97316" }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>
            Selectionnez un Stop Desk
          </div>
          <div style={{ fontSize: 13, color: t.textMuted }}>
            Choisissez un Stop Desk ci-dessus pour commencer l'attribution
          </div>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {printLabelPkg && <PackageLabel pkg={printLabelPkg} onClose={() => setPrintLabelPkg(null)} />}
    </div>
  );
}
