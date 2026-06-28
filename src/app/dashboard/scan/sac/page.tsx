"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ScanBarcode, Loader2, AlertTriangle, Archive, MapPin, Clock,
  History, ArrowRight, Printer, Package2, X, RotateCcw, User, Truck, Activity,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";

/* ─── theme ─────────────────────────────────────────────────────── */
function useIsDark() {
  const [dark, setDark] = useState(() => typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false);
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
    bg: "#0e1017", card: "#111827", cardAlt: "#141c2f", border: "#1e2130", divider: "#1e2130", rowHover: "#1a1f2e",
    text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280", textFaint: "#4b5563",
    inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", cardAlt: "#fafbfc", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}
type Tokens = ReturnType<typeof useTokens>;

/* ─── helpers ───────────────────────────────────────────────────── */
function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const BAG_STATUS_LABELS: Record<string, string> = {
  cree: "Créé", scelle: "Scellé", en_transit: "En transit",
  recu: "Reçu", deballe: "Déballé", annule: "Annulé",
};

const BAG_STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  cree:       { bg: "rgba(148,163,184,0.12)", text: "#64748b", dot: "#94a3b8" },
  scelle:     { bg: "rgba(59,130,246,0.12)",  text: "#3b82f6", dot: "#60a5fa" },
  en_transit: { bg: "rgba(168,85,247,0.12)",  text: "#a855f7", dot: "#c084fc" },
  recu:       { bg: "rgba(34,197,94,0.12)",   text: "#22c55e", dot: "#4ade80" },
  deballe:    { bg: "rgba(22,163,74,0.12)",   text: "#16a34a", dot: "#22c55e" },
  annule:     { bg: "rgba(239,68,68,0.12)",   text: "#ef4444", dot: "#f87171" },
};

/* ─── types ─────────────────────────────────────────────────────── */
type ScanLog = {
  id: number;
  action: string;
  action_label: string;
  notes: string | null;
  created_at: string;
  scanned_by?: { first_name: string; last_name: string } | null;
  stop_desk?: { name: string } | null;
};

type BagPackage = {
  id: number;
  tracking_number: string;
  recipient_name: string;
  recipient_phone: string;
  status: string;
  cod_amount: number;
};

type BagData = {
  id: number;
  tracking_number: string;
  type: "aller" | "retour";
  status: string;
  status_label: string;
  packages_count: number;
  created_at: string;
  sealed_at: string | null;
  transit_at: string | null;
  received_at: string | null;
  origin_stop_desk?: { id: number; name: string; commune?: { name: string; wilaya?: { name: string } } } | null;
  destination_stop_desk?: { id: number; name: string; commune?: { name: string; wilaya?: { name: string } } } | null;
  destination_wilaya?: { name: string } | null;
  transit_driver?: { first_name: string; last_name: string } | null;
  creator?: { first_name: string; last_name: string } | null;
  packages: BagPackage[];
};

type LabelData = {
  tracking_number: string;
  name: string;
  qr_data: string;
  origin: { selling_point?: string; wilaya?: string };
  destination: { selling_point?: string; commune?: string; wilaya?: string };
  package_count: number;
  status: string;
  status_label: string;
};

/* ─── main ──────────────────────────────────────────────────────── */
export default function ScanSacPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const inputRef = useRef<HTMLInputElement>(null);

  const [tracking, setTracking] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bag, setBag] = useState<BagData | null>(null);
  const [history, setHistory] = useState<ScanLog[]>([]);
  const [labelData, setLabelData] = useState<LabelData | null>(null);
  const [showLabel, setShowLabel] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("scan_sac_recent");
    if (raw) { try { setRecent(JSON.parse(raw)); } catch {} }
    inputRef.current?.focus();
  }, []);

  const search = useCallback(async (tn: string) => {
    if (!tn.trim()) return;
    setLoading(true); setError(null);
    setBag(null); setHistory([]); setLabelData(null);
    const res = await api<any>(`/scan/bag/${encodeURIComponent(tn.trim())}`);
    if (res.success && res.data) {
      setBag(res.data.bag);
      setHistory(res.data.history ?? []);
      setLabelData(res.data.label_data);
      setRecent(prev => {
        const next = [tn.trim(), ...prev.filter(x => x !== tn.trim())].slice(0, 10);
        localStorage.setItem("scan_sac_recent", JSON.stringify(next));
        return next;
      });
    } else {
      setError(res.message ?? "Sac non trouvé");
    }
    setLoading(false);
  }, []);

  function onSubmit(e: React.FormEvent) { e.preventDefault(); search(tracking); }

  useEffect(() => {
    const v = tracking.trim();
    if (!v) return;
    const isComplete = /^[A-Z]{2,5}-\d{6,8}-[A-Z0-9]{4,8}$/i.test(v);
    if (isComplete) {
      const timer = setTimeout(() => search(v), 100);
      return () => clearTimeout(timer);
    }
  }, [tracking, search]);

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").trim();
    if (pasted) {
      e.preventDefault();
      setTracking(pasted);
      setTimeout(() => search(pasted), 50);
    }
  }

  function resetScan() {
    setTracking(""); setBag(null); setHistory([]); setLabelData(null); setError(null);
    inputRef.current?.focus();
  }

  const statusColor = bag ? (BAG_STATUS_COLORS[bag.status] ?? BAG_STATUS_COLORS.cree) : null;
  const isReturn = bag?.type === "retour";
  const accent = isReturn ? "#ef4444" : "#f97316";

  return (
    <div style={{
      padding: "24px 28px", minHeight: "100vh", background: t.bg,
      fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))",
    }}>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes drawLine { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes ping { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.5); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .reveal { animation: slideUp 0.4s ease-out both; }
        .reveal-1 { animation-delay: 0.03s; }
        .reveal-2 { animation-delay: 0.09s; }
        .reveal-3 { animation-delay: 0.15s; }
        .reveal-4 { animation-delay: 0.21s; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)",
        }}>
          <Archive size={20} style={{ color: "#f97316" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: "-0.01em" }}>
            Scanner un Sac
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
            Scannez, collez ou tapez un numéro de sac — recherche automatique
          </p>
        </div>
        {bag && (
          <button onClick={resetScan} style={{
            padding: "9px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: t.card, color: t.textSub, border: `1px solid ${t.border}`,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          }}>
            <RotateCcw size={13} /> Nouveau scan
          </button>
        )}
      </div>

      {/* ── Scan input — hero card ── */}
      <form onSubmit={onSubmit} style={{
        background: `linear-gradient(135deg, ${t.card} 0%, ${t.cardAlt} 100%)`,
        borderRadius: 16, border: `1.5px solid ${t.border}`,
        padding: "22px 24px", marginBottom: 18,
        boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.02)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
          fontSize: 10, fontWeight: 700, color: t.textMuted,
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: loading ? "#f97316" : "#22c55e",
            boxShadow: loading ? "0 0 8px rgba(249,115,22,0.6)" : "0 0 8px rgba(34,197,94,0.5)",
          }} />
          {loading ? "Recherche en cours…" : "Prêt — en attente d'un code"}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Archive size={22} color="#f97316" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={tracking}
            onChange={e => setTracking(e.target.value)}
            onPaste={onPaste}
            placeholder="BAG-XXXXXXXX-XXXXXX"
            autoFocus
            style={{
              flex: 1, minWidth: 0, padding: "4px 0",
              border: "none", background: "transparent",
              color: t.text, fontSize: 22, fontWeight: 700,
              fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
              letterSpacing: "0.03em", outline: "none",
            }}
          />
          <button type="submit" disabled={loading || !tracking.trim()} style={{
            padding: "11px 22px", borderRadius: 11,
            background: "#f97316", color: "white", border: "none",
            fontSize: 13, fontWeight: 700,
            cursor: loading || !tracking.trim() ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: 7,
            opacity: loading || !tracking.trim() ? 0.5 : 1,
            boxShadow: loading || !tracking.trim() ? "none" : "0 2px 8px rgba(249,115,22,0.25)",
          }}>
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <ScanBarcode size={14} />}
            Rechercher
          </button>
        </div>

        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${t.divider}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 10, color: t.textFaint, fontWeight: 500,
        }}>
          <span>↵ Entrée pour valider · ⌘V pour coller</span>
          <span>Détection automatique du format</span>
        </div>
      </form>

      {/* ── Recent scans ── */}
      {!bag && !loading && !error && recent.length > 0 && (
        <div className="reveal" style={{ marginBottom: 18 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
            fontSize: 10, fontWeight: 700, color: t.textMuted,
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            <Clock size={11} /> Scans récents
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {recent.map(tn => (
              <button key={tn} onClick={() => { setTracking(tn); search(tn); }} style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
                border: `1px solid ${t.border}`, background: t.card, color: t.textSub,
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#f97316"; e.currentTarget.style.color = "#f97316"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSub; }}
              >{tn}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="reveal" style={{
          padding: "16px 20px", borderRadius: 14,
          background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.25)",
          display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <AlertTriangle size={16} color="#ef4444" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#dc2626", marginBottom: 2 }}>Non trouvé</div>
            <div style={{ fontSize: 11, color: "#991b1b" }}>{error}</div>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{
          padding: "60px 0", textAlign: "center", color: t.textMuted, fontSize: 12, fontWeight: 500,
        }}>
          <Loader2 size={24} color="#f97316" style={{ animation: "spin 0.8s linear infinite", marginBottom: 10 }} />
          <div>Recherche du sac…</div>
        </div>
      )}

      {/* ── Empty ── */}
      {!bag && !loading && !error && recent.length === 0 && (
        <div style={{
          padding: "70px 0", textAlign: "center",
          border: `1px dashed ${t.border}`, borderRadius: 14,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "rgba(249,115,22,0.08)", margin: "0 auto 14px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Archive size={24} color="#f97316" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Prêt à scanner</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>Commencez par saisir un numéro de sac ci-dessus</div>
        </div>
      )}

      {/* ── Bag panel ── */}
      {bag && statusColor && (
        <>
          {/* Identity bar */}
          <div className="reveal reveal-1" style={{
            background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
            padding: "18px 22px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
          }}>
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: t.textMuted,
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4,
              }}>Tracking number</div>
              <div style={{
                fontSize: 22, fontWeight: 800, color: t.text,
                fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
                letterSpacing: "0.01em", wordBreak: "break-all",
              }}>{bag.tracking_number}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: "6px 14px", borderRadius: 20,
                  background: isReturn ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)",
                  color: isReturn ? "#ef4444" : "#3b82f6",
                  letterSpacing: "0.08em",
                }}>{isReturn ? "RETOUR" : "ALLER"}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 20,
                  background: statusColor.bg, color: statusColor.text,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: statusColor.dot,
                    boxShadow: `0 0 6px ${statusColor.dot}`,
                  }} />
                  {BAG_STATUS_LABELS[bag.status] ?? bag.status}
                </span>
              </div>
              <span style={{
                fontSize: 10, color: t.textMuted, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>Contenu · <span style={{ color: t.textSub }}>{bag.packages_count} colis</span></span>
            </div>
          </div>

          {/* Main grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16, marginBottom: 16,
          }}>
            {/* Packages manifest */}
            <div className="reveal reveal-2" style={{
              background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
              overflow: "hidden", display: "flex", flexDirection: "column",
            }}>
              <div style={{
                padding: "16px 22px 12px",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ color: "#f97316", display: "flex" }}><Package2 size={13} /></span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: t.textMuted,
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>Colis dans le sac</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "#f97316",
                  background: "rgba(249,115,22,0.1)", padding: "2px 9px", borderRadius: 20,
                }}>{bag.packages.length}</span>
              </div>
              <div style={{ height: 1, background: t.divider }} />
              <div style={{ flex: 1, overflowY: "auto", maxHeight: 480 }}>
                {bag.packages.length === 0 ? (
                  <div style={{
                    padding: "60px 0", textAlign: "center", color: t.textFaint,
                    fontSize: 12, fontStyle: "italic",
                  }}>Aucun colis dans ce sac</div>
                ) : (
                  bag.packages.map((p, i) => (
                    <div key={p.id} style={{
                      padding: "12px 22px",
                      borderTop: i > 0 ? `1px dashed ${t.divider}` : "none",
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = t.rowHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700, color: t.text,
                          fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
                          marginBottom: 3,
                        }}>{p.tracking_number}</div>
                        <div style={{
                          fontSize: 11, color: t.textMuted,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {p.recipient_name} · {p.recipient_phone}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 12, fontWeight: 800, color: "#16a34a",
                        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                      }}>
                        {Number(p.cod_amount ?? 0).toLocaleString("fr-DZ")}
                        <span style={{ fontSize: 9, color: t.textMuted, marginLeft: 3, fontWeight: 600 }}>DA</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Route card */}
              <div className="reveal reveal-2" style={{
                background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
                padding: "20px 22px",
              }}>
                <SectionHeader icon={<MapPin size={13} />} title="Route" t={t} />

                <div style={{ position: "relative", padding: "16px 0 4px" }}>
                  <div style={{
                    position: "absolute", top: "50%", left: 12, right: 12, height: 2,
                    background: `linear-gradient(to right, #3b82f6, ${accent})`,
                    transform: "translateY(-50%)", transformOrigin: "left",
                    animation: "drawLine 0.7s ease-out 0.2s both",
                  }} />
                  <div style={{
                    position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <RouteNode color="#3b82f6" />
                    <RouteNode color={accent} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
                  <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: "#3b82f6",
                      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3,
                    }}>Origine</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, wordBreak: "break-word" }}>
                      {bag.origin_stop_desk?.name ?? "—"}
                    </div>
                    {bag.origin_stop_desk?.commune?.wilaya?.name && (
                      <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                        {bag.origin_stop_desk.commune.wilaya.name}
                      </div>
                    )}
                  </div>
                  <ArrowRight size={16} color={t.textFaint} style={{ marginTop: 6, flexShrink: 0 }} />
                  <div style={{ textAlign: "right", flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: accent,
                      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3,
                    }}>Destination</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, wordBreak: "break-word" }}>
                      {bag.destination_stop_desk?.name ?? bag.destination_wilaya?.name ?? "—"}
                    </div>
                    {bag.destination_stop_desk?.commune?.wilaya?.name && (
                      <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>
                        {bag.destination_stop_desk.commune.wilaya.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadata card */}
              <div className="reveal reveal-3" style={{
                background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
                padding: "18px 22px",
              }}>
                <SectionHeader icon={<Activity size={13} />} title="Métadonnées" t={t} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px" }}>
                  <MetaRow icon={<Clock size={11} />} label="Créé le" value={formatDate(bag.created_at)} t={t} />
                  {bag.sealed_at && <MetaRow icon={<Clock size={11} />} label="Scellé le" value={formatDate(bag.sealed_at)} t={t} />}
                  {bag.transit_at && <MetaRow icon={<Truck size={11} />} label="En transit" value={formatDate(bag.transit_at)} t={t} />}
                  {bag.received_at && <MetaRow icon={<Clock size={11} />} label="Reçu le" value={formatDate(bag.received_at)} t={t} />}
                  {bag.transit_driver && <MetaRow icon={<Truck size={11} />} label="Chauffeur" value={`${bag.transit_driver.first_name} ${bag.transit_driver.last_name}`} t={t} />}
                  {bag.creator && <MetaRow icon={<User size={11} />} label="Créé par" value={`${bag.creator.first_name} ${bag.creator.last_name}`} t={t} />}
                </div>
              </div>

              {/* Actions */}
              <div className="reveal reveal-4" style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowLabel(true)} style={{
                  flex: 1, padding: "13px 18px", borderRadius: 11,
                  background: "#f97316", color: "white", border: "none",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  boxShadow: "0 2px 8px rgba(249,115,22,0.25)",
                }}>
                  <Printer size={14} /> Imprimer l&apos;étiquette
                </button>
              </div>
            </div>
          </div>

          {/* Movement timeline */}
          {history.length > 0 && (
            <div className="reveal" style={{
              background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
              overflow: "hidden",
            }}>
              <div style={{
                padding: "14px 22px", borderBottom: `1px solid ${t.divider}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <History size={14} color={t.textMuted} />
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Historique des mouvements</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "#f97316",
                  background: "rgba(249,115,22,0.1)", padding: "2px 9px", borderRadius: 20,
                }}>{history.length}</span>
              </div>
              <div style={{ padding: "22px 26px 24px" }}>
                <div style={{ position: "relative", paddingLeft: 26 }}>
                  <div style={{
                    position: "absolute", left: 7, top: 6, bottom: 6, width: 2,
                    background: `repeating-linear-gradient(to bottom, ${t.divider} 0 4px, transparent 4px 8px)`,
                  }} />
                  {history.map((h, i) => (
                    <div key={h.id} style={{
                      position: "relative", paddingBottom: i === history.length - 1 ? 0 : 18,
                    }}>
                      <div style={{
                        position: "absolute", left: -26, top: 3, width: 16, height: 16, borderRadius: "50%",
                        background: t.card, border: `2px solid #f97316`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#f97316" }} />
                      </div>
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "baseline",
                        gap: 12, marginBottom: 3, flexWrap: "wrap",
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                          {h.action_label}
                        </div>
                        <div style={{ fontSize: 10, color: t.textMuted, whiteSpace: "nowrap" }}>
                          {formatDate(h.created_at)}
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: t.textMuted }}>
                        {h.scanned_by && <>{h.scanned_by.first_name} {h.scanned_by.last_name}</>}
                        {h.stop_desk && <> · {h.stop_desk.name}</>}
                      </div>
                      {h.notes && (
                        <div style={{
                          marginTop: 6, padding: "7px 10px",
                          background: t.rowHover, borderLeft: `2px solid #f97316`,
                          borderRadius: "0 8px 8px 0",
                          fontSize: 11, color: t.textSub, fontStyle: "italic",
                        }}>{h.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Label modal */}
      {showLabel && labelData && (
        <BagLabelModal labelData={labelData} onClose={() => setShowLabel(false)} isDark={isDark} />
      )}
    </div>
  );
}

/* ─── shared small components ───────────────────────────────────── */
function SectionHeader({ icon, title, t }: { icon: React.ReactNode; title: string; t: Tokens }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
      fontSize: 10, fontWeight: 700, color: t.textMuted,
      textTransform: "uppercase", letterSpacing: "0.08em",
    }}>
      <span style={{ color: "#f97316" }}>{icon}</span>
      {title}
    </div>
  );
}

function MetaRow({ icon, label, value, t }: { icon: React.ReactNode; label: string; value: string; t: Tokens }) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: t.textMuted, marginBottom: 2,
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <span style={{ color: t.textFaint }}>{icon}</span>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{value}</div>
    </div>
  );
}

function RouteNode({ color }: { color: string }) {
  return (
    <div style={{
      width: 18, height: 18, borderRadius: "50%",
      background: color, border: `2px solid ${color}`,
      position: "relative", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", inset: -5, borderRadius: "50%",
        border: `1.5px solid ${color}`,
        animation: "ping 1.8s ease-in-out infinite",
      }} />
    </div>
  );
}

/* ─── Bag Label Modal (adapted from old system) ─── */
function BagLabelModal({ labelData, onClose, isDark }: { labelData: LabelData; onClose: () => void; isDark: boolean }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const isReturn = labelData.name.toLowerCase().startsWith("retour");
  const direction = isReturn ? "RETOUR" : "ALLER";
  const originLabel = labelData.origin.selling_point || labelData.origin.wilaya || "-";
  const destLabel = labelData.destination.selling_point || labelData.destination.wilaya || "-";

  useEffect(() => {
    if (barcodeRef.current && labelData.tracking_number) {
      try {
        JsBarcode(barcodeRef.current, labelData.tracking_number, {
          format: "CODE128", width: 2, height: 60, displayValue: false, margin: 0,
        });
      } catch {}
    }
  }, [labelData.tracking_number]);

  function handlePrint() {
    const barcodeSvg = barcodeRef.current?.outerHTML || "";
    const qrSvg = qrRef.current?.querySelector("svg")?.outerHTML || "";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
<!DOCTYPE html><html><head><title>Sac - ${labelData.tracking_number}</title>
<style>
@page { size: 100mm 70mm; margin: 3mm; }
body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
.label { width: 94mm; padding: 3mm; box-sizing: border-box; border: 2px solid #000; position: relative; overflow: hidden; }
.direction-bar { text-align: center; font-size: 16pt; font-weight: bold; letter-spacing: 3px; padding: 2mm 0; border-bottom: 2px solid #000;
  background: ${isReturn ? "#000" : "#fff"}; color: ${isReturn ? "#fff" : "#000"}; }
.route { display: flex; align-items: center; justify-content: center; gap: 3mm; padding: 3mm 0; border-bottom: 1px solid #999; }
.route-point { text-align: center; font-size: 11pt; font-weight: bold; }
.route-arrow { font-size: 14pt; font-weight: bold; }
.codes-row { display: flex; align-items: center; justify-content: center; gap: 3mm; padding: 2mm 3mm; }
.barcode-section { flex: 1; text-align: center; }
.barcode-section svg { width: 100%; max-width: 55mm; height: 13mm; }
.qr-section { flex-shrink: 0; }
.qr-section svg { width: 18mm; height: 18mm; }
.code { text-align: center; font-size: 11pt; font-weight: bold; font-family: monospace; letter-spacing: 1px; padding: 1mm 0; }
.count { text-align: center; font-size: 20pt; font-weight: bold; padding: 2mm 0; border-top: 1px solid #999; }
${isReturn ? `.label::after { content: 'RETOUR'; position: absolute; top: 6mm; right: -12mm; background: #000; color: #fff; font-size: 7pt; font-weight: bold; letter-spacing: 2px; padding: 1mm 15mm; transform: rotate(45deg); }` : ""}
</style></head><body>
<div class="label">
<div class="direction-bar">${direction}</div>
<div class="route"><span class="route-point">${originLabel}</span><span class="route-arrow">&rarr;</span><span class="route-point">${destLabel}</span></div>
<div class="codes-row"><div class="barcode-section">${barcodeSvg}</div><div class="qr-section">${qrSvg}</div></div>
<div class="code">${labelData.tracking_number}</div>
<div class="count">${labelData.package_count} COLIS</div>
</div></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: isDark ? "#111827" : "#ffffff", borderRadius: 16, maxWidth: 460, width: "100%",
        overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: `1px solid ${isDark ? "#1e2130" : "#e5e7eb"}`,
        }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isDark ? "#f0f0f5" : "#111827" }}>Étiquette du sac</h3>
          <button onClick={onClose} style={{
            padding: 6, borderRadius: 8, border: "none", background: "transparent",
            color: isDark ? "#9ca3af" : "#6b7280", cursor: "pointer",
          }}><X size={18} /></button>
        </div>

        {/* Label preview */}
        <div style={{ padding: 24, background: isDark ? "#0e1017" : "#f9fafb" }}>
          <div style={{
            background: "#ffffff", border: "2px solid #111827", borderRadius: 8, overflow: "hidden",
            position: "relative", maxWidth: 380, margin: "0 auto",
          }}>
            {isReturn && (
              <div style={{
                position: "absolute", top: 18, right: -32, background: "#000", color: "#fff",
                fontSize: 9, fontWeight: 700, letterSpacing: 2, padding: "2px 32px",
                transform: "rotate(45deg)", zIndex: 1,
              }}>RETOUR</div>
            )}
            <div style={{
              textAlign: "center", padding: "8px 0", fontSize: 18, fontWeight: 800, letterSpacing: 3,
              borderBottom: "2px solid #111827",
              background: isReturn ? "#111827" : "#ffffff", color: isReturn ? "#ffffff" : "#111827",
            }}>{direction}</div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
              padding: "12px 16px", borderBottom: "1px solid #d1d5db", color: "#111827",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{originLabel}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#6b7280" }}>→</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{destLabel}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "12px 16px" }}>
              <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                <svg ref={barcodeRef} style={{ width: "100%", maxWidth: 220 }} />
              </div>
              <div ref={qrRef} style={{ flexShrink: 0 }}>
                <QRCodeSVG value={labelData.qr_data || labelData.tracking_number} size={68} level="M" />
              </div>
            </div>
            <div style={{ textAlign: "center", paddingBottom: 6, fontFamily: "monospace", fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#374151" }}>
              {labelData.tracking_number}
            </div>
            <div style={{
              textAlign: "center", padding: "12px 0", borderTop: "1px solid #d1d5db", color: "#111827",
            }}>
              <span style={{ fontSize: 28, fontWeight: 800 }}>{labelData.package_count}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#6b7280", marginLeft: 8 }}>COLIS</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px",
          borderTop: `1px solid ${isDark ? "#1e2130" : "#e5e7eb"}`,
          background: isDark ? "#0e1017" : "#f9fafb",
        }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: "transparent", color: isDark ? "#d1d5db" : "#374151",
            border: `1px solid ${isDark ? "#2a3145" : "#d1d5db"}`, cursor: "pointer",
          }}>Fermer</button>
          <button onClick={handlePrint} style={{
            padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 700,
            background: "#f97316", color: "#ffffff", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Printer size={14} /> Imprimer
          </button>
        </div>
      </div>
    </div>
  );
}
