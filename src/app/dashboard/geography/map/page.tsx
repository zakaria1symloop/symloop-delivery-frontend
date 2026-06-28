"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  getWilayas,
  type Wilaya, type Commune, type StopDesk,
} from "@/lib/geography";
import { api } from "@/lib/api";
import { Globe, Layers, MapPin, Building2, Loader2, Warehouse } from "lucide-react";

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
    bg:         "#0e1017",
    panel:      "#111827",
    border:     "#1e2130",
    divider:    "#1e2130",
    text:       "#f0f0f5",
    textSub:    "#d1d5db",
    textMuted:  "#6b7280",
    textFaint:  "#4b5563",
    sectionAlt: "#1a1f2e",
    chip:       { bg: "#1e2130", border: "#2a3145" },
  } : {
    bg:         "#f0f2f5",
    panel:      "#ffffff",
    border:     "#e5e7eb",
    divider:    "#f3f4f6",
    text:       "#111827",
    textSub:    "#374151",
    textMuted:  "#6b7280",
    textFaint:  "#9ca3af",
    sectionAlt: "#f9fafb",
    chip:       { bg: "#f3f4f6", border: "#e5e7eb" },
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── LayerToggle ─────────────────────────────────────────── */
function LayerToggle({ checked, onChange, color, isDark }: {
  checked: boolean; onChange: () => void; color: string; isDark: boolean;
}) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: checked ? color : (isDark ? "#444" : "#d1d5db"),
        border: "none", cursor: "pointer", position: "relative",
        transition: "background 0.2s", flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2,
        left: checked ? 17 : 3,
        width: 16, height: 16, borderRadius: "50%",
        background: "#ffffff", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        display: "block",
      }} />
    </button>
  );
}

/* ── CoverageRow ─────────────────────────────────────────── */
function CoverageRow({ label, withCoords, total, color, t, loading }: {
  label: string; withCoords: number; total: number; color: string; t: Tokens; loading?: boolean;
}) {
  const pct = total > 0 ? Math.round((withCoords / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11 }}>
        <span style={{ color: t.textSub, fontWeight: 500 }}>{label}</span>
        <span style={{ color: t.textMuted, fontFamily: "monospace" }}>
          {loading ? (
            <Loader2 size={11} className="animate-spin" style={{ display: "inline", verticalAlign: "middle" }} />
          ) : (
            <>{withCoords} / {total} <span style={{ color: t.textFaint }}>({pct}%)</span></>
          )}
        </span>
      </div>
      <div style={{ height: 5, background: t.divider, borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          width: loading ? "0%" : `${pct}%`, height: "100%", background: color,
          borderRadius: 3, transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}

/* ── Dynamic map import (Google Maps, client-only) ──────────── */
const GeoMap = dynamic(() => import("./GeoMapGoogle"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
      <Loader2 size={22} className="animate-spin" style={{ color: "#f97316" }} />
    </div>
  ),
});

/* ── Page ────────────────────────────────────────────────── */
export default function MapPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [wilayas, setWilayas]   = useState<Wilaya[]>([]);
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [desks, setDesks]       = useState<StopDesk[]>([]);

  // Per-dataset loading / loaded flags — wilayas load first, the rest lazily.
  const [wLoading, setWLoading] = useState(true);
  const [cLoading, setCLoading] = useState(false);
  const [cLoaded,  setCLoaded]  = useState(false);
  const [dLoading, setDLoading] = useState(false);
  const [dLoaded,  setDLoaded]  = useState(false);

  const [layers, setLayers]       = useState({ wilayas: true, communes: true, desks: true });
  const [deskTypeFilter, setDeskFilter] = useState("all");

  // 1) Load wilayas immediately so the map is usable right away.
  useEffect(() => {
    getWilayas({ full: true }).then((r) => {
      if (r.success && r.data) setWilayas(r.data);
      setWLoading(false);
    }).catch(() => setWLoading(false));
  }, []);

  // 2) Load communes lazily — only once, the first time the layer is enabled.
  //    Single bulk request (?all=1) instead of one-per-wilaya.
  useEffect(() => {
    if (!layers.communes || cLoaded || cLoading) return;
    setCLoading(true);
    api<Commune[]>("/communes?all=1").then((r) => {
      if (r.success && r.data) setCommunes(r.data);
      setCLoaded(true);
      setCLoading(false);
    }).catch(() => setCLoading(false));
  }, [layers.communes, cLoaded, cLoading]);

  // 3) Load stop desks lazily — single bulk request instead of one-per-commune.
  useEffect(() => {
    if (!layers.desks || dLoaded || dLoading) return;
    setDLoading(true);
    api<StopDesk[]>("/stop-desks").then((r) => {
      if (r.success && r.data) setDesks(r.data);
      setDLoaded(true);
      setDLoading(false);
    }).catch(() => setDLoading(false));
  }, [layers.desks, dLoaded, dLoading]);

  const withGpsW = wilayas.filter(w => w.lat != null && w.lng != null).length;
  const withGpsC = communes.filter(c => c.lat != null && c.lng != null).length;
  const withGpsD = desks.filter(d => d.lat != null && d.lng != null).length;

  const LAYER_CFG = [
    { key: "wilayas"  as const, label: "Wilayas",    color: "#f97316", Icon: MapPin    },
    { key: "communes" as const, label: "Communes",   color: "#3b82f6", Icon: Building2 },
    { key: "desks"    as const, label: "Stop Desks", color: "#10b981", Icon: Warehouse  },
  ];

  const DESK_FILTERS = [
    { key: "all",    label: "Tous",   color: t.textSub  },
    { key: "agence", label: "Agence", color: "#3b82f6"  },
    { key: "depot",  label: "Dépôt",  color: "#f59e0b"  },
    { key: "hub",    label: "HUB",    color: "#10b981"  },
  ];

  // KPI value helper: spinner while loading, count once loaded, dash otherwise.
  const kpiValue = (loading: boolean, loaded: boolean, count: number) =>
    loading ? "…" : (loaded ? String(count) : "—");

  const lazyLoading = cLoading || dLoading;

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <div style={{
        display: "flex",
        height: "calc(100vh - 8.5rem)",
        minHeight: 520,
        background: t.panel,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        overflow: "hidden",
      }}>

        {/* ── Left control panel ── */}
        <div style={{
          width: 300, flexShrink: 0,
          borderRight: `1px solid ${t.border}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ flex: 1, overflowY: "auto" }}>

            {/* Header */}
            <div style={{ padding: "16px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: "rgba(249,115,22,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Globe size={16} color="#f97316" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: t.text }}>
                    Carte Géographique
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>
                    Vue d'ensemble du réseau
                  </div>
                </div>
              </div>
            </div>

            {/* KPI chips */}
            <div style={{
              padding: "12px 14px",
              background: t.sectionAlt,
              borderBottom: `1px solid ${t.divider}`,
              display: "flex", gap: 8,
            }}>
              {[
                { label: "Wilayas",    value: kpiValue(wLoading, !wLoading, wilayas.length), color: "#f97316" },
                { label: "Communes",   value: kpiValue(cLoading, cLoaded, communes.length),  color: "#3b82f6" },
                { label: "Stop Desks", value: kpiValue(dLoading, dLoaded, desks.length),     color: "#10b981" },
              ].map(kpi => (
                <div key={kpi.label} style={{
                  flex: 1, background: t.panel,
                  border: `1px solid ${t.chip.border}`,
                  borderRadius: 8, padding: "8px 6px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: kpi.color, lineHeight: 1 }}>
                    {kpi.value}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 600, color: t.textMuted, marginTop: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {kpi.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Layers toggles */}
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.divider}` }}>
              <p style={{
                margin: "0 0 10px", fontSize: 10, fontWeight: 700,
                color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.1em",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <Layers size={10} /> Couches
              </p>
              {LAYER_CFG.map((layer, i) => {
                const layerLoading =
                  (layer.key === "communes" && cLoading) ||
                  (layer.key === "desks" && dLoading);
                return (
                  <div
                    key={layer.key}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 0",
                      borderTop: i > 0 ? `1px solid ${t.divider}` : undefined,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: layer.color, flexShrink: 0 }} />
                      <layer.Icon size={12} color={t.textMuted} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{layer.label}</span>
                      {layerLoading && (
                        <Loader2 size={11} className="animate-spin" style={{ color: t.textFaint }} />
                      )}
                    </div>
                    <LayerToggle
                      checked={layers[layer.key]}
                      onChange={() => setLayers(p => ({ ...p, [layer.key]: !p[layer.key] }))}
                      color={layer.color}
                      isDark={isDark}
                    />
                  </div>
                );
              })}
            </div>

            {/* Desk type filter */}
            {layers.desks && (
              <div style={{
                padding: "10px 16px 12px",
                background: t.sectionAlt,
                borderBottom: `1px solid ${t.divider}`,
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Type de desk
                </p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {DESK_FILTERS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setDeskFilter(f.key)}
                      style={{
                        padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        border: `1px solid ${deskTypeFilter === f.key ? f.color : t.border}`,
                        background: deskTypeFilter === f.key
                          ? (f.key === "all"
                              ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)")
                              : `${f.color}18`)
                          : "transparent",
                        color: deskTypeFilter === f.key ? f.color : t.textMuted,
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >{f.label}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Legend */}
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.divider}` }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Légende
              </p>
              {[
                { color: "#f97316", label: "Wilaya",  ring: true  },
                { color: "#3b82f6", label: "Commune", ring: true  },
                { color: "#3b82f6", label: "Agence",  ring: false },
                { color: "#f59e0b", label: "Dépôt",   ring: false },
                { color: "#10b981", label: "HUB",     ring: false },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: item.ring ? 12 : 10,
                    height: item.ring ? 12 : 10,
                    borderRadius: "50%",
                    background: item.ring ? `${item.color}20` : item.color,
                    border: `2px solid ${item.color}`,
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, color: t.textSub }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* GPS Coverage */}
            <div style={{ padding: "12px 16px" }}>
              <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Couverture GPS
              </p>
              <CoverageRow label="Wilayas"    withCoords={withGpsW} total={wilayas.length}  color="#f97316" t={t} loading={wLoading} />
              <CoverageRow label="Communes"   withCoords={withGpsC} total={communes.length} color="#3b82f6" t={t} loading={cLoading || !cLoaded} />
              <CoverageRow label="Stop Desks" withCoords={withGpsD} total={desks.length}    color="#10b981" t={t} loading={dLoading || !dLoaded} />
            </div>

          </div>
        </div>

        {/* ── Map area ── */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          {wLoading ? (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 12, background: isDark ? "#1e1e1e" : "#eef0f3",
            }}>
              <Loader2 size={32} className="animate-spin" style={{ color: "#f97316" }} />
              <span style={{ fontSize: 13, color: t.textMuted, fontWeight: 500 }}>
                Chargement des données…
              </span>
            </div>
          ) : (
            <>
              <GeoMap
                wilayas={wilayas}
                communes={communes}
                desks={desks}
                layers={layers}
                deskTypeFilter={deskTypeFilter}
                isDark={isDark}
              />
              {lazyLoading && (
                <div style={{
                  position: "absolute", top: 12, left: 12, zIndex: 1000,
                  display: "flex", alignItems: "center", gap: 7,
                  background: t.panel, border: `1px solid ${t.border}`,
                  borderRadius: 8, padding: "6px 12px",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
                }}>
                  <Loader2 size={13} className="animate-spin" style={{ color: "#f97316" }} />
                  <span style={{ fontSize: 12, color: t.textSub, fontWeight: 500 }}>
                    Chargement des couches…
                  </span>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
