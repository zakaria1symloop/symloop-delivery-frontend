"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes, Search, X, Loader2, RefreshCw, AlertCircle, PackageOpen,
  PackageCheck, PackageX, Layers, Coins, Hash, CircleDollarSign,
} from "lucide-react";
import { ORANGE, formatDA } from "../../../_ui";
import { getExpProducts, type Product, type ProductSummary } from "@/lib/expediteur-admin";
import type { ExpTabProps } from "./types";

/* ── Config ─────────────────────────────────────────────────── */
/** Below this on-hand quantity an active product is flagged "stock faible". */
const LOW_STOCK_THRESHOLD = 5;

/* ── Derived product state ──────────────────────────────────────
 * Package STATUS_LABELS/STATUS_COLORS (lib/packages.ts) describe colis
 * lifecycle — not applicable to catalogue items. A product's commercial
 * state is derived from is_active + on-hand stock instead. */
type ProductState = "active" | "low" | "out" | "inactive";

const STATE_META: Record<ProductState, { label: string; bg: string; text: string; dot: string }> = {
  active:   { label: "Actif",       bg: "rgba(34,197,94,0.1)",  text: "#16a34a", dot: "#22c55e" },
  low:      { label: "Stock faible", bg: "rgba(245,158,11,0.1)", text: "#d97706", dot: "#f59e0b" },
  out:      { label: "Rupture",     bg: "rgba(239,68,68,0.1)",  text: "#dc2626", dot: "#ef4444" },
  inactive: { label: "Inactif",     bg: "rgba(107,114,128,0.1)", text: "#4b5563", dot: "#9ca3af" },
};

function productState(p: Product): ProductState {
  if (!p.is_active) return "inactive";
  if (p.stock <= 0) return "out";
  if (p.stock <= LOW_STOCK_THRESHOLD) return "low";
  return "active";
}

/* ── Status badge ───────────────────────────────────────────── */
function StateBadge({ state }: { state: ProductState }) {
  const m = STATE_META[state];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 9999,
      background: m.bg, color: m.text,
      fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  PRODUITS TAB                                                   */
/* ═══════════════════════════════════════════════════════════════ */
export default function Produits({ userId, user, t }: ExpTabProps) {
  /* ── Data ── */
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<ProductSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Filters ── */
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
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

    getExpProducts(userId, searchDebounced || undefined)
      .then((res) => {
        if (!alive) return;
        if (res.success && res.data) {
          setProducts(res.data.products || []);
          setSummary(res.data.summary || null);
        } else {
          setError(res.message || "Impossible de charger le catalogue de cet expéditeur.");
          setProducts([]);
          setSummary(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Une erreur est survenue lors du chargement des produits.");
        setProducts([]);
        setSummary(null);
        setLoading(false);
      });

    return () => { alive = false; };
  }, [userId, searchDebounced, reloadKey]);

  const hasSearch = searchDebounced !== "";
  /* Catalogue is "empty at source" when nothing comes back AND no filter is
   * narrowing it — i.e. this merchant owns no products (module may be off). */
  const catalogueEmpty = !loading && !error && products.length === 0 && !hasSearch;

  /* ── Summary cards (fallback to client-side aggregation if absent) ── */
  const cards = useMemo(() => {
    const s: ProductSummary = summary ?? {
      total_products: products.length,
      in_stock: products.filter((p) => p.stock > 0).length,
      out_of_stock: products.filter((p) => p.stock <= 0).length,
      total_units: products.reduce((a, p) => a + (p.stock || 0), 0),
      stock_value: products.reduce((a, p) => a + (p.stock || 0) * (p.price || 0), 0),
    };
    return [
      { icon: Boxes,             label: "Produits",     value: s.total_products.toLocaleString("fr-DZ"), color: ORANGE },
      { icon: PackageCheck,      label: "En stock",     value: s.in_stock.toLocaleString("fr-DZ"),       color: "#16a34a" },
      { icon: PackageX,          label: "En rupture",   value: s.out_of_stock.toLocaleString("fr-DZ"),   color: "#ef4444" },
      { icon: Layers,            label: "Unités",       value: s.total_units.toLocaleString("fr-DZ"),    color: "#0ea5e9" },
      { icon: Coins,             label: "Valeur stock", value: formatDA(s.stock_value),                  color: "#a855f7" },
    ];
  }, [summary, products]);

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
            <Boxes size={18} color={ORANGE} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: t.text, letterSpacing: -0.3 }}>Produits</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>
              {loading ? "Chargement…" : error ? "Erreur de chargement" : (
                <>
                  {products.length.toLocaleString("fr-DZ")} produit{products.length > 1 ? "s" : ""}
                  {hasSearch ? " correspondant à la recherche" : ` au catalogue de ${user.first_name}`}
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

      {/* ── Summary KPI strip (hidden while the catalogue is empty at source) ── */}
      {!catalogueEmpty && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10,
        }}>
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} style={{
                background: t.sectionBg, border: `1px solid ${t.border}`, borderRadius: 12,
                padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon size={13} color={c.color} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.label}</span>
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, color: t.text }}>
                  {loading ? "—" : c.value}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Search (hidden once we know there's nothing to filter) ── */}
      {!catalogueEmpty && (
        <div style={{ position: "relative", maxWidth: 420 }}>
          <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou référence (SKU)…"
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
      )}

      {/* ── Catalogue empty at source — explanatory state ── */}
      {catalogueEmpty ? (
        <div style={{
          background: t.card, border: `1px dashed ${t.border}`, borderRadius: 14,
          boxShadow: t.shadow, padding: "44px 28px", textAlign: "center",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: "0 auto 14px",
            background: ORANGE + "12", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <PackageOpen size={26} color={ORANGE} />
          </div>
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 750, color: t.text }}>
            Aucun produit au catalogue
          </h3>
          <p style={{ margin: "8px auto 0", fontSize: 13, color: t.textMuted, lineHeight: 1.65, maxWidth: 440 }}>
            {user.first_name} n'a enregistré aucun produit. Le catalogue produits est un
            module facultatif : un expéditeur peut expédier des colis sans tenir
            d'inventaire. Les produits, leur prix et leur stock apparaîtront ici dès
            que ce module sera utilisé.
          </p>
        </div>
      ) : (
        /* ── Table card ── */
        <div style={{
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
          boxShadow: t.shadow, overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                  <th style={headBaseStyle}>Produit</th>
                  <th style={headBaseStyle}>Référence</th>
                  <th style={{ ...headBaseStyle, textAlign: "right" }}>Prix</th>
                  <th style={{ ...headBaseStyle, textAlign: "right" }}>Stock</th>
                  <th style={{ ...headBaseStyle, textAlign: "right" }}>Valeur stock</th>
                  <th style={headBaseStyle}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {/* Loading */}
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 56, textAlign: "center" }}>
                      <Loader2 size={24} color={t.textMuted} style={{ animation: "spin 0.8s linear infinite" }} />
                      <div style={{ marginTop: 10, fontSize: 13, color: t.textMuted }}>Chargement des produits…</div>
                    </td>
                  </tr>
                ) : error ? (
                  /* Error */
                  <tr>
                    <td colSpan={6} style={{ padding: 48, textAlign: "center" }}>
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
                ) : products.length === 0 ? (
                  /* Empty after filtering */
                  <tr>
                    <td colSpan={6} style={{ padding: 56, textAlign: "center" }}>
                      <PackageOpen size={34} color={t.textFaint} style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>Aucun produit trouvé</div>
                      <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>
                        Aucun produit ne correspond à « {searchDebounced} ».
                      </div>
                    </td>
                  </tr>
                ) : (
                  /* Rows */
                  products.map((p) => {
                    const state = productState(p);
                    const lineValue = (p.stock || 0) * (p.price || 0);
                    return (
                      <tr
                        key={p.id}
                        style={{ borderBottom: `1px solid ${t.divider}`, transition: "background 0.12s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.rowHover; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        {/* Produit (nom + description) */}
                        <td style={{ ...cellStyle, maxWidth: 280 }}>
                          <div style={{ fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}
                          </div>
                          {p.description && (
                            <div style={{ fontSize: 11.5, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.description}
                            </div>
                          )}
                        </td>

                        {/* Référence (SKU) */}
                        <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                          {p.sku ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: t.textSub }}>
                              <Hash size={11} color={t.textFaint} />{p.sku}
                            </span>
                          ) : (
                            <span style={{ color: t.textFaint }}>—</span>
                          )}
                        </td>

                        {/* Prix */}
                        <td style={{ ...cellStyle, textAlign: "right", fontWeight: 700, color: t.text, whiteSpace: "nowrap" }}>
                          {formatDA(p.price)}
                        </td>

                        {/* Stock */}
                        <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <span style={{
                            fontWeight: 700,
                            color: state === "out" ? "#dc2626" : state === "low" ? "#d97706" : t.text,
                          }}>
                            {(p.stock || 0).toLocaleString("fr-DZ")}
                          </span>
                          <span style={{ fontSize: 11, color: t.textMuted }}> u.</span>
                        </td>

                        {/* Valeur stock (prix × stock) */}
                        <td style={{ ...cellStyle, textAlign: "right", color: t.textMuted, whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <CircleDollarSign size={12} color={t.textFaint} />
                            {formatDA(lineValue)}
                          </span>
                        </td>

                        {/* Statut */}
                        <td style={cellStyle}><StateBadge state={state} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Footer count ── */}
          {!loading && !error && products.length > 0 && (
            <div style={{
              padding: "11px 16px", borderTop: `1px solid ${t.divider}`,
              fontSize: 12.5, color: t.textMuted,
            }}>
              {products.length.toLocaleString("fr-DZ")} produit{products.length > 1 ? "s" : ""} affiché{products.length > 1 ? "s" : ""}
              {hasSearch ? ` pour « ${searchDebounced} »` : ""}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
