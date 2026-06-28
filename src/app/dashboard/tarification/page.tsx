"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Save, Search, Plane, ChevronDown, Loader2, Users, Receipt,
  CheckCircle2, AlertCircle, X,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  getDefaultTariffs, saveDefaultTariffs, getDefaultDepartures,
  getExpediteurTariffs, saveExpediteurTariffs,
  PRICE_COLUMNS, SERVICE_TABS,
  type TariffRow, type ServiceType,
} from "@/lib/tarification";
import type { Wilaya } from "@/lib/geography";
import { getWilayas } from "@/lib/geography";
import type { StaffUser } from "@/lib/users";

/* ── theme ──────────────────────────────────────────────── */
function useIsDark() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark") : false,
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
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130",
    rowHover: "#1a1f2e", text: "#f0f0f5", textSub: "#d1d5db",
    textMuted: "#6b7280", textFaint: "#4b5563",
    inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
    activeTab: { bg: "rgba(249,115,22,0.15)", text: "#f97316", border: "#f97316" },
    chipActive: { bg: "rgba(99,102,241,0.15)", text: "#a5b4fc", border: "#6366f1" },
    chipDefault: { bg: "#1e2130", text: "#6b7280", border: "#2a3145" },
    dirtyBg: "rgba(245,158,11,0.06)", greenBg: "rgba(16,185,129,0.06)",
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6",
    rowHover: "#f9fafb", text: "#111827", textSub: "#374151",
    textMuted: "#6b7280", textFaint: "#9ca3af",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    activeTab: { bg: "rgba(249,115,22,0.1)", text: "#ea580c", border: "#f97316" },
    chipActive: { bg: "rgba(99,102,241,0.1)", text: "#4f46e5", border: "#6366f1" },
    chipDefault: { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb" },
    dirtyBg: "rgba(245,158,11,0.04)", greenBg: "rgba(16,185,129,0.04)",
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── main tabs ─────────────────────────────────────────── */
type MainTab = "defaults" | "expediteur";
const MAIN_TABS: { key: MainTab; label: string; icon: React.ElementType }[] = [
  { key: "defaults",   label: "Tarifs par défaut",     icon: Receipt },
  { key: "expediteur", label: "Tarifs par expéditeur", icon: Users },
];

export default function TarificationPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [mainTab, setMainTab] = useState<MainTab>("defaults");
  const [serviceTab, setServiceTab] = useState<ServiceType>("delivery");

  // Data
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [tariffs, setTariffs] = useState<Record<number, TariffRow>>({});
  const [overrideCounts, setOverrideCounts] = useState<Record<number, number>>({});
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set());

  // Departure
  const [departureWilayaId, setDepartureWilayaId] = useState<number | null>(null);
  const [configuredDepartures, setConfiguredDepartures] = useState<Wilaya[]>([]);
  const [departureDropdown, setDepartureDropdown] = useState(false);
  const [departureSearch, setDepartureSearch] = useState("");

  // Expediteur
  const [expediteurs, setExpediteurs] = useState<StaffUser[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<number | null>(null);
  const [expDropdown, setExpDropdown] = useState(false);
  const [expSearch, setExpSearch] = useState("");

  // UI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [saveMsg, setSaveMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // ── Load wilayas + expediteurs on mount ──────────────────
  useEffect(() => {
    getWilayas({ full: true }).then((r) => { if (r.success && r.data) setWilayas(r.data); });
    api<StaffUser[]>("/users?type=expediteur").then((r) => {
      if (r.success && r.data) setExpediteurs(Array.isArray(r.data) ? r.data : []);
    });
  }, []);

  // ── Selected expediteur info ──────────────────────────────
  const selectedExp = useMemo(() => {
    if (!selectedExpId) return null;
    return expediteurs.find((e) => e.id === selectedExpId) ?? null;
  }, [selectedExpId, expediteurs]);

  const selectedExpName = selectedExp ? `${selectedExp.first_name} ${selectedExp.last_name}` : null;

  // For expediteur tab: auto-detect departure wilaya from expediteur profile
  const expDepartureWilayaId = selectedExp?.wilaya_id ?? null;
  const expDepartureWilayaName = selectedExp?.wilaya?.name ?? null;

  // Effective departure wilaya (for defaults tab use the selector, for expediteur tab use auto-detected)
  const effectiveDepartureId = mainTab === "expediteur" ? expDepartureWilayaId : departureWilayaId;

  // ── Load tariffs when tab / departure / expediteur changes ──
  const loadTariffs = useCallback(async () => {
    setLoading(true);
    try {
      if (mainTab === "defaults") {
        if (!departureWilayaId) {
          setTariffs({});
          setOverrideCounts({});
          // Still load configured departures
          const depRes = await getDefaultDepartures();
          if (depRes.success && depRes.data) setConfiguredDepartures(depRes.data as Wilaya[]);
          return;
        }
        const [res, depRes] = await Promise.all([
          getDefaultTariffs(departureWilayaId),
          getDefaultDepartures(),
        ]);
        if (res.success && res.data) {
          const byW: Record<number, TariffRow> = {};
          for (const row of res.data.tariffs) byW[row.destination_wilaya_id] = row;
          setTariffs(byW);
          setOverrideCounts(res.data.override_counts || {});
        } else {
          setTariffs({});
          setOverrideCounts({});
        }
        if (depRes.success && depRes.data) setConfiguredDepartures(depRes.data as Wilaya[]);
      } else if (selectedExpId && expDepartureWilayaId) {
        const res = await getExpediteurTariffs(selectedExpId, expDepartureWilayaId);
        if (res.success && res.data) {
          const byW: Record<number, TariffRow> = {};
          for (const row of res.data.tariffs) byW[row.destination_wilaya_id] = row;
          setTariffs(byW);
        } else {
          setTariffs({});
        }
        setOverrideCounts({});
      } else {
        setTariffs({});
        setOverrideCounts({});
      }
      setDirtyIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [mainTab, departureWilayaId, selectedExpId, expDepartureWilayaId]);

  useEffect(() => { loadTariffs(); }, [loadTariffs]);

  // Auto-dismiss success banner after a few seconds
  useEffect(() => {
    if (saveMsg?.kind !== "success") return;
    const id = setTimeout(() => setSaveMsg(null), 4000);
    return () => clearTimeout(id);
  }, [saveMsg]);

  // ── Handlers ─────────────────────────────────────────────
  function handlePriceChange(wId: number, col: string, value: string) {
    const num = value === "" ? 0 : parseFloat(value);
    setTariffs((p) => {
      const existing = p[wId] || { destination_wilaya_id: wId } as TariffRow;
      return { ...p, [wId]: { ...existing, [col]: isNaN(num) ? 0 : num } };
    });
    setDirtyIds((p) => new Set(p).add(wId));
  }

  function handleDepartureChange(wId: number) {
    if (dirtyIds.size > 0 && !confirm("Modifications non enregistrées. Continuer ?")) return;
    setDepartureWilayaId(wId);
    setDepartureDropdown(false);
    setDepartureSearch("");
  }

  async function handleSave() {
    const depId = effectiveDepartureId;
    if (!depId) return;

    const rows: Partial<TariffRow>[] = [];
    for (const wId of dirtyIds) {
      const row = tariffs[wId];
      if (!row) continue;
      const out: Record<string, unknown> = {
        departure_wilaya_id: depId,
        destination_wilaya_id: row.destination_wilaya_id,
      };
      for (const col of PRICE_COLUMNS) out[col] = (row as Record<string, unknown>)[col] ?? 0;
      rows.push(out as Partial<TariffRow>);
    }
    if (rows.length === 0) return;

    const savedCount = rows.length;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = mainTab === "defaults"
        ? await saveDefaultTariffs(rows)
        : await saveExpediteurTariffs(selectedExpId!, rows);
      if (res.success) {
        setDirtyIds(new Set());
        await loadTariffs();
        const apiMsg = (res.data as { message?: string } | undefined)?.message;
        setSaveMsg({ kind: "success", text: apiMsg || `${savedCount} tarif(s) enregistré(s)` });
      } else {
        const detail = res.errors ? Object.values(res.errors).flat().join(", ") : "";
        setSaveMsg({
          kind: "error",
          text: (res.message || "Erreur lors de l'enregistrement") + (detail ? ` — ${detail}` : ""),
        });
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Computed ─────────────────────────────────────────────
  const currentServiceTab = SERVICE_TABS.find((s) => s.key === serviceTab);

  const filteredWilayas = useMemo(() => {
    let list = wilayas;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((w) => w.name.toLowerCase().includes(q) || String(w.code ?? "").includes(q));
    }
    return [...list].sort((a, b) => parseInt(String(a.code)) - parseInt(String(b.code)));
  }, [wilayas, search]);

  const configuredCount = useMemo(() => {
    let c = 0;
    for (const [, row] of Object.entries(tariffs)) {
      if (PRICE_COLUMNS.some((col) => Number((row as Record<string, unknown>)[col]) > 0)) c++;
    }
    return c;
  }, [tariffs]);

  const filteredDepartureWilayas = useMemo(() => {
    let list = wilayas;
    if (departureSearch.trim()) {
      const q = departureSearch.toLowerCase();
      list = list.filter((w) => w.name.toLowerCase().includes(q) || String(w.code ?? "").includes(q));
    }
    return [...list].sort((a, b) => parseInt(String(a.code)) - parseInt(String(b.code)));
  }, [wilayas, departureSearch]);

  const filteredExpediteurs = useMemo(() => {
    if (!expSearch.trim()) return expediteurs;
    const q = expSearch.toLowerCase();
    return expediteurs.filter((u) =>
      u.first_name.toLowerCase().includes(q) ||
      u.last_name.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  }, [expediteurs, expSearch]);

  const currentDepartureName = useMemo(() => {
    if (!departureWilayaId) return null;
    return wilayas.find((w) => w.id === departureWilayaId)?.name ?? null;
  }, [departureWilayaId, wilayas]);

  const dirtyCount = dirtyIds.size;

  // ── Need departure selected to show table ─────────────────
  const canShowTable = mainTab === "defaults"
    ? departureWilayaId !== null
    : selectedExpId !== null && expDepartureWilayaId !== null;

  // ── Styles ───────────────────────────────────────────────
  const inpSt: React.CSSProperties = {
    width: "100%", textAlign: "right", padding: "5px 8px", fontSize: 13,
    background: t.inp.bg, border: `1px solid ${t.inp.border}`, borderRadius: 6,
    color: t.inp.text, outline: "none",
  };

  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: t.text }}>Tarification</h1>
          <p style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
            {mainTab === "defaults" ? "Grille tarifaire par défaut" : `Tarifs pour ${selectedExpName || "..."}`}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || dirtyCount === 0 || !canShowTable}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13, fontWeight: 500,
            background: dirtyCount > 0 ? "#f97316" : t.chipDefault.bg,
            color: dirtyCount > 0 ? "#fff" : t.textMuted,
            border: "none", borderRadius: 8, cursor: dirtyCount > 0 ? "pointer" : "not-allowed",
            opacity: (saving || dirtyCount === 0) ? 0.5 : 1, transition: "all 0.15s",
          }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Enregistrement..." : `Enregistrer${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
        </button>
      </div>

      {/* ── Save feedback banner ── */}
      {saveMsg && (
        <div role="status" style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
          padding: "10px 14px", fontSize: 13, fontWeight: 500, borderRadius: 10,
          background: saveMsg.kind === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          color: saveMsg.kind === "success" ? "#10b981" : "#ef4444",
          border: `1px solid ${saveMsg.kind === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
        }}>
          {saveMsg.kind === "success"
            ? <CheckCircle2 className="w-4 h-4" />
            : <AlertCircle className="w-4 h-4" />}
          <span style={{ flex: 1 }}>{saveMsg.text}</span>
          <button onClick={() => setSaveMsg(null)} aria-label="Fermer"
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex", padding: 0 }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div style={{ background: t.card, borderRadius: 12, border: `1px solid ${t.border}`, overflow: "hidden" }}>
        {/* ── Main tabs ── */}
        <div style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: `1px solid ${t.border}` }}>
          {MAIN_TABS.map((tab) => {
            const active = mainTab === tab.key;
            return (
              <button key={tab.key} onClick={() => { setMainTab(tab.key); setDirtyIds(new Set()); }}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 13, fontWeight: 500,
                  background: active ? t.activeTab.bg : "transparent",
                  color: active ? t.activeTab.text : t.textMuted,
                  border: active ? `1px solid ${t.activeTab.border}` : "1px solid transparent",
                  borderRadius: 8, cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Expediteur selector (only in expediteur tab) ── */}
        {mainTab === "expediteur" && (
          <div style={{ padding: "8px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>Expéditeur:</span>
            <div style={{ position: "relative" }}>
              <button onClick={() => setExpDropdown((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", fontSize: 13,
                  background: selectedExpId ? t.chipActive.bg : t.chipDefault.bg,
                  color: selectedExpId ? t.chipActive.text : t.textMuted,
                  border: `1px solid ${selectedExpId ? t.chipActive.border : t.chipDefault.border}`,
                  borderRadius: 8, cursor: "pointer",
                }}
              >
                {selectedExpName || "Sélectionner un expéditeur"}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {expDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => { setExpDropdown(false); setExpSearch(""); }} />
                  <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: 4, width: 280,
                    background: t.card, border: `1px solid ${t.border}`, borderRadius: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 50, maxHeight: 280,
                    display: "flex", flexDirection: "column",
                  }}>
                    <div style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>
                      <input value={expSearch} onChange={(e) => setExpSearch(e.target.value)}
                        placeholder="Rechercher..." autoFocus
                        style={{ ...inpSt, textAlign: "left" }}
                      />
                    </div>
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {filteredExpediteurs.map((u) => (
                        <button key={u.id}
                          onClick={() => { setSelectedExpId(u.id); setExpDropdown(false); setExpSearch(""); }}
                          style={{
                            display: "block", width: "100%", textAlign: "left", padding: "6px 12px", fontSize: 12,
                            background: selectedExpId === u.id ? t.chipActive.bg : "transparent",
                            color: selectedExpId === u.id ? t.chipActive.text : t.textSub,
                            border: "none", cursor: "pointer",
                          }}
                        >
                          {u.first_name} {u.last_name} — {u.phone || u.email}
                          {u.wilaya && <span style={{ fontSize: 10, color: t.textFaint, marginLeft: 6 }}>({u.wilaya.name})</span>}
                        </button>
                      ))}
                      {filteredExpediteurs.length === 0 && (
                        <p style={{ padding: 12, fontSize: 12, color: t.textFaint, textAlign: "center" }}>Aucun expéditeur trouvé</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {selectedExp && expDepartureWilayaName && (
              <span style={{ fontSize: 11, color: t.chipActive.text, fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                <Plane className="w-3.5 h-3.5" />
                Wilaya départ: {expDepartureWilayaName}
              </span>
            )}
            {selectedExp && !expDepartureWilayaId && (
              <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 500 }}>
                Cet expéditeur n&apos;a pas de wilaya configurée
              </span>
            )}
          </div>
        )}

        {/* ── Departure wilaya selector (only in defaults tab) ── */}
        {mainTab === "defaults" && (
          <div style={{ padding: "8px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Plane className="w-4 h-4" style={{ color: t.textMuted }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>Wilaya départ:</span>
            {configuredDepartures.map((dep) => (
              <button key={dep.id} onClick={() => handleDepartureChange(dep.id)}
                style={{
                  padding: "4px 10px", fontSize: 11, fontWeight: 500, borderRadius: 6, cursor: "pointer",
                  background: departureWilayaId === dep.id ? t.chipActive.bg : t.chipDefault.bg,
                  color: departureWilayaId === dep.id ? t.chipActive.text : t.textMuted,
                  border: `1px solid ${departureWilayaId === dep.id ? t.chipActive.border : t.chipDefault.border}`,
                }}
              >{dep.name}</button>
            ))}
            <div style={{ position: "relative" }}>
              <button onClick={() => setDepartureDropdown((v) => !v)}
                style={{
                  padding: "4px 10px", fontSize: 11, fontWeight: 500, borderRadius: 6, cursor: "pointer",
                  background: t.chipDefault.bg, color: t.textMuted,
                  border: `1px dashed ${t.chipDefault.border}`,
                }}
              >+ Sélectionner wilaya</button>
              {departureDropdown && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => { setDepartureDropdown(false); setDepartureSearch(""); }} />
                  <div style={{
                    position: "absolute", top: "100%", left: 0, marginTop: 4, width: 260,
                    background: t.card, border: `1px solid ${t.border}`, borderRadius: 10,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 50, maxHeight: 280,
                    display: "flex", flexDirection: "column",
                  }}>
                    <div style={{ padding: 8, borderBottom: `1px solid ${t.border}` }}>
                      <input value={departureSearch} onChange={(e) => setDepartureSearch(e.target.value)}
                        placeholder="Rechercher wilaya..." autoFocus
                        style={{ ...inpSt, textAlign: "left" }}
                      />
                    </div>
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {filteredDepartureWilayas.map((w) => (
                        <button key={w.id}
                          onClick={() => handleDepartureChange(w.id)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            width: "100%", textAlign: "left", padding: "5px 12px", fontSize: 12,
                            background: departureWilayaId === w.id ? t.chipActive.bg : "transparent",
                            color: departureWilayaId === w.id ? t.chipActive.text : t.textSub,
                            border: "none", cursor: "pointer",
                          }}
                        >
                          <span>{w.code} — {w.name}</span>
                          {configuredDepartures.some((d) => d.id === w.id) && (
                            <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "rgba(16,185,129,0.1)", color: "#10b981" }}>configuré</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            {departureWilayaId !== null && (
              <span style={{ fontSize: 11, color: t.chipActive.text, fontWeight: 500 }}>
                Depuis: {currentDepartureName}
              </span>
            )}
          </div>
        )}

        {/* ── Service tabs + search ── */}
        <div style={{ padding: "8px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 2, marginRight: "auto" }}>
            {SERVICE_TABS.map((tab) => {
              const active = serviceTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setServiceTab(tab.key)}
                  style={{
                    padding: "5px 12px", fontSize: 12, fontWeight: 500, borderRadius: 6, cursor: "pointer",
                    background: active ? t.activeTab.bg : "transparent",
                    color: active ? t.activeTab.text : t.textMuted,
                    border: active ? `1px solid ${t.activeTab.border}` : "1px solid transparent",
                    transition: "all 0.15s",
                  }}
                >{tab.label}</button>
              );
            })}
          </div>
          <div style={{ position: "relative" }}>
            <Search className="w-3.5 h-3.5" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher wilaya..."
              style={{ ...inpSt, textAlign: "left", paddingLeft: 28, width: 180 }}
            />
          </div>
          {canShowTable && (
            <span style={{ fontSize: 11, color: t.textMuted }}>
              <span style={{ fontWeight: 600, color: t.activeTab.text }}>{configuredCount}</span>/{wilayas.length} configurées
            </span>
          )}
        </div>

        {/* ── Table ── */}
        <div style={{ maxHeight: 520, overflowY: "auto" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: t.textMuted }} />
            </div>
          ) : !canShowTable ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 64, color: t.textFaint }}>
              {mainTab === "defaults" ? (
                <>
                  <Plane className="w-8 h-8 mb-2" />
                  <p style={{ fontSize: 13 }}>Sélectionnez une wilaya de départ</p>
                </>
              ) : !selectedExpId ? (
                <>
                  <Users className="w-8 h-8 mb-2" />
                  <p style={{ fontSize: 13 }}>Sélectionnez un expéditeur pour voir ses tarifs</p>
                </>
              ) : (
                <>
                  <Plane className="w-8 h-8 mb-2" />
                  <p style={{ fontSize: 13 }}>Cet expéditeur n&apos;a pas de wilaya configurée</p>
                </>
              )}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: t.card, zIndex: 5 }}>
                  <th style={{ ...thSt(t), width: 40, textAlign: "left" }}>#</th>
                  <th style={{ ...thSt(t), textAlign: "left", minWidth: 140 }}>Wilaya destination</th>
                  <th style={{ ...thSt(t), width: 130, textAlign: "right" }}>Domicile (DA)</th>
                  <th style={{ ...thSt(t), width: 130, textAlign: "right" }}>Stop Desk (DA)</th>
                  {mainTab === "defaults" && (
                    <th style={{ ...thSt(t), width: 80, textAlign: "center" }}>Overrides</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredWilayas.map((w) => {
                  const row = tariffs[w.id];
                  const isDirty = dirtyIds.has(w.id);
                  const hasData = row && PRICE_COLUMNS.some((col) => Number((row as Record<string, unknown>)[col]) > 0);
                  const overrideCount = overrideCounts[w.id] || 0;
                  const rowBg = isDirty ? t.dirtyBg : hasData ? t.greenBg : "transparent";

                  return (
                    <tr key={w.id} style={{ borderBottom: `1px solid ${t.divider}`, background: rowBg }}>
                      <td style={{ padding: "6px 8px", color: t.textFaint, fontSize: 11 }}>{w.code}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 500, fontSize: 12, color: t.text }}>{w.name}</td>
                      {currentServiceTab && (
                        <>
                          <td style={{ padding: "4px 4px" }}>
                            <input type="number" min="0" step="10"
                              value={String((row as Record<string, unknown>)?.[currentServiceTab.homeCol] ?? "")}
                              onChange={(e) => handlePriceChange(w.id, currentServiceTab.homeCol, e.target.value)}
                              placeholder="—" style={inpSt}
                            />
                          </td>
                          <td style={{ padding: "4px 4px" }}>
                            <input type="number" min="0" step="10"
                              value={String((row as Record<string, unknown>)?.[currentServiceTab.deskCol] ?? "")}
                              onChange={(e) => handlePriceChange(w.id, currentServiceTab.deskCol, e.target.value)}
                              placeholder="—" style={inpSt}
                            />
                          </td>
                        </>
                      )}
                      {mainTab === "defaults" && (
                        <td style={{ padding: "4px 4px", textAlign: "center" }}>
                          {overrideCount > 0 ? (
                            <span style={{
                              display: "inline-block", padding: "1px 8px", fontSize: 10, fontWeight: 600,
                              borderRadius: 10, background: "rgba(249,115,22,0.1)", color: "#f97316",
                            }}>
                              {overrideCount} exp.
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: t.textFaint }}>—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        {canShowTable && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderTop: `1px solid ${t.border}`,
          }}>
            <p style={{ fontSize: 11, color: t.textFaint }}>
              {mainTab === "defaults"
                ? `Tarifs depuis ${currentDepartureName}`
                : `Tarifs ${selectedExpName} — départ ${expDepartureWilayaName}`}
            </p>
            <button onClick={handleSave}
              disabled={saving || dirtyCount === 0}
              style={{
                padding: "7px 16px", fontSize: 13, fontWeight: 500, borderRadius: 8,
                background: dirtyCount > 0 ? "#f97316" : t.chipDefault.bg,
                color: dirtyCount > 0 ? "#fff" : t.textMuted,
                border: "none", cursor: dirtyCount > 0 ? "pointer" : "not-allowed",
                opacity: (saving || dirtyCount === 0) ? 0.5 : 1,
              }}
            >Enregistrer</button>
          </div>
        )}
      </div>
    </div>
  );
}

function thSt(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    padding: "8px 4px", fontSize: 10, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.08em",
    color: t.textFaint, borderBottom: `1px solid ${t.border}`,
  };
}
