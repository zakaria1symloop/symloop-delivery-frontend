"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Users, Search, X, Loader2, RefreshCw, AlertCircle, UserX,
  MapPin, Package as PackageIcon, Coins, Phone, CheckCircle2, RotateCcw,
  ChevronUp, ChevronDown, ChevronsUpDown, CalendarClock,
} from "lucide-react";
import { ORANGE, formatDA, type Tokens } from "../../../_ui";
import { getExpClients, type ExpClient } from "@/lib/expediteur-admin";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/packages";
import type { ExpTabProps } from "./types";

/* ── Config ─────────────────────────────────────────────────── */
type SortKey = "orders" | "cod" | "rate";
type SortDir = "asc" | "desc";

/* Reuse the canonical livré / retourné palette from the package status map so the
 * delivered / returned breakdown stays visually consistent with the Colis tab. */
const C_LIVRE = STATUS_COLORS.livre;
const C_RETOUR = STATUS_COLORS.retourne;

/* ── Local formatters ───────────────────────────────────────── */
const fmtInt = (n: number | undefined | null) => Number(n || 0).toLocaleString("fr-DZ");

function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name: string | null | undefined): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Success-rate colour ramp: green ≥ 80 %, amber ≥ 50 %, red below. */
function rateColor(rate: number): string {
  if (rate >= 80) return "#16a34a";
  if (rate >= 50) return ORANGE;
  return "#ef4444";
}

/* ═══════════════════════════════════════════════════════════════ */
/*  CLIENTS TAB                                                     */
/* ═══════════════════════════════════════════════════════════════ */
export default function Clients({ userId, user, t }: ExpTabProps) {
  /* ── Data ── */
  const [clients, setClients] = useState<ExpClient[]>([]);
  const [summary, setSummary] = useState<{ total_clients: number; total_orders: number; total_cod: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Filters / sorting ── */
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("orders");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [reloadKey, setReloadKey] = useState(0);

  /* ── Debounce search ── */
  useEffect(() => {
    const h = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  /* ── Fetch (alive-guarded) — keyed on userId + search ── */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getExpClients(userId, searchDebounced || undefined)
      .then((res) => {
        if (!alive) return;
        if (res.success && res.data) {
          setClients(res.data.clients || []);
          setSummary(res.data.summary || null);
        } else {
          setError(res.message || "Impossible de charger les clients de cet expéditeur.");
          setClients([]);
          setSummary(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Une erreur est survenue lors du chargement des clients.");
        setClients([]);
        setSummary(null);
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId, searchDebounced, reloadKey]);

  /* ── Client-side sort (the endpoint returns the full aggregated set) ── */
  const sorted = useMemo(() => {
    const arr = [...clients];
    const val = (c: ExpClient) =>
      sortKey === "orders" ? c.orders_count
        : sortKey === "cod" ? c.total_cod
        : c.success_rate;
    arr.sort((a, b) => {
      const diff = val(a) - val(b);
      return sortDir === "asc" ? diff : -diff;
    });
    return arr;
  }, [clients, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const hasSearch = searchDebounced !== "";

  /* ── Shared styles ── */
  const headBaseStyle: CSSProperties = {
    padding: "11px 14px", textAlign: "left", fontSize: 10.5,
    fontWeight: 700, color: t.textMuted, textTransform: "uppercase",
    letterSpacing: "0.05em", whiteSpace: "nowrap",
    position: "sticky", top: 0, background: t.card, zIndex: 1,
  };
  const cellStyle: CSSProperties = {
    padding: "11px 14px", fontSize: 12.5, color: t.textSub, verticalAlign: "middle",
  };

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
            <Users size={18} color={ORANGE} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: t.text, letterSpacing: -0.3 }}>Clients</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>
              {loading ? "Chargement…" : (
                <>
                  {fmtInt(summary?.total_clients ?? sorted.length)} destinataire{(summary?.total_clients ?? sorted.length) > 1 ? "s" : ""}
                  {hasSearch ? " correspondant à la recherche" : ` livré${(summary?.total_clients ?? 0) > 1 ? "s" : ""} par ${user.first_name}`}
                </>
              )}
            </p>
          </div>
        </div>
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

      {/* ── Summary KPI tiles ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 11 }}>
        <SummaryTile t={t} icon={Users}       label="Clients uniques" value={fmtInt(summary?.total_clients)} color={ORANGE} />
        <SummaryTile t={t} icon={PackageIcon} label="Commandes total" value={fmtInt(summary?.total_orders)}  color="#0ea5e9" />
        <SummaryTile t={t} icon={Coins}       label="COD cumulé"      value={formatDA(summary?.total_cod)}   color="#16a34a" emphasis />
      </div>

      {/* ── Search ── */}
      <div style={{ position: "relative", maxWidth: 420 }}>
        <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, téléphone ou wilaya…"
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

      {/* ── Table card ── */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        boxShadow: t.shadow, overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                <th style={headBaseStyle}>Client</th>
                <th style={headBaseStyle}>Téléphone</th>
                <th style={headBaseStyle}>Localisation</th>
                <SortHeader t={t} label="Colis" active={sortKey === "orders"} dir={sortDir} onClick={() => toggleSort("orders")} />
                <SortHeader t={t} label="Taux réussite" active={sortKey === "rate"} dir={sortDir} onClick={() => toggleSort("rate")} />
                <SortHeader t={t} label="COD cumulé" active={sortKey === "cod"} dir={sortDir} onClick={() => toggleSort("cod")} align="right" />
                <th style={{ ...headBaseStyle, textAlign: "right" }}>Dernière commande</th>
              </tr>
            </thead>
            <tbody>
              {/* Loading */}
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: 56, textAlign: "center" }}>
                    <Loader2 size={24} color={t.textMuted} style={{ animation: "spin 0.8s linear infinite" }} />
                    <div style={{ marginTop: 10, fontSize: 13, color: t.textMuted }}>Chargement des clients…</div>
                  </td>
                </tr>
              ) : error ? (
                /* Error */
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: "center" }}>
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
              ) : sorted.length === 0 ? (
                /* Empty */
                <tr>
                  <td colSpan={7} style={{ padding: 56, textAlign: "center" }}>
                    <UserX size={34} color={t.textFaint} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>Aucun client trouvé</div>
                    <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>
                      {hasSearch ? "Essayez un autre nom, téléphone ou wilaya." : "Cet expéditeur n'a encore livré aucun destinataire."}
                    </div>
                  </td>
                </tr>
              ) : (
                /* Rows */
                sorted.map((c, i) => {
                  const rc = rateColor(c.success_rate);
                  const loc = [c.commune_name, c.wilaya_name].filter(Boolean);
                  return (
                    <tr
                      key={`${c.recipient_phone}-${i}`}
                      style={{ borderBottom: `1px solid ${t.divider}`, transition: "background 0.12s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.rowHover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {/* Client (avatar + name) */}
                      <td style={{ ...cellStyle, maxWidth: 220 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{
                            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                            background: ORANGE + "16", color: ORANGE,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11.5, fontWeight: 800,
                          }}>
                            {initials(c.recipient_name)}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: "block", fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.recipient_name || "—"}
                            </span>
                          </span>
                        </div>
                      </td>

                      {/* Téléphone */}
                      <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace", color: t.textSub }}>
                          <Phone size={12} color={t.textFaint} />
                          {c.recipient_phone || "—"}
                        </span>
                      </td>

                      {/* Localisation (wilaya / commune) */}
                      <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                        {loc.length ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <MapPin size={12} color={t.textFaint} style={{ flexShrink: 0 }} />
                            <span>
                              <span style={{ color: t.text, fontWeight: 500 }}>{c.wilaya_name || "—"}</span>
                              {c.commune_name && <span style={{ display: "block", fontSize: 11, color: t.textMuted }}>{c.commune_name}</span>}
                            </span>
                          </span>
                        ) : <span style={{ color: t.textFaint }}>—</span>}
                      </td>

                      {/* Colis (orders + delivered/returned breakdown) */}
                      <td style={cellStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{fmtInt(c.orders_count)}</span>
                          <span style={{ display: "inline-flex", gap: 4 }}>
                            <CountChip icon={CheckCircle2} value={c.delivered_count} c={C_LIVRE} title={STATUS_LABELS.livre} />
                            {c.returned_count > 0 && (
                              <CountChip icon={RotateCcw} value={c.returned_count} c={C_RETOUR} title={STATUS_LABELS.retourne} />
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Taux réussite (bar) */}
                      <td style={{ ...cellStyle, minWidth: 130 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: rc, width: 38, flexShrink: 0 }}>
                            {Math.round(c.success_rate)}%
                          </span>
                          <div style={{ flex: 1, minWidth: 50, height: 5, borderRadius: 999, background: t.border, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, c.success_rate))}%`, background: rc, borderRadius: 999, transition: "width 300ms" }} />
                          </div>
                        </div>
                      </td>

                      {/* COD cumulé */}
                      <td style={{ ...cellStyle, textAlign: "right", fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>
                        {formatDA(c.total_cod)}
                      </td>

                      {/* Dernière commande */}
                      <td style={{ ...cellStyle, textAlign: "right", color: t.textMuted, whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <CalendarClock size={12} color={t.textFaint} />
                          {shortDate(c.last_order_at)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer count ── */}
        {!loading && !error && sorted.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 16px", borderTop: `1px solid ${t.divider}`, gap: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12.5, color: t.textMuted }}>
              {fmtInt(sorted.length)} client{sorted.length > 1 ? "s" : ""} affiché{sorted.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Presentational helpers                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function SummaryTile({ t, icon: Icon, label, value, color, emphasis }: {
  t: Tokens; icon: React.ElementType; label: string; value: React.ReactNode; color: string; emphasis?: boolean;
}) {
  return (
    <div style={{
      background: emphasis ? color + "12" : t.sectionBg,
      border: `1px solid ${emphasis ? color + "33" : t.border}`,
      borderRadius: 12, padding: "13px 15px", display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 24, height: 24, borderRadius: 7, background: color + "1f", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={13} color={color} />
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <span style={{ fontSize: emphasis ? 20 : 19, fontWeight: 800, color: emphasis ? color : t.text, lineHeight: 1.1 }}>{value}</span>
    </div>
  );
}

function SortHeader({ t, label, active, dir, onClick, align = "left" }: {
  t: Tokens; label: string; active: boolean; dir: SortDir; onClick: () => void; align?: "left" | "right";
}) {
  return (
    <th style={{
      padding: "11px 14px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.05em", whiteSpace: "nowrap", textAlign: align,
      position: "sticky", top: 0, background: t.card, zIndex: 1,
      color: active ? ORANGE : t.textMuted, cursor: "pointer", userSelect: "none",
    }}>
      <button
        onClick={onClick}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          background: "transparent", border: "none", cursor: "pointer", padding: 0,
          font: "inherit", letterSpacing: "inherit", textTransform: "inherit",
          color: "inherit", flexDirection: align === "right" ? "row-reverse" : "row",
        }}
      >
        {label}
        {active ? (
          dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
        ) : (
          <ChevronsUpDown size={13} color={t.textFaint} />
        )}
      </button>
    </th>
  );
}

function CountChip({ icon: Icon, value, c, title }: {
  icon: React.ElementType; value: number; c: { bg: string; text: string; dot: string }; title: string;
}) {
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "1px 7px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
      background: c.bg, color: c.text, whiteSpace: "nowrap",
    }}>
      <Icon size={10} /> {Number(value || 0)}
    </span>
  );
}
