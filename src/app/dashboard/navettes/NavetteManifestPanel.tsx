"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Loader2, ScanLine, Check, AlertTriangle, Package, MapPin, ArrowRight,
  Navigation, Clock, Flag, PackageCheck, PackageX, Boxes, RefreshCw, ChevronRight,
} from "lucide-react";
import { Badge, ORANGE, type Tokens } from "../_ui";
import {
  getNavetteManifest, scanLoadBag, scanUnloadBag, completeNavette,
  navetteStatusColor, navetteStatusLabel, formatDuration,
  type NavetteManifest, type ManifestBag, type NavetteCompleteSummary,
} from "@/lib/navettes";

const GREEN = "#22c55e";
const RED = "#ef4444";
const BLUE = "#3b82f6";
const AMBER = "#f59e0b";

type ScanFeedback = { tone: "ok" | "err"; text: string } | null;

/** "SD (Wilaya)" label for a bag's final destination. */
function finalDestLabel(b: ManifestBag): string {
  const sd = b.final_destination.stop_desk?.name;
  const wil = b.final_destination.wilaya?.name;
  if (sd && wil) return `${sd} · ${wil}`;
  return sd ?? wil ?? "—";
}

export default function NavetteManifestPanel({
  navetteId, t, onClose, onChanged,
}: {
  navetteId: number;
  t: Tokens;
  onClose: () => void;
  /** Notify the parent (refresh list/summary) after any state-changing scan/complete. */
  onChanged: () => void;
}) {
  const [manifest, setManifest] = useState<NavetteManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scanValue, setScanValue] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [flashTracking, setFlashTracking] = useState<string | null>(null);

  const [completeBusy, setCompleteBusy] = useState(false);
  const [summary, setSummary] = useState<NavetteCompleteSummary | null>(null);

  const scanRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await getNavetteManifest(navetteId);
    if (res.success && res.data) { setManifest(res.data); setError(null); }
    else setError(res.message || "Manifeste introuvable.");
    if (!silent) setLoading(false);
  }, [navetteId]);

  useEffect(() => { load(); }, [load]);

  // Auto-clear the success feedback (errors stay until the next scan).
  useEffect(() => {
    if (feedback?.tone === "ok") {
      const id = window.setTimeout(() => setFeedback(null), 3500);
      return () => window.clearTimeout(id);
    }
  }, [feedback]);

  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);

  const status = manifest?.navette.status;
  const isLoadingPhase = status === "planifiee" || status === "assignee";
  const isUnloadingPhase = status === "en_route";
  const isClosed = status === "terminee" || status === "annulee";

  const greenFlash = useCallback((tracking: string) => {
    setFlashTracking(tracking);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashTracking(null), 1500);
  }, []);

  const focusScan = useCallback(() => {
    window.setTimeout(() => { scanRef.current?.focus(); scanRef.current?.select(); }, 30);
  }, []);

  // ── Scan-to-load ──────────────────────────────────────────────────────────
  async function submitScan(e: React.FormEvent) {
    e.preventDefault();
    const tracking = scanValue.trim();
    if (!tracking || scanBusy) return;
    setScanBusy(true);
    const res = isUnloadingPhase
      ? await scanUnloadBag(navetteId, tracking)
      : await scanLoadBag(navetteId, tracking);
    setScanBusy(false);

    if (res.success && res.data) {
      const t2 = res.data.bag?.tracking_number ?? tracking;
      if (isUnloadingPhase) {
        const isFinal = "is_final" in res.data ? res.data.is_final : false;
        setFeedback({ tone: "ok", text: `Sac ${t2} déchargé ✓${isFinal ? " — destination finale" : " — transit"}` });
      } else {
        setFeedback({ tone: "ok", text: `Sac ${t2} confirmé à bord ✓` });
      }
      greenFlash(t2);
      setScanValue("");
      await load(true);    // refetch to move the bag between groups + refresh progress
      onChanged();         // keep the fleet list/KPIs coherent
    } else {
      // 422 / not found — surface the backend reason prominently in RED.
      setFeedback({ tone: "err", text: res.message || "Sac refusé." });
    }
    focusScan();
  }

  // ── Terminer (smart finalize) ───────────────────────────────────────────────
  async function finalize() {
    if (completeBusy) return;
    setCompleteBusy(true);
    const res = await completeNavette(navetteId);
    setCompleteBusy(false);
    if (res.success && res.data) {
      setSummary(res.data.summary);
      onChanged();
    } else {
      setFeedback({ tone: "err", text: res.message || "Impossible de terminer la navette." });
    }
  }

  const nav = manifest?.navette;
  const counts = manifest?.counts;
  const sColor = nav ? navetteStatusColor(nav.status) : t.textMuted;
  const pct = counts && counts.total_assigned > 0
    ? Math.round((counts.confirmed / counts.total_assigned) * 100) : 0;

  return (
    <Overlay onClose={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 760, maxHeight: "92vh", overflowY: "auto", background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22 }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}>
            <ScanLine size={18} color={ORANGE} />
            <span style={{ fontSize: 17, fontWeight: 750, color: t.text }}>Manifeste & chargement</span>
            {nav && (
              <Badge color={sColor} bg={sColor + "18"}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: sColor }} />{navetteStatusLabel(nav.status)}
              </Badge>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => load()} title="Actualiser" style={iconBtn(t)}><RefreshCw size={15} /></button>
            <button onClick={onClose} title="Fermer" style={iconBtn(t)}><X size={16} /></button>
          </div>
        </div>

        {loading || !nav || !counts ? (
          <Centered t={t}>
            {error ? <><AlertTriangle size={20} color={RED} /><span>{error}</span></> : <><Loader2 size={20} className="spin" /> Chargement du manifeste…</>}
          </Centered>
        ) : summary ? (
          <CompleteSummary summary={summary} t={t} onClose={onClose} />
        ) : (
          <>
            {/* Route line: O → D + distance / ETA / traffic */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "10px 0 14px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13.5, fontWeight: 700, color: t.text }}>
                <MapPin size={14} color={ORANGE} />{nav.origin_stop_desk?.name ?? "Origine"}
              </span>
              <ArrowRight size={15} color={t.textFaint} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{nav.destination_stop_desk?.name ?? "Destination"}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {nav.route.distance_km != null && <Chip t={t} icon={Navigation} color={BLUE}>{nav.route.distance_km} km</Chip>}
              {nav.route.duration_min != null && <Chip t={t} icon={Clock} color="#8b5cf6">ETA {formatDuration(nav.route.duration_min)}</Chip>}
              {nav.route.duration_traffic_min != null && <Chip t={t} icon={Clock} color={RED}>Trafic {formatDuration(nav.route.duration_traffic_min)}</Chip>}
              {nav.route.distance_km == null && nav.route.duration_min == null && (
                <span style={{ fontSize: 12, color: t.textMuted }}>Itinéraire non calculé (assignez un chauffeur).</span>
              )}
            </div>

            {/* Load progress (confirmed / total assigned) */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.textMuted, marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>Progression du chargement</span>
                <span style={{ fontWeight: 700, color: pct >= 100 ? GREEN : ORANGE }}>
                  {counts.confirmed}/{counts.total_assigned} confirmés ({pct}%)
                  {isUnloadingPhase && ` · ${counts.to_unload} à bord`}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 5, background: t.divider, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? GREEN : ORANGE, borderRadius: 5, transition: "width 0.3s" }} />
              </div>
            </div>

            {/* Scan input — load OR unload depending on lifecycle */}
            {!isClosed && (
              <form onSubmit={submitScan} style={{ marginBottom: 8 }}>
                <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: t.text, marginBottom: 7 }}>
                  {isUnloadingPhase ? "Scanner pour décharger (à destination)" : "Scanner pour charger"}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <ScanLine size={16} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: ORANGE }} />
                    <input
                      ref={scanRef}
                      autoFocus
                      value={scanValue}
                      onChange={(e) => setScanValue(e.target.value)}
                      placeholder="Scannez ou saisissez le tracking du sac, puis Entrée"
                      style={{ width: "100%", padding: "11px 12px 11px 36px", borderRadius: 9, fontSize: 14, fontFamily: "monospace", background: t.inp.bg, border: `1px solid ${feedback?.tone === "err" ? RED : t.inp.border}`, color: t.inp.text, outline: "none" }}
                    />
                  </div>
                  <button type="submit" disabled={scanBusy || !scanValue.trim()} style={{ ...primaryBtn, opacity: scanBusy || !scanValue.trim() ? 0.6 : 1 }}>
                    {scanBusy ? <Loader2 size={15} className="spin" /> : <Check size={15} />} {isUnloadingPhase ? "Décharger" : "Charger"}
                  </button>
                </div>
              </form>
            )}

            {/* Scan feedback — success green, refusal RED & prominent */}
            {feedback && (
              <div style={{
                display: "flex", alignItems: "center", gap: 9, padding: "11px 13px", borderRadius: 10, marginBottom: 16,
                background: (feedback.tone === "ok" ? GREEN : RED) + "16",
                border: `1px solid ${(feedback.tone === "ok" ? GREEN : RED)}55`,
              }}>
                {feedback.tone === "ok" ? <Check size={17} color={GREEN} style={{ flexShrink: 0 }} /> : <AlertTriangle size={17} color={RED} style={{ flexShrink: 0 }} />}
                <span style={{ fontSize: 13.5, fontWeight: feedback.tone === "err" ? 700 : 600, color: feedback.tone === "ok" ? GREEN : RED }}>{feedback.text}</span>
              </div>
            )}

            {/* Three groups */}
            <BagGroup
              t={t} title="À scanner" icon={Package} color={AMBER}
              count={counts.to_scan} bags={manifest.to_load.to_scan} flashTracking={flashTracking}
              empty="Tous les sacs affectés sont confirmés."
            />
            <BagGroup
              t={t} title="Confirmé ✓" icon={PackageCheck} color={GREEN}
              count={counts.confirmed} bags={manifest.to_load.confirmed} flashTracking={flashTracking}
              empty="Aucun sac confirmé pour le moment."
            />
            <BagGroup
              t={t} title="À décharger (à bord)" icon={Boxes} color={BLUE}
              count={counts.to_unload} bags={manifest.to_unload} flashTracking={flashTracking}
              empty="Rien à bord."
            />

            {/* Footer: Terminer for en_route */}
            {isUnloadingPhase && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
                <button onClick={finalize} disabled={completeBusy} style={{ ...primaryBtn, background: GREEN, opacity: completeBusy ? 0.6 : 1 }}>
                  {completeBusy ? <Loader2 size={15} className="spin" /> : <Flag size={15} />} Terminer la navette
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`.spin{animation:nav-spin 1s linear infinite}@keyframes nav-spin{to{transform:rotate(360deg)}}`}</style>
    </Overlay>
  );
}

/* ───────────────────────── Complete summary dialog ───────────────────────── */
function CompleteSummary({ summary, t, onClose }: { summary: NavetteCompleteSummary; t: Tokens; onClose: () => void }) {
  const missing = summary.still_missing.length;
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: GREEN + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Flag size={20} color={GREEN} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 750, color: t.text }}>Navette terminée</div>
          <div style={{ fontSize: 12.5, color: t.textMuted }}>{summary.total} sac{summary.total > 1 ? "s" : ""} traité{summary.total > 1 ? "s" : ""}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <SummaryStat t={t} icon={PackageCheck} color={GREEN} label="Déchargés" value={summary.unloaded.length} />
        <SummaryStat t={t} icon={PackageX} color={missing ? RED : t.textMuted} label="Manquants" value={missing} danger={missing > 0} />
      </div>

      {missing > 0 && (
        <div style={{ padding: "12px 14px", borderRadius: 11, background: RED + "12", border: `1px solid ${RED}44`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: RED, marginBottom: 8 }}>
            <AlertTriangle size={15} /> Sacs affectés mais jamais chargés ({missing})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {summary.still_missing.map((tr) => (
              <span key={tr} style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: RED, background: RED + "16", border: `1px solid ${RED}33`, borderRadius: 7, padding: "3px 8px" }}>{tr}</span>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 8 }}>Ils ont été détachés et restent à l&apos;origine pour une prochaine navette.</div>
        </div>
      )}

      {summary.unloaded.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, marginBottom: 8 }}>Déchargés à destination</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {summary.unloaded.map((tr) => (
              <span key={tr} style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: GREEN, background: GREEN + "14", border: `1px solid ${GREEN}33`, borderRadius: 7, padding: "3px 8px" }}>{tr}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onClose} style={primaryBtn}><Check size={15} /> Fermer</button>
      </div>
    </div>
  );
}

function SummaryStat({ t, icon: Icon, color, label, value, danger }: { t: Tokens; icon: React.ElementType; color: string; label: string; value: number; danger?: boolean }) {
  return (
    <div style={{ background: t.sectionBg, border: `1px solid ${danger ? RED + "44" : t.border}`, borderRadius: 11, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: t.textMuted, marginBottom: 5 }}><Icon size={14} color={color} />{label}</div>
      <div style={{ fontSize: 24, fontWeight: 750, color }}>{value}</div>
    </div>
  );
}

/* ───────────────────────── Bag group + row ───────────────────────── */
function BagGroup({
  t, title, icon: Icon, color, count, bags, flashTracking, empty,
}: {
  t: Tokens; title: string; icon: React.ElementType; color: string; count: number;
  bags: ManifestBag[]; flashTracking: string | null; empty: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <Icon size={15} color={color} />
        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 20, background: color + "1f", color }}>{count}</span>
      </div>
      {bags.length === 0 ? (
        <p style={{ fontSize: 12, color: t.textMuted, margin: "0 0 4px 23px" }}>{empty}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {bags.map((b) => <BagRow key={`${title}-${b.id}`} b={b} t={t} accent={color} flash={flashTracking === b.tracking_number} />)}
        </div>
      )}
    </div>
  );
}

function BagRow({ b, t, accent, flash }: { b: ManifestBag; t: Tokens; accent: string; flash: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 10,
      background: flash ? GREEN + "22" : t.sectionBg,
      border: `1px solid ${flash ? GREEN : t.border}`,
      transition: "background 0.4s, border-color 0.4s",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: t.text }}>{b.tracking_number}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>{b.packages_count} colis</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: t.textSub, marginTop: 3, flexWrap: "wrap" }}>
          <span>{b.origin_stop_desk?.name ?? "—"}</span>
          <ChevronRight size={12} color={t.textFaint} />
          <span>{b.next_hop_stop_desk?.name ?? "destination finale"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: t.textMuted, marginTop: 2 }}>
          <MapPin size={11} color={accent} /> Dest. finale : {finalDestLabel(b)}
        </div>
      </div>
      {flash && <Check size={18} color={GREEN} style={{ flexShrink: 0 }} />}
    </div>
  );
}

/* ───────────────────────── Small bits ───────────────────────── */
function Chip({ children, icon: Icon, color, t }: { children: React.ReactNode; icon: React.ElementType; color: string; t: Tokens }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: t.sectionBg, border: `1px solid ${t.border}`, color: t.textSub }}>
      <Icon size={13} color={color} />{children}
    </span>
  );
}

function Centered({ children, t }: { children: React.ReactNode; t: Tokens }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "44px 20px", color: t.textSub, fontSize: 13.5 }}>
      {children}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      {children}
    </div>
  );
}

const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 16px", borderRadius: 9, background: ORANGE, color: "#fff", border: "none", fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const iconBtn = (t: Tokens): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: t.card, color: t.textSub, border: `1px solid ${t.border}`, cursor: "pointer" });
