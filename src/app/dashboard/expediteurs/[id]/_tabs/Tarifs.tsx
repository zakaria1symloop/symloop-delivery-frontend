"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Tags, Search, X, Loader2, RefreshCw, AlertCircle, ReceiptText,
  Home, Building2, Plane, MapPin, Layers, Info, ArrowRight, ExternalLink,
} from "lucide-react";
import { ORANGE, formatDA } from "../../../_ui";
import { getExpTarifs, type TariffRow } from "@/lib/expediteur-admin";
import { SERVICE_TABS, type ServiceType } from "@/lib/tarification";
import type { ExpTabProps } from "./types";

/* ── Service filter (a SERVICE_TABS key, or the consolidated "all" view) ── */
type ServiceFilter = ServiceType | "all";

/** Render a price cell: dimmed em-dash when unset (0 / null), bold value otherwise. */
function priceText(value: unknown, faint: string, strong: string): { txt: string; color: string; weight: number } {
  const n = Number(value);
  if (!n || n <= 0) return { txt: "—", color: faint, weight: 500 };
  return { txt: formatDA(n), color: strong, weight: 700 };
}

/* ═══════════════════════════════════════════════════════════════ */
/*  TARIFS TAB — read-only view of a merchant's grille tarifaire    */
/*  (per-expéditeur overrides from GET /tarification/expediteur/:id)*/
/* ═══════════════════════════════════════════════════════════════ */
export default function Tarifs({ userId, user, t }: ExpTabProps) {
  /* ── Data ── */
  const [tariffs, setTariffs] = useState<TariffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  /* ── UI state ── */
  const [service, setService] = useState<ServiceFilter>("delivery");
  const [search, setSearch] = useState("");

  /* ── Fetch (alive-guarded) — keyed on userId + reload ── */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getExpTarifs(userId)
      .then((res) => {
        if (!alive) return;
        if (res.success && res.data) {
          setTariffs(res.data.tariffs || []);
        } else {
          setError(res.message || "Impossible de charger la grille tarifaire de cet expéditeur.");
          setTariffs([]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Une erreur est survenue lors du chargement des tarifs.");
        setTariffs([]);
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId, reloadKey]);

  /* ── Derived: search-filtered + sorted (départ → destination) ── */
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? tariffs.filter((r) => {
          const dest = r.destination_wilaya?.name?.toLowerCase() ?? "";
          const dep = r.departure_wilaya?.name?.toLowerCase() ?? "";
          const destCode = String(r.destination_wilaya?.code ?? r.destination_wilaya_id);
          const depCode = String(r.departure_wilaya?.code ?? r.departure_wilaya_id);
          return dest.includes(q) || dep.includes(q) || destCode.includes(q) || depCode.includes(q);
        })
      : tariffs;
    return [...filtered].sort((a, b) =>
      (a.departure_wilaya_id - b.departure_wilaya_id) ||
      (a.destination_wilaya_id - b.destination_wilaya_id));
  }, [tariffs, search]);

  /* ── Derived: summary metrics ── */
  const stats = useMemo(() => {
    const departures = new Set<number>();
    const destinations = new Set<number>();
    for (const r of tariffs) {
      departures.add(r.departure_wilaya_id);
      destinations.add(r.destination_wilaya_id);
    }
    return { total: tariffs.length, departures: departures.size, destinations: destinations.size };
  }, [tariffs]);

  const activeServiceTab = SERVICE_TABS.find((s) => s.key === service);
  const isAll = service === "all";
  const merchantWilaya = user.wilaya?.name ?? null;

  /* ── Shared cell styles ── */
  const headBaseStyle: React.CSSProperties = {
    padding: "11px 14px", textAlign: "left", fontSize: 10.5,
    fontWeight: 700, color: t.textMuted, textTransform: "uppercase",
    letterSpacing: "0.05em", whiteSpace: "nowrap",
    position: "sticky", top: 0, background: t.card, zIndex: 1,
  };
  const cellStyle: React.CSSProperties = {
    padding: "11px 14px", fontSize: 12.5, color: t.textSub, verticalAlign: "middle",
  };
  const priceCol = (value: unknown): React.CSSProperties => {
    const p = priceText(value, t.textFaint, t.text);
    return { ...cellStyle, textAlign: "right", whiteSpace: "nowrap", color: p.color, fontWeight: p.weight };
  };

  /* ── # of columns for empty/loading colspans ── */
  const colCount = isAll ? 2 + SERVICE_TABS.length * 2 + 1 : 5;

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Tab header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: ORANGE + "14",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Tags size={18} color={ORANGE} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: t.text, letterSpacing: -0.3 }}>Tarifs</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>
              {loading
                ? "Chargement…"
                : stats.total > 0
                  ? <>Grille tarifaire personnalisée — {stats.total} tarif{stats.total > 1 ? "s" : ""} dérogatoire{stats.total > 1 ? "s" : ""}</>
                  : <>Grille tarifaire de {user.first_name}</>}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/dashboard/tarification"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
              borderRadius: 9, border: `1px solid ${t.border}`, background: t.card,
              color: t.textSub, fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            <ExternalLink size={14} /> Gérer la grille
          </Link>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            disabled={loading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
              borderRadius: 9, border: `1px solid ${t.border}`, background: t.card,
              color: t.textSub, fontSize: 13, fontWeight: 600,
              cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: "spin 0.8s linear infinite" } : undefined} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ── Summary tiles ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <SummaryTile t={t} icon={Layers}  label="Tarifs dérogatoires" value={loading ? "—" : String(stats.total)}        color="#f97316" />
        <SummaryTile t={t} icon={Plane}   label="Wilayas de départ"   value={loading ? "—" : String(stats.departures)}   color="#0ea5e9" />
        <SummaryTile t={t} icon={MapPin}  label="Destinations"        value={loading ? "—" : String(stats.destinations)} color="#a855f7" />
        <SummaryTile t={t} icon={Building2} label="Siège expéditeur"  value={merchantWilaya || "—"}                       color="#16a34a" />
      </div>

      {/* ── Read-only notice ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderRadius: 10,
        background: ORANGE + "0d", border: `1px solid ${ORANGE}33`, color: t.textSub, fontSize: 12.5,
      }}>
        <Info size={15} color={ORANGE} style={{ flexShrink: 0 }} />
        <span>
          Affichage en lecture seule des tarifs propres à cet expéditeur. Les trajets sans dérogation
          utilisent la grille par défaut. L&apos;édition se fait depuis la page <strong>Tarification</strong>.
        </span>
      </div>

      {/* ── Service tabs + search ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SERVICE_TABS.map((s) => {
            const active = service === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setService(s.key)}
                style={{
                  padding: "6px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.12s",
                  border: `1px solid ${active ? ORANGE : t.border}`,
                  background: active ? ORANGE + "16" : "transparent",
                  color: active ? ORANGE : t.textMuted,
                }}
              >
                {s.label}
              </button>
            );
          })}
          <button
            onClick={() => setService("all")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "6px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 600,
              cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.12s",
              border: `1px solid ${isAll ? ORANGE : t.border}`,
              background: isAll ? ORANGE + "16" : "transparent",
              color: isAll ? ORANGE : t.textMuted,
            }}
          >
            <Layers size={13} /> Tous les services
          </button>
        </div>

        <div style={{ position: "relative", minWidth: 220, flex: "0 1 280px" }}>
          <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par wilaya…"
            style={{
              width: "100%", padding: "9px 32px 9px 34px", borderRadius: 10,
              border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
              fontSize: 13, outline: "none", boxSizing: "border-box",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", display: "flex" }}
            >
              <X size={14} color={t.textFaint} />
            </button>
          )}
        </div>
      </div>

      {/* ── Table card ── */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        boxShadow: t.shadow, overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isAll ? 980 : 620 }}>
            <thead>
              {isAll ? (
                <>
                  <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                    <th rowSpan={2} style={headBaseStyle}>Départ</th>
                    <th rowSpan={2} style={headBaseStyle}>Destination</th>
                    {SERVICE_TABS.map((s) => (
                      <th key={s.key} colSpan={2} style={{ ...headBaseStyle, textAlign: "center", borderLeft: `1px solid ${t.divider}` }}>
                        {s.label}
                      </th>
                    ))}
                    <th rowSpan={2} style={{ ...headBaseStyle, textAlign: "center", borderLeft: `1px solid ${t.divider}` }}>Statut</th>
                  </tr>
                  <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                    {SERVICE_TABS.map((s) => (
                      <SubHead key={s.key} t={t} />
                    ))}
                  </tr>
                </>
              ) : (
                <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                  <th style={headBaseStyle}>Départ</th>
                  <th style={headBaseStyle}>Destination</th>
                  <th style={{ ...headBaseStyle, textAlign: "right" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      <Home size={12} /> Domicile
                    </span>
                  </th>
                  <th style={{ ...headBaseStyle, textAlign: "right" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      <Building2 size={12} /> Stop Desk
                    </span>
                  </th>
                  <th style={{ ...headBaseStyle, textAlign: "center" }}>Statut</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: 56, textAlign: "center" }}>
                    <Loader2 size={24} color={t.textMuted} style={{ animation: "spin 0.8s linear infinite" }} />
                    <div style={{ marginTop: 10, fontSize: 13, color: t.textMuted }}>Chargement de la grille tarifaire…</div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: 48, textAlign: "center" }}>
                    <AlertCircle size={30} color="#ef4444" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#dc2626" }}>{error}</div>
                    <button
                      onClick={() => setReloadKey((k) => k + 1)}
                      style={{
                        marginTop: 12, padding: "7px 16px", borderRadius: 8,
                        border: `1px solid ${t.border}`, background: "transparent",
                        color: t.textSub, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Réessayer
                    </button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: 56, textAlign: "center" }}>
                    <ReceiptText size={34} color={t.textFaint} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>
                      {search ? "Aucun tarif ne correspond" : "Aucun tarif dérogatoire"}
                    </div>
                    <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>
                      {search
                        ? "Essayez une autre wilaya."
                        : "Cet expéditeur utilise la grille tarifaire par défaut."}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => {
                  const depName = r.departure_wilaya?.name || `Wilaya ${r.departure_wilaya_id}`;
                  const depCode = r.departure_wilaya?.code ?? null;
                  const destName = r.destination_wilaya?.name || `Wilaya ${r.destination_wilaya_id}`;
                  const destCode = r.destination_wilaya?.code ?? null;
                  return (
                    <tr
                      key={r.id ?? `${r.departure_wilaya_id}-${r.destination_wilaya_id}-${i}`}
                      style={{ borderBottom: `1px solid ${t.divider}`, transition: "background 0.12s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.rowHover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {/* Départ */}
                      <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Plane size={12} color={t.textFaint} />
                          <span style={{ color: t.text, fontWeight: 600 }}>{depName}</span>
                          {depCode && <span style={{ fontSize: 11, color: t.textFaint }}>· {depCode}</span>}
                        </div>
                      </td>

                      {/* Destination */}
                      <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <ArrowRight size={12} color={t.textFaint} />
                          <span style={{ color: t.text, fontWeight: 600 }}>{destName}</span>
                          {destCode && <span style={{ fontSize: 11, color: t.textFaint }}>· {destCode}</span>}
                        </div>
                      </td>

                      {isAll ? (
                        SERVICE_TABS.map((s) => {
                          const h = priceText(r[s.homeCol], t.textFaint, t.text);
                          const d = priceText(r[s.deskCol], t.textFaint, t.text);
                          return (
                            <td key={s.key} colSpan={2} style={{ padding: 0, borderLeft: `1px solid ${t.divider}` }}>
                              <div style={{ display: "flex" }}>
                                <span style={{ flex: 1, ...cellStyle, textAlign: "right", whiteSpace: "nowrap", color: h.color, fontWeight: h.weight }}>{h.txt}</span>
                                <span style={{ flex: 1, ...cellStyle, textAlign: "right", whiteSpace: "nowrap", color: d.color, fontWeight: d.weight }}>{d.txt}</span>
                              </div>
                            </td>
                          );
                        })
                      ) : activeServiceTab ? (
                        <>
                          <td style={priceCol(r[activeServiceTab.homeCol])}>{priceText(r[activeServiceTab.homeCol], t.textFaint, t.text).txt}</td>
                          <td style={priceCol(r[activeServiceTab.deskCol])}>{priceText(r[activeServiceTab.deskCol], t.textFaint, t.text).txt}</td>
                        </>
                      ) : null}

                      {/* Statut */}
                      <td style={{ ...cellStyle, textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                          background: r.is_active ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.14)",
                          color: r.is_active ? "#16a34a" : "#6b7280",
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.is_active ? "#16a34a" : "#9ca3af" }} />
                          {r.is_active ? "Actif" : "Inactif"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer summary ── */}
        {!loading && !error && rows.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 16px", borderTop: `1px solid ${t.divider}`, gap: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12.5, color: t.textMuted }}>
              {rows.length.toLocaleString("fr-DZ")} trajet{rows.length > 1 ? "s" : ""}
              {search ? ` sur ${stats.total}` : ""} ·{" "}
              {isAll ? "Tous les services" : activeServiceTab?.label}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 11.5, color: t.textFaint }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Home size={12} /> Domicile</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Building2 size={12} /> Stop Desk</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Summary tile ── */
function SummaryTile({ t, icon: Icon, label, value, color }: {
  t: ExpTabProps["t"]; icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div style={{ background: t.sectionBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 17, fontWeight: 800, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

/* ── Sub-header (Dom. / Desk pair) for the consolidated "all services" view ── */
function SubHead({ t }: { t: ExpTabProps["t"] }) {
  const base: React.CSSProperties = {
    padding: "6px 14px", textAlign: "right", fontSize: 9.5, fontWeight: 700,
    color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.04em",
    whiteSpace: "nowrap", position: "sticky", top: 0, background: t.card, zIndex: 1,
  };
  return (
    <>
      <th style={{ ...base, borderLeft: `1px solid ${t.divider}` }}>Dom.</th>
      <th style={base}>Desk</th>
    </>
  );
}
