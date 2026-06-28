"use client";

import { useEffect, useState } from "react";
import {
  Package as PackageIcon, Search, X, Loader2, RefreshCw,
  ChevronLeft, ChevronRight, Home, Building2, PackageOpen, AlertCircle,
} from "lucide-react";
import { ORANGE, formatDA } from "../../../_ui";
import { getExpPackages } from "@/lib/expediteur-admin";
import {
  type Package, type PackageStatus,
  STATUS_LABELS, STATUS_COLORS,
} from "@/lib/packages";
import type { ExpTabProps } from "./types";

/* ── Config ─────────────────────────────────────────────────── */
const PER_PAGE = 15;

/** Curated lifecycle statuses surfaced as quick filter chips (outbound → return). */
const FILTER_STATUSES: PackageStatus[] = [
  "en_attente", "pret_a_expedier", "accepte_operateur", "en_sac",
  "en_transit", "arrive_destination", "pret_pour_retrait", "pret_pour_chauffeur",
  "en_cours_livraison", "livre", "echec_livraison", "retourne", "annule",
];

/* ── Local formatters ───────────────────────────────────────── */
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ── Status badge ───────────────────────────────────────────── */
function StatusBadge({ status }: { status: PackageStatus }) {
  const c = STATUS_COLORS[status] || { bg: "rgba(107,114,128,0.1)", text: "#6b7280", dot: "#9ca3af" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 9999,
      background: c.bg, color: c.text,
      fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {STATUS_LABELS[status] || status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  COLIS TAB                                                      */
/* ═══════════════════════════════════════════════════════════════ */
export default function Colis({ userId, user, t }: ExpTabProps) {
  /* ── Data ── */
  const [packages, setPackages] = useState<Package[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Filters ── */
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<PackageStatus>>(new Set());
  const [reloadKey, setReloadKey] = useState(0);

  /* ── Debounce search ── */
  useEffect(() => {
    const h = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(h);
  }, [search]);

  /* ── Reset to first page whenever the merchant or filters change ── */
  useEffect(() => { setPage(1); }, [userId, searchDebounced, selectedStatuses]);

  /* ── Fetch (alive-guarded) — keyed on userId + filters + page ── */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    const statusParam = selectedStatuses.size > 0
      ? Array.from(selectedStatuses).join(",")
      : undefined;

    getExpPackages(userId, {
      status: statusParam,
      search: searchDebounced || undefined,
      page,
      per_page: PER_PAGE,
    })
      .then((res) => {
        if (!alive) return;
        if (res.success && res.data) {
          setPackages(res.data.data || []);
          setLastPage(res.data.last_page || 1);
          setTotal(res.data.total || 0);
        } else {
          setError(res.message || "Impossible de charger les colis de cet expéditeur.");
          setPackages([]);
          setTotal(0);
          setLastPage(1);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Une erreur est survenue lors du chargement des colis.");
        setPackages([]);
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId, page, searchDebounced, selectedStatuses, reloadKey]);

  /* ── Status chip toggle ── */
  function toggleStatus(s: PackageStatus) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  const hasFilters = selectedStatuses.size > 0 || searchDebounced !== "";

  /* ── Shared styles ── */
  const headBaseStyle: React.CSSProperties = {
    padding: "11px 14px", textAlign: "left", fontSize: 10.5,
    fontWeight: 700, color: t.textMuted, textTransform: "uppercase",
    letterSpacing: "0.05em", whiteSpace: "nowrap",
    position: "sticky", top: 0, background: t.card, zIndex: 1,
  };
  const cellStyle: React.CSSProperties = {
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
            <PackageIcon size={18} color={ORANGE} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: t.text, letterSpacing: -0.3 }}>Colis</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>
              {loading ? "Chargement…" : (
                <>
                  {total.toLocaleString("fr-DZ")} colis
                  {hasFilters ? " correspondant aux filtres" : ` expédié${total > 1 ? "s" : ""} par ${user.first_name}`}
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

      {/* ── Search ── */}
      <div style={{ position: "relative", maxWidth: 420 }}>
        <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par tracking, destinataire ou téléphone…"
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

      {/* ── Status filter chips ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {FILTER_STATUSES.map((s) => {
          const active = selectedStatuses.has(s);
          const sc = STATUS_COLORS[s];
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              style={{
                padding: "5px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600,
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.12s",
                border: `1px solid ${active ? sc.dot : t.border}`,
                background: active ? sc.bg : "transparent",
                color: active ? sc.text : t.textMuted,
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          );
        })}
        {selectedStatuses.size > 0 && (
          <button
            onClick={() => setSelectedStatuses(new Set())}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 11px", borderRadius: 9999, fontSize: 11.5, fontWeight: 600,
              cursor: "pointer", border: "none", background: "rgba(239,68,68,0.1)", color: "#ef4444",
            }}
          >
            <X size={12} /> Effacer ({selectedStatuses.size})
          </button>
        )}
      </div>

      {/* ── Table card ── */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
        boxShadow: t.shadow, overflow: "hidden",
      }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                <th style={headBaseStyle}>Tracking</th>
                <th style={headBaseStyle}>Statut</th>
                <th style={headBaseStyle}>Destinataire</th>
                <th style={headBaseStyle}>Wilaya</th>
                <th style={headBaseStyle}>Livraison</th>
                <th style={{ ...headBaseStyle, textAlign: "right" }}>COD</th>
                <th style={{ ...headBaseStyle, textAlign: "right" }}>Frais</th>
                <th style={{ ...headBaseStyle, textAlign: "right" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {/* Loading */}
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 56, textAlign: "center" }}>
                    <Loader2 size={24} color={t.textMuted} style={{ animation: "spin 0.8s linear infinite" }} />
                    <div style={{ marginTop: 10, fontSize: 13, color: t.textMuted }}>Chargement des colis…</div>
                  </td>
                </tr>
              ) : error ? (
                /* Error */
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: "center" }}>
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
              ) : packages.length === 0 ? (
                /* Empty */
                <tr>
                  <td colSpan={8} style={{ padding: 56, textAlign: "center" }}>
                    <PackageOpen size={34} color={t.textFaint} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>Aucun colis trouvé</div>
                    <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>
                      {hasFilters ? "Essayez de modifier vos filtres ou votre recherche." : "Cet expéditeur n'a encore créé aucun colis."}
                    </div>
                  </td>
                </tr>
              ) : (
                /* Rows */
                packages.map((p) => {
                  const wilayaName = p.recipient_wilaya?.name || `Wilaya ${p.recipient_wilaya_id}`;
                  const communeName = p.recipient_commune?.name || "";
                  const tracking = p.external_shipment?.external_tracking ?? p.tracking_number;
                  const isHome = p.delivery_type === "home_delivery";
                  return (
                    <tr
                      key={p.tracking_number}
                      style={{ borderBottom: `1px solid ${t.divider}`, transition: "background 0.12s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.rowHover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {/* Tracking */}
                      <td style={{ ...cellStyle, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: t.text, whiteSpace: "nowrap" }}>
                        {tracking}
                        {p.service_type === "echange" && (
                          <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 800, color: "#7c3aed", background: "rgba(139,92,246,0.1)", padding: "1px 5px", borderRadius: 4, fontFamily: "var(--font-jakarta, sans-serif)" }}>
                            ÉCHANGE
                          </span>
                        )}
                      </td>

                      {/* Statut */}
                      <td style={cellStyle}><StatusBadge status={p.status} /></td>

                      {/* Destinataire */}
                      <td style={{ ...cellStyle, maxWidth: 180 }}>
                        <div style={{ fontWeight: 600, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.recipient_name || "—"}
                        </div>
                        <div style={{ fontSize: 11.5, color: t.textMuted, fontFamily: "monospace" }}>{p.recipient_phone || "—"}</div>
                      </td>

                      {/* Wilaya */}
                      <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                        <div style={{ color: t.text, fontWeight: 500 }}>{wilayaName}</div>
                        {communeName && <div style={{ fontSize: 11, color: t.textMuted }}>{communeName}</div>}
                      </td>

                      {/* Type livraison */}
                      <td style={cellStyle}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                          background: isHome ? "rgba(249,115,22,0.1)" : "rgba(99,102,241,0.1)",
                          color: isHome ? "#ea580c" : "#4f46e5",
                        }}>
                          {isHome ? <Home size={11} /> : <Building2 size={11} />}
                          {isHome ? "Domicile" : "Bureau"}
                        </span>
                      </td>

                      {/* COD */}
                      <td style={{ ...cellStyle, textAlign: "right", fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>
                        {formatDA(p.cod_amount)}
                      </td>

                      {/* Frais */}
                      <td style={{ ...cellStyle, textAlign: "right", color: t.textMuted, whiteSpace: "nowrap" }}>
                        {formatDA(p.shipping_cost)}
                      </td>

                      {/* Date */}
                      <td style={{ ...cellStyle, textAlign: "right", color: t.textMuted, whiteSpace: "nowrap" }}>
                        {fmtDate(p.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && !error && packages.length > 0 && lastPage > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "11px 16px", borderTop: `1px solid ${t.divider}`, gap: 12, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 12.5, color: t.textMuted }}>
              Page {page} / {lastPage} · {total.toLocaleString("fr-DZ")} colis
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px",
                  borderRadius: 8, border: `1px solid ${t.border}`, background: t.card,
                  color: page <= 1 ? t.textFaint : t.textSub, fontSize: 12.5, fontWeight: 600,
                  cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1,
                }}
              >
                <ChevronLeft size={14} /> Préc.
              </button>
              <button
                disabled={page >= lastPage}
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px",
                  borderRadius: 8, border: `1px solid ${t.border}`, background: t.card,
                  color: page >= lastPage ? t.textFaint : t.textSub, fontSize: 12.5, fontWeight: 600,
                  cursor: page >= lastPage ? "not-allowed" : "pointer", opacity: page >= lastPage ? 0.5 : 1,
                }}
              >
                Suiv. <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
