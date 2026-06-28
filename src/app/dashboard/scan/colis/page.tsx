"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ScanBarcode, Loader2, AlertCircle, Package2, MapPin, User,
  Clock, Phone, Banknote, Truck, History, ArrowRight, Printer,
  RotateCcw, AlertTriangle, CheckCircle2, Activity,
} from "lucide-react";
import { api } from "@/lib/api";
import { STATUS_LABELS, STATUS_COLORS, type PackageStatus, type Package as PackageType } from "@/lib/packages";
import PackageLabel from "@/components/PackageLabel";

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
const formatDA = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString("fr-DZ") + " DA";

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ─── types ─────────────────────────────────────────────────────── */
type HistoryEntry = {
  id: number; from_status: string | null; to_status: string; notes: string | null; created_at: string;
  changed_by?: { first_name: string; last_name: string } | null;
  stop_desk?: { name: string } | null;
};
type CallLog = {
  id: number; outcome: string; notes: string | null; created_at: string;
  called_by?: { first_name: string; last_name: string } | null;
};
type PackageData = {
  id: number; tracking_number: string; service_type: string; status: PackageStatus;
  sender_name: string | null; sender_phone: string | null;
  recipient_name: string; recipient_phone: string; recipient_address: string | null;
  cod_amount: number; shipping_cost: number; weight: number | null; declared_value: number | null;
  content_description: string | null; fragile: boolean;
  created_at: string; delivered_at: string | null;
  origin_stop_desk?: { id: number; name: string } | null;
  destination_stop_desk?: { id: number; name: string } | null;
  recipient_wilaya?: { name: string } | null;
  recipient_commune?: { name: string } | null;
  bag?: { id: number; tracking_number: string } | null;
  driver?: { first_name: string; last_name: string } | null;
  created_by?: { first_name: string; last_name: string } | null;
};

/* ─── main ──────────────────────────────────────────────────────── */
export default function ScanColisPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const inputRef = useRef<HTMLInputElement>(null);

  const [tracking, setTracking] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pkg, setPkg] = useState<PackageData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [showLabel, setShowLabel] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("scan_colis_recent");
    if (raw) { try { setRecent(JSON.parse(raw)); } catch {} }
    inputRef.current?.focus();
  }, []);

  const search = useCallback(async (tn: string) => {
    if (!tn.trim()) return;
    setLoading(true); setError(null);
    setPkg(null); setHistory([]); setCallLogs([]);
    const res = await api<any>(`/scan/package/${encodeURIComponent(tn.trim())}`);
    if (res.success && res.data) {
      setPkg(res.data.package);
      setHistory(res.data.history ?? []);
      setCallLogs(res.data.call_logs ?? []);
      setRecent(prev => {
        const next = [tn.trim(), ...prev.filter(x => x !== tn.trim())].slice(0, 10);
        localStorage.setItem("scan_colis_recent", JSON.stringify(next));
        return next;
      });
    } else {
      setError(res.message ?? "Colis introuvable");
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
    setTracking(""); setPkg(null); setHistory([]); setCallLogs([]); setError(null);
    inputRef.current?.focus();
  }

  const statusColor = pkg ? STATUS_COLORS[pkg.status] : null;
  const addrParts = pkg ? [pkg.recipient_commune?.name, pkg.recipient_wilaya?.name, pkg.recipient_address].filter(Boolean) as string[] : [];

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
          <ScanBarcode size={20} style={{ color: "#f97316" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: "-0.01em" }}>
            Scanner un Colis
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
            Scannez, collez ou tapez un numéro de suivi — recherche automatique
          </p>
        </div>
        {pkg && (
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
          <ScanBarcode size={22} color="#f97316" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={tracking}
            onChange={e => setTracking(e.target.value)}
            onPaste={onPaste}
            placeholder="DLV-XXXXXXXX-XXXXXX"
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
      {!pkg && !loading && !error && recent.length > 0 && (
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
          <div>Recherche du colis…</div>
        </div>
      )}

      {/* ── Empty ── */}
      {!pkg && !loading && !error && recent.length === 0 && (
        <div style={{
          padding: "70px 0", textAlign: "center",
          border: `1px dashed ${t.border}`, borderRadius: 14,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: "rgba(249,115,22,0.08)", margin: "0 auto 14px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Package2 size={24} color="#f97316" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Prêt à scanner</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>Commencez par saisir un numéro de suivi ci-dessus</div>
        </div>
      )}

      {/* ── Package panel ── */}
      {pkg && statusColor && (
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
              }}>{pkg.tracking_number}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
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
                {STATUS_LABELS[pkg.status] ?? pkg.status}
              </span>
              <span style={{
                fontSize: 10, color: t.textMuted, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>Service · <span style={{ color: t.textSub }}>{pkg.service_type}</span></span>
            </div>
          </div>

          {/* Main grid */}
          <div style={{
            display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16, marginBottom: 16,
          }}>
            {/* Manifest card */}
            <div className="reveal reveal-2" style={{
              background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
              padding: "22px 24px",
            }}>
              <SectionHeader icon={<User size={13} />} title="Destinataire" t={t} />
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginBottom: 4 }}>{pkg.recipient_name}</div>
              <a href={`tel:${pkg.recipient_phone}`} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 13, fontWeight: 600, color: "#f97316",
                fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
                textDecoration: "none", marginBottom: 8,
              }}>
                <Phone size={12} /> {pkg.recipient_phone}
              </a>
              <div style={{ display: "flex", gap: 6, fontSize: 12, color: t.textSub, lineHeight: 1.55 }}>
                <MapPin size={12} style={{ marginTop: 3, flexShrink: 0, color: t.textFaint }} />
                <span>{addrParts.length > 0 ? addrParts.join(" · ") : "—"}</span>
              </div>

              <Divider t={t} />

              {pkg.sender_name && (
                <>
                  <SectionHeader icon={<User size={13} />} title="Expéditeur" t={t} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 3 }}>{pkg.sender_name}</div>
                  {pkg.sender_phone && (
                    <div style={{
                      fontSize: 11, color: t.textMuted,
                      fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
                    }}>{pkg.sender_phone}</div>
                  )}
                  <Divider t={t} />
                </>
              )}

              <SectionHeader icon={<Package2 size={13} />} title="Contenu" t={t} />
              <div style={{ fontSize: 13, color: t.text, lineHeight: 1.55, marginBottom: 10 }}>
                {pkg.content_description || <span style={{ color: t.textFaint, fontStyle: "italic" }}>Non spécifié</span>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {pkg.weight != null && pkg.weight > 0 && <Chip t={t}>{pkg.weight} kg</Chip>}
                {pkg.declared_value != null && pkg.declared_value > 0 && <Chip t={t}>Valeur · {formatDA(pkg.declared_value)}</Chip>}
                {pkg.fragile && (
                  <Chip t={t} color="#f97316" bg="rgba(249,115,22,0.1)" border="rgba(249,115,22,0.3)">
                    <AlertTriangle size={10} /> Fragile
                  </Chip>
                )}
              </div>

              <Divider t={t} />

              <SectionHeader icon={<Activity size={13} />} title="Métadonnées" t={t} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px" }}>
                <MetaRow icon={<Clock size={11} />} label="Créé le" value={formatDate(pkg.created_at)} t={t} />
                {pkg.delivered_at && <MetaRow icon={<CheckCircle2 size={11} />} label="Livré le" value={formatDate(pkg.delivered_at)} t={t} />}
                {pkg.bag && <MetaRow icon={<Package2 size={11} />} label="Sac" value={pkg.bag.tracking_number} mono t={t} />}
                {pkg.driver && <MetaRow icon={<Truck size={11} />} label="Livreur" value={`${pkg.driver.first_name} ${pkg.driver.last_name}`} t={t} />}
                {pkg.created_by && <MetaRow icon={<User size={11} />} label="Opérateur" value={`${pkg.created_by.first_name} ${pkg.created_by.last_name}`} t={t} />}
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
                    background: `linear-gradient(to right, #3b82f6, #f97316)`,
                    transform: "translateY(-50%)", transformOrigin: "left",
                    animation: "drawLine 0.7s ease-out 0.2s both",
                  }} />
                  <div style={{
                    position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <RouteNode color="#3b82f6" active />
                    <RouteNode color="#f97316" active />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 10 }}>
                  <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: "#3b82f6",
                      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3,
                    }}>Origine</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, wordBreak: "break-word" }}>
                      {pkg.origin_stop_desk?.name ?? "—"}
                    </div>
                  </div>
                  <ArrowRight size={16} color={t.textFaint} style={{ marginTop: 6, flexShrink: 0 }} />
                  <div style={{ textAlign: "right", flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700, color: "#f97316",
                      textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3,
                    }}>Destination</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, wordBreak: "break-word" }}>
                      {pkg.destination_stop_desk?.name ?? "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial card */}
              <div className="reveal reveal-3" style={{
                background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
                padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
              }}>
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: t.textMuted,
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <Banknote size={11} /> COD
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a", lineHeight: 1 }}>
                    {Number(pkg.cod_amount ?? 0).toLocaleString("fr-DZ")}
                    <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 4, fontWeight: 600 }}>DA</span>
                  </div>
                </div>
                <div style={{ borderLeft: `1px dashed ${t.divider}`, paddingLeft: 16 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, color: t.textMuted,
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    <Banknote size={11} /> Frais
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: t.text, lineHeight: 1 }}>
                    {Number(pkg.shipping_cost ?? 0).toLocaleString("fr-DZ")}
                    <span style={{ fontSize: 11, color: t.textMuted, marginLeft: 4, fontWeight: 600 }}>DA</span>
                  </div>
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

          {/* Timeline */}
          {history.length > 0 && (
            <div className="reveal" style={{
              background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
              overflow: "hidden", marginBottom: 16,
            }}>
              <div style={{
                padding: "14px 22px", borderBottom: `1px solid ${t.divider}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <History size={14} color={t.textMuted} />
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Historique des statuts</span>
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
                  {history.map((h, i) => {
                    const col = STATUS_COLORS[h.to_status as PackageStatus] ?? { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" };
                    return (
                      <div key={h.id} style={{
                        position: "relative", paddingBottom: i === history.length - 1 ? 0 : 18,
                      }}>
                        <div style={{
                          position: "absolute", left: -26, top: 3, width: 16, height: 16, borderRadius: "50%",
                          background: t.card, border: `2px solid ${col.dot}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: col.dot }} />
                        </div>
                        <div style={{
                          display: "flex", justifyContent: "space-between", alignItems: "baseline",
                          gap: 12, marginBottom: 3, flexWrap: "wrap",
                        }}>
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: t.text,
                            display: "flex", alignItems: "center", gap: 6,
                          }}>
                            {STATUS_LABELS[h.to_status as PackageStatus] ?? h.to_status}
                            {h.from_status && (
                              <span style={{ fontSize: 10, color: t.textFaint, fontWeight: 500 }}>
                                ← {STATUS_LABELS[h.from_status as PackageStatus] ?? h.from_status}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: t.textMuted, whiteSpace: "nowrap" }}>
                            {formatDate(h.created_at)}
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: t.textMuted }}>
                          {h.changed_by && <>{h.changed_by.first_name} {h.changed_by.last_name}</>}
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
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Call logs */}
          {callLogs.length > 0 && (
            <div className="reveal" style={{
              background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
              overflow: "hidden",
            }}>
              <div style={{
                padding: "14px 22px", borderBottom: `1px solid ${t.divider}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Phone size={14} color={t.textMuted} />
                <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Historique des appels</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: "#f97316",
                  background: "rgba(249,115,22,0.1)", padding: "2px 9px", borderRadius: 20,
                }}>{callLogs.length}</span>
              </div>
              <div style={{ padding: "8px 22px" }}>
                {callLogs.map((c, i) => (
                  <div key={c.id} style={{
                    padding: "12px 0",
                    borderBottom: i === callLogs.length - 1 ? "none" : `1px dashed ${t.divider}`,
                    display: "flex", gap: 14, alignItems: "flex-start",
                  }}>
                    <div style={{
                      fontSize: 10, color: t.textMuted, minWidth: 110, paddingTop: 2,
                      fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
                    }}>{formatDate(c.created_at)}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 12, color: t.text, fontWeight: 700,
                        textTransform: "capitalize", marginBottom: c.notes ? 3 : 0,
                      }}>{c.outcome.replaceAll("_", " ")}</div>
                      {c.notes && <div style={{ fontSize: 11, color: t.textSub, fontStyle: "italic" }}>{c.notes}</div>}
                    </div>
                    {c.called_by && (
                      <div style={{ fontSize: 10, color: t.textMuted, textAlign: "right", whiteSpace: "nowrap" }}>
                        {c.called_by.first_name} {c.called_by.last_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showLabel && pkg && (
        <PackageLabel pkg={pkg as unknown as PackageType} onClose={() => setShowLabel(false)} />
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

function Divider({ t }: { t: Tokens }) {
  return <div style={{ height: 1, background: t.divider, margin: "16px 0" }} />;
}

function MetaRow({ icon, label, value, mono, t }: { icon: React.ReactNode; label: string; value: string; mono?: boolean; t: Tokens }) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: t.textMuted, marginBottom: 2,
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <span style={{ color: t.textFaint }}>{icon}</span>
        {label}
      </div>
      <div style={{
        fontSize: mono ? 11 : 12, fontWeight: 600, color: t.text,
        fontFamily: mono ? "ui-monospace, 'SF Mono', Consolas, monospace" : "inherit",
      }}>{value}</div>
    </div>
  );
}

function Chip({ children, t, color, bg, border }: { children: React.ReactNode; t: Tokens; color?: string; bg?: string; border?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
      background: bg ?? t.rowHover, color: color ?? t.textSub,
      border: `1px solid ${border ?? t.border}`,
    }}>{children}</span>
  );
}

function RouteNode({ color, active }: { color: string; active: boolean }) {
  return (
    <div style={{
      width: 18, height: 18, borderRadius: "50%",
      background: color, border: `2px solid ${color}`,
      position: "relative", flexShrink: 0,
    }}>
      {active && (
        <span style={{
          position: "absolute", inset: -5, borderRadius: "50%",
          border: `1.5px solid ${color}`,
          animation: "ping 1.8s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}
