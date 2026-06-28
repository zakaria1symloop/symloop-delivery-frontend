"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Banknote, Loader2, CheckCircle2, XCircle, Truck, Package2,
  AlertTriangle, X, ArrowRight, Check, Printer, ScanLine, ListChecks,
} from "lucide-react";
import { api, getStoredUser, isSDLocked, getLockedSDId, type ApiResponse } from "@/lib/api";
import PackageLabel from "@/components/PackageLabel";
import SDSelector from "@/components/SDSelector";
import DriverSelector from "@/components/DriverSelector";
import {
  getLocalDrivers, getDriverPackages, collectDriverResults, settleDriver,
  type DriverKPIs, ECHEC_REASONS, ECHEC_REASON_LABELS,
  type EchecReason, type CollectResultItem,
} from "@/lib/drivers";
import {
  scanAcceptPackage, updatePackageStatus,
  type Package, type ScanAcceptResult, type WorkflowNextStep,
} from "@/lib/packages";

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
    shadow:    "0 1px 2px rgba(0,0,0,0.06)",
    modalBg:   "#ffffff",
    overlay:   "rgba(0,0,0,0.35)",
    inp:       { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    iconBg:    "#f3f4f6",
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── SD option ───────────────────────────────────────────── */
interface SDOption {
  id: number;
  name: string;
  code: string | null;
  type: string;
  parent_sd_id: number | null;
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

/* ── outcome map type ────────────────────────────────────── */
interface PackageOutcome {
  outcome: "livre" | "echec";
  echec_reason?: string;
}

/* ── helpers ─────────────────────────────────────────────── */
function formatDA(n: number | string) {
  return Number(n).toLocaleString("fr-DZ") + " DA";
}

function selStyle(t: Tokens): React.CSSProperties {
  return {
    background: t.inp.bg, border: `1px solid ${t.inp.border}`,
    borderRadius: 7, padding: "7px 11px", fontSize: 13,
    color: t.inp.text, outline: "none", cursor: "pointer",
    appearance: "auto" as React.CSSProperties["appearance"],
    width: "100%",
  };
}

const COLLECTION_SD_KEY = "collection_selected_sd";

/* ── toast ───────────────────────────────────────────────── */
function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 4000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", top: 24, right: 24, zIndex: 99999,
      display: "flex", alignItems: "center", gap: 10,
      padding: "14px 22px", borderRadius: 12,
      background: type === "success" ? "#059669" : "#dc2626",
      color: "#fff", fontSize: 14, fontWeight: 600,
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
    }}>
      {type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      {message}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */
export default function CollectionChauffeurPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  /* ── SD state ──────────────────────────────────────────── */
  const [stopDesks, setStopDesks] = useState<SDOption[]>([]);
  const [selectedSD, setSelectedSD] = useState<number | null>(null);
  const sdLoaded = useRef(false);

  /* ── driver state ──────────────────────────────────────── */
  const [drivers, setDrivers] = useState<DriverKPIs[]>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);

  /* ── packages state ────────────────────────────────────── */
  const [packages, setPackages] = useState<Package[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  /* ── outcome state ─────────────────────────────────────── */
  const [outcomes, setOutcomes] = useState<Record<number, PackageOutcome | null>>({});
  const [echecDropdownOpen, setEchecDropdownOpen] = useState<number | null>(null);

  /* ── Scan state ─────────────────────────────────────────── */
  const [scanInput, setScanInput] = useState("");
  const [scanFlash, setScanFlash] = useState<"" | "success" | "error">("");
  const [scanMsg, setScanMsg] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const playBeep = (ok: boolean) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = ok ? 880 : 300;
      osc.type = ok ? "sine" : "square";
      gain.gain.value = 0.15;
      osc.start(); osc.stop(ctx.currentTime + (ok ? 0.12 : 0.25));
    } catch {}
  };

  const handleScan = useCallback((val?: string) => {
    const tracking = (val ?? scanInput).trim();
    if (!tracking || !packages.length) return;

    const pkg = packages.find(p =>
      p.tracking_number.toLowerCase() === tracking.toLowerCase()
    );

    if (pkg) {
      // Found — mark as livré by default
      if (!outcomes[pkg.id]) {
        setOutcomes(prev => ({ ...prev, [pkg.id]: { outcome: "livre" } }));
      }
      playBeep(true);
      setScanFlash("success");
      setScanMsg(`${pkg.tracking_number} — Livré`);
    } else {
      playBeep(false);
      setScanFlash("error");
      setScanMsg(`${tracking} — Non trouvé`);
    }

    setScanInput("");
    setTimeout(() => setScanFlash(""), 1500);
    scanRef.current?.focus();
  }, [scanInput, packages, outcomes]);

  /* ── UI state ──────────────────────────────────────────── */
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [labelPkg, setLabelPkg] = useState<Package | null>(null);

  /* ── Workflow advance (scan-accept may require a step first) ─ */
  const [wfModal, setWfModal] = useState<{
    pkgId: number; tracking: string; message: string; options: WorkflowNextStep[];
  } | null>(null);
  const [wfNoteFor, setWfNoteFor] = useState<WorkflowNextStep | null>(null);
  const [wfNote, setWfNote] = useState("");
  const [wfAdvancing, setWfAdvancing] = useState(false);
  const [wfError, setWfError] = useState<string | null>(null);

  // If scan-accept returned workflow_next, open the picker. Returns true when a
  // workflow step is required (caller should treat the colis as NOT yet accepted).
  const openWorkflow = useCallback((
    pkgId: number, tracking: string, res: ApiResponse<ScanAcceptResult>,
  ): boolean => {
    const wf = res.data?.workflow_next;
    if (res.data && wf && wf.length > 0) {
      setWfError(null);
      setWfNote("");
      setWfNoteFor(wf.length === 1 && wf[0].require_note ? wf[0] : null);
      setWfModal({
        pkgId, tracking,
        message: res.data.workflow_message || "Ce colis doit avancer d'une étape avant d'être accepté.",
        options: wf,
      });
      return true;
    }
    return false;
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySettled, setAlreadySettled] = useState(false);
  const [successScreen, setSuccessScreen] = useState<{
    delivered: number; failed: number; totalCollected: number;
    driverFee: number; netForCaisse: number;
  } | null>(null);
  const [successData, setSuccessData] = useState<{
    delivered: number; failed: number; totalCollected: number;
    driverFee: number; netForCaisse: number;
  } | null>(null);

  /* ── derived ───────────────────────────────────────────── */
  const selectedDriver = drivers.find(d => d.id === selectedDriverId) ?? null;

  const processedCount = Object.values(outcomes).filter(v => v !== null && v !== undefined).length;
  const totalCount = packages.length;
  const allProcessed = totalCount > 0 && processedCount === totalCount;

  const livrePackages = packages.filter(p => outcomes[p.id]?.outcome === "livre");
  const echecPackages = packages.filter(p => outcomes[p.id]?.outcome === "echec");

  const totalCollected = livrePackages.reduce((sum, pkg) => {
    const cod = Number(pkg.cod_amount) || 0;
    const shipping = pkg.payment_type === "recipient" ? (Number(pkg.shipping_cost) || 0) : 0;
    return sum + cod + shipping;
  }, 0);

  const driverFee = livrePackages.reduce((sum, pkg) => {
    const communePrice = selectedDriver?.communes.find(
      c => c.id === pkg.recipient_commune?.id
    )?.price ?? 0;
    return sum + communePrice;
  }, 0);

  const netForCaisse = totalCollected - driverFee;

  /* ── load SDs ──────────────────────────────────────────── */
  useEffect(() => {
    if (sdLoaded.current) return;
    sdLoaded.current = true;
    api<SDOption[]>("/stop-desks").then(res => {
      if (res.success && res.data) {
        setStopDesks(res.data);
        const lockedId = getLockedSDId(getStoredUser());
        if (lockedId !== null) { setSelectedSD(lockedId); return; }
        const saved = localStorage.getItem(COLLECTION_SD_KEY);
        if (saved) {
          const id = Number(saved);
          if (res.data.some(sd => sd.id === id)) setSelectedSD(id);
        }
      }
    });
  }, []);

  /* ── persist SD ────────────────────────────────────────── */
  useEffect(() => {
    if (selectedSD !== null && !isSDLocked(getStoredUser())) {
      localStorage.setItem(COLLECTION_SD_KEY, String(selectedSD));
    }
  }, [selectedSD]);

  /* ── load drivers when SD changes ──────────────────────── */
  useEffect(() => {
    if (!selectedSD) { setDrivers([]); setSelectedDriverId(null); return; }
    setDriversLoading(true);
    setSelectedDriverId(null);
    setPackages([]);
    setOutcomes({});
    getLocalDrivers({ stop_desk_id: selectedSD }).then(res => {
      if (res.success && res.data) setDrivers(res.data);
      else setDrivers([]);
      setDriversLoading(false);
    });
  }, [selectedSD]);

  // Packages already processed by driver today
  const [deliveredByDriver, setDeliveredByDriver] = useState<Package[]>([]);
  const [failedByDriver, setFailedByDriver] = useState<Package[]>([]);
  const [inPossessionByDriver, setInPossessionByDriver] = useState<Package[]>([]);

  /* ── load packages when driver changes ─────────────────── */
  const loadPackages = useCallback(async (driverId: number) => {
    setPackagesLoading(true);
    setOutcomes({});
    const today = new Date().toISOString().split("T")[0];

    const [pendingRes, deliveredRes, failedRes, ramassageRes] = await Promise.all([
      getDriverPackages(driverId, { status: "en_cours_livraison", per_page: 500 }),
      getDriverPackages(driverId, { status: "livre", date_from: today, per_page: 500 }),
      getDriverPackages(driverId, { status: "echec_livraison", date_from: today, per_page: 500 }),
      getDriverPackages(driverId, { status: "en_ramassage", per_page: 500 }),
    ]);

    // Pending = still needs processing (driver didn't mark them yet)
    if (pendingRes.success && pendingRes.data) {
      const pkgList: Package[] = Array.isArray(pendingRes.data) ? pendingRes.data : (pendingRes.data as any).data ?? [];
      setPackages(pkgList);
    } else {
      setPackages([]);
    }

    // Already processed by driver
    if (deliveredRes.success && deliveredRes.data) {
      const list: Package[] = Array.isArray(deliveredRes.data) ? deliveredRes.data : (deliveredRes.data as any).data ?? [];
      setDeliveredByDriver(list);
    }
    if (failedRes.success && failedRes.data) {
      const list: Package[] = Array.isArray(failedRes.data) ? failedRes.data : (failedRes.data as any).data ?? [];
      setFailedByDriver(list);
    }
    if (ramassageRes.success && ramassageRes.data) {
      const list: Package[] = Array.isArray(ramassageRes.data) ? ramassageRes.data : (ramassageRes.data as any).data ?? [];
      // Filter to only collected ones (driver has them)
      setInPossessionByDriver(list.filter((p: any) => p.driver_collected_at));
    }

    setPackagesLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedDriverId) { setPackages([]); setOutcomes({}); setAlreadySettled(false); return; }
    setAlreadySettled(false);
    loadPackages(selectedDriverId);
  }, [selectedDriverId, loadPackages]);

  /* ── workflow advance handlers (depend on loadPackages) ──── */
  const wfAdvance = useCallback(async (option: WorkflowNextStep, note?: string) => {
    if (!wfModal) return;
    setWfAdvancing(true);
    setWfError(null);
    const res = await updatePackageStatus(wfModal.pkgId, option.key, note);
    setWfAdvancing(false);
    if (res.success) {
      setToast({ message: `Colis avancé à ${option.label}. Scannez à nouveau pour continuer.`, type: "success" });
      setWfModal(null); setWfNoteFor(null); setWfNote("");
      if (selectedDriverId) loadPackages(selectedDriverId);
    } else {
      // 422 (note required) / 403 (not authorized) → surface message, allow retry
      setWfError((res as any).message || "Impossible d'avancer le colis.");
    }
  }, [wfModal, selectedDriverId, loadPackages]);

  const wfChoose = useCallback((option: WorkflowNextStep) => {
    setWfError(null);
    if (option.require_note) { setWfNoteFor(option); setWfNote(""); }
    else wfAdvance(option);
  }, [wfAdvance]);

  const wfSubmitNote = useCallback(() => {
    if (!wfNoteFor) return;
    const note = wfNote.trim();
    if (!note) { setWfError("Une note est requise pour cette étape."); return; }
    wfAdvance(wfNoteFor, note);
  }, [wfNoteFor, wfNote, wfAdvance]);

  /* ── outcome handlers ──────────────────────────────────── */
  const markLivre = (pkgId: number) => {
    setOutcomes(prev => {
      if (prev[pkgId]?.outcome === "livre") return { ...prev, [pkgId]: null };
      return { ...prev, [pkgId]: { outcome: "livre" } };
    });
    setEchecDropdownOpen(null);
  };

  const markEchec = (pkgId: number, reason: string) => {
    setOutcomes(prev => ({ ...prev, [pkgId]: { outcome: "echec", echec_reason: reason } }));
    setEchecDropdownOpen(null);
  };

  const resetOutcome = (pkgId: number) => {
    setOutcomes(prev => ({ ...prev, [pkgId]: null }));
  };

  /* ── finalize ──────────────────────────────────────────── */
  const handleFinalize = async () => {
    if (!selectedDriverId) return;
    setSubmitting(true);

    try {
      // If there are pending packages to process (operator marks them)
      if (packages.length > 0 && allProcessed) {
        const results: CollectResultItem[] = packages.map(pkg => {
          const o = outcomes[pkg.id]!;
          return {
            package_id: pkg.id,
            outcome: o.outcome,
            ...(o.echec_reason ? { echec_reason: o.echec_reason } : {}),
          };
        });

        const collectRes = await collectDriverResults(selectedDriverId, results);
        if (!collectRes.success) {
          setToast({ message: collectRes.message || "Erreur lors de la collection", type: "error" });
          setSubmitting(false);
          setConfirmModalOpen(false);
          return;
        }
      }

      // Settle driver caisse → SD caisse
      const feeAmount = successData?.driverFee ?? driverFee;
      const settleRes = await settleDriver(selectedDriverId, feeAmount);
      if (!settleRes.success) {
        setToast({ message: settleRes.message || "Erreur lors du règlement", type: "error" });
        setSubmitting(false);
        setConfirmModalOpen(false);
        return;
      }

      const finalData = successData ?? {
        delivered: livrePackages.length,
        failed: echecPackages.length,
        totalCollected,
        driverFee,
        netForCaisse,
      };
      setSuccessScreen(finalData);
      setConfirmModalOpen(false);
      // Clear processed data so button doesn't show stale amounts
      setDeliveredByDriver([]);
      setFailedByDriver([]);
      setInPossessionByDriver([]);
      setSuccessData(null);
      setAlreadySettled(true);
      // Refresh driver list to get updated caisse balance
      if (selectedSD) {
        getLocalDrivers({ stop_desk_id: selectedSD }).then(res => {
          if ((res as any).success && (res as any).data) setDrivers((res as any).data);
        });
      }
    } catch {
      setToast({ message: "Erreur de connexion au serveur", type: "error" });
    }
    setSubmitting(false);
  };

  /* ── reset page ────────────────────────────────────────── */
  const resetPage = () => {
    setSuccessScreen(null);
    setSelectedDriverId(null);
    setPackages([]);
    setOutcomes({});
    // Re-load drivers to refresh current_packages count
    if (selectedSD) {
      setDriversLoading(true);
      getLocalDrivers({ stop_desk_id: selectedSD }).then(res => {
        if (res.success && res.data) setDrivers(res.data);
        setDriversLoading(false);
      });
    }
  };

  /* ── close echec dropdown on outside click ─────────────── */
  useEffect(() => {
    if (echecDropdownOpen === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-echec-dropdown]")) setEchecDropdownOpen(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [echecDropdownOpen]);

  /* ══════════════════════════════════════════════════════════
     SUCCESS SCREEN
     ══════════════════════════════════════════════════════════ */
  if (successScreen) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px" }}>
        <div style={{
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 20,
          padding: 40, maxWidth: 480, width: "100%", textAlign: "center",
          boxShadow: t.shadow,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%", margin: "0 auto 24px",
            background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CheckCircle2 size={36} style={{ color: "#16a34a" }} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text, marginBottom: 8 }}>
            Collection terminee
          </div>
          <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 28 }}>
            Tous les colis ont ete traites avec succes.
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24,
          }}>
            <StatBox label="Livres" value={String(successScreen.delivered)} color="#16a34a" t={t} />
            <StatBox label="Echecs" value={String(successScreen.failed)} color="#dc2626" t={t} />
            <StatBox label="Total collecte" value={formatDA(successScreen.totalCollected)} color="#2563eb" t={t} />
            <StatBox label="Frais chauffeur" value={formatDA(successScreen.driverFee)} color="#f59e0b" t={t} />
          </div>

          <div style={{
            padding: 16, borderRadius: 12,
            background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
            marginBottom: 28,
          }}>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>
              Verse en caisse
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#16a34a" }}>
              {formatDA(successScreen.netForCaisse)}
            </div>
          </div>

          <button
            onClick={resetPage}
            style={{
              width: "100%", padding: "12px 24px", borderRadius: 10,
              background: "#f97316", border: "none", color: "#fff",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <ArrowRight size={18} />
            Nouvelle collection
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     MAIN RENDER
     ══════════════════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))", paddingBottom: 100 }}>
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* Confirmation modal */}
      {labelPkg && <PackageLabel pkg={labelPkg} onClose={() => setLabelPkg(null)} />}

      {confirmModalOpen && (
        <ConfirmModal
          t={t}
          livreCount={successData?.delivered ?? livrePackages.length}
          echecCount={successData?.failed ?? echecPackages.length}
          totalCollected={successData?.totalCollected ?? totalCollected}
          driverFee={successData?.driverFee ?? driverFee}
          netForCaisse={successData?.netForCaisse ?? netForCaisse}
          driverName={selectedDriver ? `${selectedDriver.first_name} ${selectedDriver.last_name}` : ""}
          submitting={submitting}
          onClose={() => { if (!submitting) setConfirmModalOpen(false); }}
          onConfirm={handleFinalize}
        />
      )}

      {/* Workflow next-step picker / note prompt */}
      {wfModal && (
        <WorkflowModal
          t={t}
          tracking={wfModal.tracking}
          message={wfModal.message}
          options={wfModal.options}
          noteFor={wfNoteFor}
          note={wfNote}
          advancing={wfAdvancing}
          error={wfError}
          onNoteChange={setWfNote}
          onChoose={wfChoose}
          onSubmitNote={wfSubmitNote}
          onBackToOptions={() => { setWfNoteFor(null); setWfNote(""); setWfError(null); }}
          onClose={() => { if (!wfAdvancing) { setWfModal(null); setWfNoteFor(null); setWfNote(""); setWfError(null); } }}
        />
      )}

      <div>
        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Banknote size={22} style={{ color: "#f59e0b" }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>
              Collection Chauffeur
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>
              Traiter les resultats de livraison et collecter l'argent
            </p>
          </div>
        </div>

        {/* ── SD Selector ────────────────────────────────────── */}
        <div style={{
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
          padding: 20, marginBottom: 20, boxShadow: t.shadow,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Stop Desk
          </div>
          <SDSelector
            stopDesks={stopDesks}
            value={selectedSD}
            onChange={(id) => setSelectedSD(id)}
            disabled={isSDLocked(getStoredUser())}
          />
        </div>

        {/* ── Driver Selection ───────────────────────────────── */}
        {selectedSD && (
          <div style={{
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
            padding: 20, marginBottom: 20, boxShadow: t.shadow,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Truck size={13} />
                Chauffeur
              </div>
            </div>
            {driversLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", color: t.textMuted, fontSize: 13 }}>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Chargement des chauffeurs...
              </div>
            ) : drivers.length === 0 ? (
              <div style={{ padding: "16px 0", color: t.textMuted, fontSize: 13 }}>
                Aucun chauffeur affecté à ce stop desk.
              </div>
            ) : (
              <DriverSelector
                drivers={drivers}
                value={selectedDriverId}
                onChange={setSelectedDriverId}
              />
            )}
          </div>
        )}

        {/* ── Packages Loading ───────────────────────────────── */}
        {packagesLoading && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            padding: 40, color: t.textMuted, fontSize: 14,
          }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
            Chargement des colis...
          </div>
        )}

        {/* ── No packages ────────────────────────────────────── */}
        {selectedDriverId && !packagesLoading && packages.length === 0 && (
          <div style={{
            background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
            padding: "40px 20px", textAlign: "center", boxShadow: t.shadow,
          }}>
            <Package2 size={40} style={{ color: t.textFaint, marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: t.textSub, marginBottom: 4 }}>
              Aucun colis en cours de livraison
            </div>
            <div style={{ fontSize: 13, color: t.textMuted }}>
              Ce chauffeur n'a pas de colis a traiter pour le moment.
            </div>
          </div>
        )}

        {/* ── Scan box ──────────────────────────────────────── */}
        {!packagesLoading && packages.length > 0 && (
          <div style={{
            background: t.card, borderRadius: 12, border: `1px solid ${t.border}`,
            padding: "14px 16px", marginBottom: 14,
            borderLeft: `4px solid ${scanFlash === "success" ? "#10b981" : scanFlash === "error" ? "#ef4444" : "#3b82f6"}`,
            transition: "border-color 300ms",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(59,130,246,0.1)",
              }}>
                <ScanLine size={14} style={{ color: "#3b82f6" }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Scanner les colis</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>Scannez pour marquer comme livré</div>
              </div>
            </div>
            <div style={{
              display: "flex", gap: 8,
              border: `2px solid ${scanFlash === "success" ? "rgba(34,197,94,0.5)" : scanFlash === "error" ? "rgba(239,68,68,0.5)" : "#3b82f6"}`,
              borderRadius: 10, padding: 5,
              background: scanFlash === "success" ? "rgba(34,197,94,0.04)" : scanFlash === "error" ? "rgba(239,68,68,0.04)" : "transparent",
              transition: "all 300ms",
            }}>
              <ScanLine size={15} style={{ color: "#3b82f6", margin: "auto 4px auto 6px" }} />
              <input
                ref={scanRef}
                value={scanInput}
                onChange={e => {
                  const v = e.target.value;
                  setScanInput(v);
                  if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
                  if (v.trim().length >= 15) {
                    scanTimerRef.current = setTimeout(() => handleScan(v), 100);
                  }
                }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (scanTimerRef.current) clearTimeout(scanTimerRef.current); handleScan(scanInput); } }}
                placeholder="Scanner un colis..."
                style={{
                  flex: 1, border: "none", outline: "none", fontSize: 14, fontWeight: 600,
                  background: "transparent", color: t.text, padding: "7px 4px",
                }}
              />
            </div>
            {scanMsg && (
              <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: scanFlash === "success" ? "#10b981" : "#ef4444" }}>
                {scanMsg}
              </div>
            )}
          </div>
        )}

        {/* ── Package List ───────────────────────────────────── */}
        {!packagesLoading && packages.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 14,
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
                Traiter les colis
              </div>
              <div style={{ fontSize: 13, color: t.textMuted }}>
                {processedCount} / {totalCount} traites
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {packages.map(pkg => {
                const outcome = outcomes[pkg.id] ?? null;
                const isLivre = outcome?.outcome === "livre";
                const isEchec = outcome?.outcome === "echec";
                const isProcessed = isLivre || isEchec;

                return (
                  <div
                    key={pkg.id}
                    style={{
                      background: t.card,
                      border: `1px solid ${isLivre ? "rgba(34,197,94,0.35)" : isEchec ? "rgba(239,68,68,0.35)" : t.border}`,
                      borderLeft: isLivre
                        ? "4px solid #16a34a"
                        : isEchec
                        ? "4px solid #dc2626"
                        : `4px solid transparent`,
                      borderRadius: 12,
                      padding: "16px 18px",
                      boxShadow: t.shadow,
                      opacity: isProcessed ? 0.75 : 1,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {/* Package info row */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      {/* Left: package info */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          {isLivre && <CheckCircle2 size={16} style={{ color: "#16a34a", flexShrink: 0 }} />}
                          {isEchec && <XCircle size={16} style={{ color: "#dc2626", flexShrink: 0 }} />}
                          <span style={{
                            fontSize: 14, fontWeight: 800, fontFamily: "monospace",
                            color: t.text, letterSpacing: "0.5px",
                          }}>
                            {pkg.tracking_number}
                          </span>
                          {isEchec && outcome?.echec_reason && (
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                              background: "rgba(239,68,68,0.1)", color: "#dc2626",
                            }}>
                              {ECHEC_REASON_LABELS[outcome.echec_reason as EchecReason] ?? outcome.echec_reason}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12 }}>
                          <span style={{ color: t.textSub }}>
                            {pkg.recipient_name}
                          </span>
                          {pkg.recipient_phone && (
                            <span style={{ color: t.textMuted }}>{pkg.recipient_phone}</span>
                          )}
                          {pkg.recipient_commune?.name && (
                            <span style={{ color: t.textFaint }}>{pkg.recipient_commune.name}</span>
                          )}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12, marginTop: 4 }}>
                          <span style={{ color: t.textSub, fontWeight: 600 }}>
                            COD: {formatDA(pkg.cod_amount)}
                          </span>
                          <span style={{ color: t.textMuted }}>
                            Livraison: {formatDA(pkg.shipping_cost)}
                            {pkg.payment_type === "recipient" && (
                              <span style={{ fontSize: 10, color: "#f59e0b", marginLeft: 4 }}>(dest.)</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Right: action buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        {isProcessed ? (
                          <button
                            onClick={() => resetOutcome(pkg.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "7px 14px", borderRadius: 8,
                              background: t.iconBg,
                              border: `1px solid ${t.border}`,
                              color: t.textMuted, fontSize: 12, fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <X size={13} />
                            Annuler
                          </button>
                        ) : (
                          <>
                            {/* Livre button */}
                            <button
                              onClick={() => markLivre(pkg.id)}
                              style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "7px 14px", borderRadius: 8,
                                background: "rgba(34,197,94,0.1)",
                                border: "1px solid rgba(34,197,94,0.3)",
                                color: "#16a34a", fontSize: 12, fontWeight: 700,
                                cursor: "pointer", transition: "all 0.15s",
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = "rgba(34,197,94,0.2)";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = "rgba(34,197,94,0.1)";
                              }}
                            >
                              <CheckCircle2 size={14} />
                              Livre
                            </button>

                            {/* Echec button + dropdown */}
                            <div style={{ position: "relative" }} data-echec-dropdown>
                              <button
                                onClick={() => setEchecDropdownOpen(
                                  echecDropdownOpen === pkg.id ? null : pkg.id
                                )}
                                style={{
                                  display: "flex", alignItems: "center", gap: 6,
                                  padding: "7px 14px", borderRadius: 8,
                                  background: "rgba(239,68,68,0.1)",
                                  border: "1px solid rgba(239,68,68,0.3)",
                                  color: "#dc2626", fontSize: 12, fontWeight: 700,
                                  cursor: "pointer", transition: "all 0.15s",
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = "rgba(239,68,68,0.2)";
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                                }}
                              >
                                <XCircle size={14} />
                                Echec
                              </button>

                              {echecDropdownOpen === pkg.id && (
                                <div style={{
                                  position: "absolute", top: "calc(100% + 4px)", right: 0,
                                  zIndex: 50, minWidth: 200,
                                  background: t.card, border: `1px solid ${t.border}`,
                                  borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                                  overflow: "hidden",
                                }}>
                                  <div style={{
                                    padding: "8px 12px", fontSize: 10, fontWeight: 700,
                                    color: t.textMuted, textTransform: "uppercase",
                                    letterSpacing: "0.05em", borderBottom: `1px solid ${t.divider}`,
                                  }}>
                                    Raison de l'echec
                                  </div>
                                  {ECHEC_REASONS.map(reason => (
                                    <button
                                      key={reason}
                                      onClick={() => markEchec(pkg.id, reason)}
                                      style={{
                                        width: "100%", display: "block", textAlign: "left",
                                        padding: "9px 14px", border: "none",
                                        background: "transparent", color: t.textSub,
                                        fontSize: 13, cursor: "pointer",
                                        transition: "background 0.1s",
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.background = t.rowHover;
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.background = "transparent";
                                      }}
                                    >
                                      {ECHEC_REASON_LABELS[reason]}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Driver already processed (from app) ───────────── */}
        {(deliveredByDriver.length > 0 || failedByDriver.length > 0) && (
          <div style={{
            background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
            padding: 20, marginBottom: 16, boxShadow: t.shadow,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={18} style={{ color: "#10b981" }} />
              Traité par le chauffeur (app)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Livrés</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>{deliveredByDriver.length}</div>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Échecs</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>{failedByDriver.length}</div>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Encaissé</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#f97316" }}>
                  {formatDA(deliveredByDriver.reduce((s, p) => {
                    const cod = Number(p.cod_amount) || 0;
                    const ship = p.payment_type === "recipient" ? (Number(p.shipping_cost) || 0) : 0;
                    return s + cod + ship;
                  }, 0))}
                </div>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Solde caisse</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#3b82f6" }}>
                  {formatDA(selectedDriver?.caisse_balance ?? 0)}
                </div>
              </div>
            </div>

            {/* Settle button — collect money from driver */}
            {(() => {
              if (!selectedDriver || alreadySettled) return null;
              const caisseBalance = selectedDriver.caisse_balance ?? 0;
              // Calculate total driver fees for delivered packages
              const driverFeeTotal = deliveredByDriver.reduce((s, p) => {
                return s + (selectedDriver.communes.find(c => c.id === (p as any).recipient_commune?.id || (p as any).recipient_commune_id)?.price ?? 0);
              }, 0);
              // Money to collect = balance - fees (fees stay with driver)
              const toCollect = caisseBalance - driverFeeTotal;
              if (toCollect <= 0) return null;
              return true;
            })() && (
              <button
                onClick={async () => {
                  if (!selectedDriverId || !selectedDriver) return;
                  const driverFeeTotal = deliveredByDriver.reduce((s, p) => {
                    return s + (selectedDriver.communes.find(c => c.id === (p as any).recipient_commune?.id || (p as any).recipient_commune_id)?.price ?? 0);
                  }, 0);
                  setConfirmModalOpen(true);
                  // Pre-compute for finalize
                  setSuccessData({
                    delivered: deliveredByDriver.length,
                    failed: failedByDriver.length,
                    totalCollected: selectedDriver.caisse_balance,
                    driverFee: driverFeeTotal,
                    netForCaisse: selectedDriver.caisse_balance - driverFeeTotal,
                  });
                }}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                  background: "#10b981", color: "#fff", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <Banknote size={16} /> Collecter l'argent ({formatDA((selectedDriver?.caisse_balance ?? 0) - deliveredByDriver.reduce((s, p) => s + (selectedDriver?.communes.find(c => c.id === (p as any).recipient_commune?.id || (p as any).recipient_commune_id)?.price ?? 0), 0))})
              </button>
            )}

            {/* Colis en possession (ECH returns) */}
            {inPossessionByDriver.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed" }}>
                    {inPossessionByDriver.length} colis en possession — retours échange
                  </span>
                  <button
                    onClick={async () => {
                      let ok = 0;
                      let needsStep = false;
                      for (const p of inPossessionByDriver) {
                        const res = await scanAcceptPackage(p.tracking_number, true);
                        // A workflow step is required → open the picker and stop the loop.
                        if (res.data?.workflow_next?.length) {
                          openWorkflow(p.id, p.tracking_number, res);
                          needsStep = true;
                          break;
                        }
                        if (res.success) ok++;
                      }
                      if (needsStep) {
                        if (ok > 0) setToast({ message: `${ok} colis accepté(s). Un colis nécessite une étape workflow.`, type: "success" });
                        // reload happens after the workflow step is advanced
                      } else {
                        setToast({ message: `${ok} colis accepté(s) au SD`, type: ok > 0 ? "success" : "error" });
                        if (selectedDriverId) loadPackages(selectedDriverId);
                      }
                    }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 14px", borderRadius: 8, border: "none",
                      background: "#7c3aed", color: "#fff",
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    <CheckCircle2 size={12} /> Tout récupérer ({inPossessionByDriver.length})
                  </button>
                </div>
                {inPossessionByDriver.map(p => (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                    borderBottom: `1px solid ${t.divider}`, fontSize: 12,
                  }}>
                    <Package2 size={12} style={{ color: "#7c3aed", flexShrink: 0 }} />
                    <span style={{ fontFamily: "monospace", color: t.textSub, fontWeight: 700 }}>{p.tracking_number}</span>
                    <span style={{ color: t.textMuted }}>{p.recipient_name}</span>
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => setLabelPkg(p)} title="Imprimer étiquette" style={{
                        width: 24, height: 24, borderRadius: 6, display: "inline-flex",
                        alignItems: "center", justifyContent: "center",
                        background: "transparent", border: "none", cursor: "pointer", color: "#9ca3af",
                      }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#f97316")}
                        onMouseLeave={e => (e.currentTarget.style.color = "#9ca3af")}
                      >
                        <Printer size={13} />
                      </button>
                      <button
                        onClick={async () => {
                          const res = await scanAcceptPackage(p.tracking_number, true);
                          // A workflow step is required first → open the picker, do not accept yet.
                          if (openWorkflow(p.id, p.tracking_number, res)) return;
                          if (res.success) {
                            setToast({ message: `${p.tracking_number} accepté au SD`, type: "success" });
                            if (selectedDriverId) loadPackages(selectedDriverId);
                          } else {
                            setToast({ message: (res as any).message || "Erreur", type: "error" });
                          }
                        }}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "4px 10px", borderRadius: 6, border: "none",
                          background: "rgba(139,92,246,0.1)", color: "#7c3aed",
                          fontSize: 10, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        <CheckCircle2 size={11} /> Récupérer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Échec packages to return */}
            {failedByDriver.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 10,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#ef4444" }}>
                    {failedByDriver.length} colis en échec — récupérés du chauffeur
                  </div>
                  <a href="/dashboard/retour" style={{
                    fontSize: 11, fontWeight: 700, color: "#6366f1",
                    background: "rgba(99,102,241,0.08)", padding: "4px 12px", borderRadius: 8,
                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    <ArrowRight size={12} /> Aller aux Retours
                  </a>
                </div>
                <div style={{
                  padding: "10px 14px", borderRadius: 10, marginBottom: 8,
                  background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)",
                  fontSize: 11, color: t.textMuted, lineHeight: 1.5,
                }}>
                  Ces colis sont maintenant en statut "Échec livraison". Rendez-vous sur la page <b>Retours</b> pour les scanner dans un sac retour et les renvoyer à l'origine.
                </div>
                {failedByDriver.map(p => (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                    borderBottom: `1px solid ${t.divider}`, fontSize: 12,
                  }}>
                    <XCircle size={12} style={{ color: "#ef4444", flexShrink: 0 }} />
                    <span style={{ fontFamily: "monospace", color: t.textSub }}>{p.tracking_number}</span>
                    <span style={{ color: t.textMuted }}>{p.recipient_name}</span>
                    {(p as any).echec_reason && (
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "#ef4444", fontWeight: 600 }}>
                        {(p as any).echec_reason}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Financial Summary (sticky bottom) — for pending packages processed here ── */}
        {processedCount > 0 && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            zIndex: 100,
            background: t.card,
            borderTop: `1px solid ${t.border}`,
            boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
            padding: "16px 20px",
          }}>
            <div>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 16, flexWrap: "wrap",
              }}>
                {/* Stats */}
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", flex: 1 }}>
                  {/* Processed count */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Package2 size={15} style={{ color: t.textMuted }} />
                    <span style={{ fontSize: 12, color: t.textMuted }}>Traites:</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>
                      {processedCount} / {totalCount}
                    </span>
                  </div>

                  {/* Delivered */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={13} style={{ color: "#16a34a" }} />
                    <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
                      {livrePackages.length} livres
                    </span>
                  </div>

                  {/* Failed */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <XCircle size={13} style={{ color: "#dc2626" }} />
                    <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                      {echecPackages.length} echecs
                    </span>
                  </div>

                  {/* Divider */}
                  <div style={{ width: 1, height: 28, background: t.divider }} />

                  {/* Total collected */}
                  <div>
                    <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Total collecte
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#2563eb" }}>
                      {formatDA(totalCollected)}
                    </div>
                  </div>

                  {/* Driver fee */}
                  <div>
                    <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Chauffeur garde
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b" }}>
                      {formatDA(driverFee)}
                    </div>
                  </div>

                  {/* Net */}
                  <div>
                    <div style={{ fontSize: 10, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Chauffeur vous donne
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#16a34a" }}>
                      {formatDA(netForCaisse)}
                    </div>
                  </div>
                </div>

                {/* Finalize button */}
                <button
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={!allProcessed}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "11px 24px", borderRadius: 10,
                    background: allProcessed ? "#f97316" : t.divider,
                    border: "none",
                    color: allProcessed ? "#fff" : t.textFaint,
                    fontSize: 14, fontWeight: 700,
                    cursor: allProcessed ? "pointer" : "not-allowed",
                    transition: "all 0.2s",
                    flexShrink: 0,
                    opacity: allProcessed ? 1 : 0.6,
                  }}
                >
                  <Check size={17} />
                  Finaliser
                </button>
              </div>

              {/* Progress bar */}
              <div style={{
                marginTop: 10, height: 3, borderRadius: 99,
                background: t.divider, overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  background: allProcessed
                    ? "linear-gradient(90deg, #16a34a, #22c55e)"
                    : "linear-gradient(90deg, #f97316, #fb923c)",
                  width: `${totalCount > 0 ? (processedCount / totalCount) * 100 : 0}%`,
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyframes for spinner */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── StatBox (success screen) ────────────────────────────── */
function StatBox({ label, value, color, t }: { label: string; value: string; color: string; t: Tokens }) {
  return (
    <div style={{
      padding: 16, borderRadius: 12,
      background: t.card, border: `1px solid ${t.border}`,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

/* ── Workflow Modal (next-step picker + note prompt) ──────── */
function WorkflowModal({
  t, tracking, message, options, noteFor, note, advancing, error,
  onNoteChange, onChoose, onSubmitNote, onBackToOptions, onClose,
}: {
  t: Tokens;
  tracking: string;
  message: string;
  options: WorkflowNextStep[];
  noteFor: WorkflowNextStep | null;
  note: string;
  advancing: boolean;
  error: string | null;
  onNoteChange: (v: string) => void;
  onChoose: (opt: WorkflowNextStep) => void;
  onSubmitNote: () => void;
  onBackToOptions: () => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: t.overlay, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.modalBg, borderRadius: 16,
          border: "1px solid rgba(249,115,22,0.35)",
          width: "100%", maxWidth: 460, padding: 24,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(249,115,22,0.1)",
          }}>
            <ListChecks size={20} style={{ color: "#f97316" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>
              {noteFor ? "Ajouter une note" : "Choisissez la prochaine étape"}
            </div>
            <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{message}</div>
            <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4, fontFamily: "monospace", fontWeight: 700 }}>
              {tracking}
            </div>
          </div>
          <button onClick={onClose} disabled={advancing} style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: `1px solid ${t.border}`,
            color: t.textMuted, cursor: advancing ? "not-allowed" : "pointer",
          }}>
            <X size={15} />
          </button>
        </div>

        {/* Error (422 note required / 403 not authorized) */}
        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 10, padding: "10px 14px", margin: "12px 0",
          }}>
            <AlertTriangle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>{error}</span>
          </div>
        )}

        {noteFor ? (
          <div style={{ marginTop: 14 }}>
            <input
              autoFocus
              value={note}
              onChange={e => onNoteChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onSubmitNote(); } }}
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
              {options.length > 1 && (
                <button onClick={onBackToOptions} disabled={advancing} style={{
                  padding: "10px 16px", borderRadius: 10,
                  background: t.iconBg, border: `1px solid ${t.border}`,
                  color: t.textSub, fontSize: 13, fontWeight: 600,
                  cursor: advancing ? "not-allowed" : "pointer",
                }}>
                  Retour
                </button>
              )}
              <button onClick={onSubmitNote} disabled={advancing} style={{
                flex: 1, padding: "10px 16px", borderRadius: 10, border: "none",
                background: "#f97316", color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: advancing ? "not-allowed" : "pointer", opacity: advancing ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                {advancing
                  ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  : <ArrowRight size={16} />}
                Avancer à {noteFor.label}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
            {options.map(opt => (
              <button key={opt.key} onClick={() => onChoose(opt)} disabled={advancing} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "11px 18px", borderRadius: 10,
                background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.35)",
                color: "#ea580c", fontSize: 14, fontWeight: 700,
                cursor: advancing ? "not-allowed" : "pointer", opacity: advancing ? 0.7 : 1,
              }}>
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
    </div>
  );
}

/* ── Confirmation Modal ──────────────────────────────────── */
function ConfirmModal({
  t, livreCount, echecCount, totalCollected, driverFee, netForCaisse,
  driverName, submitting, onClose, onConfirm,
}: {
  t: Tokens;
  livreCount: number;
  echecCount: number;
  totalCollected: number;
  driverFee: number;
  netForCaisse: number;
  driverName: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "6px 0", fontSize: 13,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: t.overlay, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.modalBg, borderRadius: 16,
          border: `1px solid ${t.border}`,
          width: "100%", maxWidth: 480, padding: 28,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(249,115,22,0.1)",
            }}>
              <Banknote size={22} style={{ color: "#f97316" }} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>Confirmer la collection</div>
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{driverName}</div>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} style={{
            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", cursor: submitting ? "not-allowed" : "pointer", color: t.textMuted,
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Summary section */}
        <div style={{
          padding: "14px 16px", borderRadius: 12,
          border: `1px solid ${t.border}`, marginBottom: 16,
        }}>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <Package2 size={13} /> Colis traites
            </span>
            <span style={{ fontWeight: 700, color: t.text }}>{livreCount + echecCount}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={13} style={{ color: "#16a34a" }} /> Livres
            </span>
            <span style={{ fontWeight: 700, color: "#16a34a" }}>{livreCount}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <XCircle size={13} style={{ color: "#dc2626" }} /> Echecs (a retourner)
            </span>
            <span style={{ fontWeight: 700, color: "#dc2626" }}>{echecCount}</span>
          </div>
        </div>

        {/* Financial section */}
        <div style={{
          padding: "14px 16px", borderRadius: 12,
          border: `1px solid ${t.border}`, marginBottom: 16,
        }}>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Total collecte (COD + frais dest.)</span>
            <span style={{ fontWeight: 700, color: "#2563eb" }}>{formatDA(totalCollected)}</span>
          </div>
          <div style={rowStyle}>
            <span style={{ color: t.textMuted }}>Frais chauffeur</span>
            <span style={{ fontWeight: 700, color: "#f59e0b" }}>-{formatDA(driverFee)}</span>
          </div>
          <div style={{ borderTop: `1px solid ${t.divider}`, marginTop: 8, paddingTop: 8 }}>
            <div style={rowStyle}>
              <span style={{ color: t.text, fontWeight: 700 }}>Le chauffeur vous donne</span>
              <span style={{ fontWeight: 900, color: "#16a34a", fontSize: 16 }}>
                {formatDA(netForCaisse)}
              </span>
            </div>
          </div>
        </div>

        {/* Driver keeps section */}
        <div style={{
          padding: "12px 16px", borderRadius: 12,
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.2)",
          marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: t.textSub }}>Le chauffeur garde</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#f59e0b" }}>
              {formatDA(driverFee)}
            </span>
          </div>
        </div>

        {/* Warning */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)",
          marginBottom: 24, fontSize: 12, color: t.textMuted,
        }}>
          <AlertTriangle size={16} style={{ color: "#dc2626", flexShrink: 0, marginTop: 1 }} />
          <span>
            Cette action est irreversible. Les colis livres seront finalises et les echecs
            seront marques pour retour. Le montant sera verse dans la caisse du stop desk.
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              flex: 1, padding: "11px 20px", borderRadius: 10,
              background: t.iconBg, border: `1px solid ${t.border}`,
              color: t.textSub, fontSize: 14, fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            style={{
              flex: 1, padding: "11px 20px", borderRadius: 10,
              background: "#f97316", border: "none",
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Traitement...
              </>
            ) : (
              <>
                <Check size={16} />
                Confirmer et finaliser
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
