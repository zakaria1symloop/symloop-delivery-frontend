"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet, Truck, AlertTriangle, Banknote,
  RefreshCw, Loader2, ChevronLeft, ChevronRight,
  Package as PackageIcon, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import {
  getExpWallet, getExpWalletTransactions,
  type WalletData, type WalletTransaction,
} from "@/lib/expediteur";

/* ── Theme ─────────────────────────────────────────────── */

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
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130", rowHover: "#1a1f2e",
    text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280", textFaint: "#4b5563",
    shadow: "none", inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── Helpers ───────────────────────────────────────────── */

function formatDA(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString("fr-DZ") + " DA";
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-DZ", {
    day: "2-digit", month: "short", year: "numeric",
  }) + " " + d.toLocaleTimeString("fr-DZ", {
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── Transaction type config ───────────────────────────── */

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  cod_credit:      { label: "COD",     color: "#16a34a", bg: "rgba(34,197,94,0.1)" },
  shipping_debit:  { label: "Frais",   color: "#ea580c", bg: "rgba(249,115,22,0.1)" },
  return_debit:    { label: "Retour",  color: "#dc2626", bg: "rgba(239,68,68,0.1)" },
  cash_withdrawal: { label: "Retrait", color: "#7c3aed", bg: "rgba(139,92,246,0.1)" },
};

function getTypeDisplay(type: string) {
  return TYPE_CONFIG[type] || { label: type, color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
}

/* ── Filter Chips ──────────────────────────────────────── */

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "",                label: "Tout" },
  { value: "cod_credit",     label: "COD" },
  { value: "shipping_debit", label: "Frais" },
  { value: "return_debit",   label: "Retour" },
  { value: "cash_withdrawal",label: "Retrait" },
];

function FilterChips({
  active, onChange, t,
}: {
  active: string; onChange: (v: string) => void; t: Tokens;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {FILTER_OPTIONS.map(opt => {
        const isActive = active === opt.value;
        const typeDisp = opt.value ? getTypeDisplay(opt.value) : null;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "6px 14px", borderRadius: 20,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: `1px solid ${isActive ? (typeDisp?.color || "#f97316") + "50" : t.border}`,
              background: isActive ? (typeDisp?.bg || "rgba(249,115,22,0.1)") : "transparent",
              color: isActive ? (typeDisp?.color || "#f97316") : t.textMuted,
              transition: "all 0.15s",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Balance Card ──────────────────────────────────────── */

function BalanceCard({
  label, value, icon: Icon, accent, t, large,
}: {
  label: string; value: string;
  icon: React.ElementType; accent: string;
  t: Tokens; large?: boolean;
}) {
  return (
    <div style={{
      flex: large ? "1.4 1 200px" : "1 1 160px",
      minWidth: 160,
      background: t.card, border: `1px solid ${t.border}`,
      borderRadius: 14, padding: large ? "22px 24px" : "18px 20px",
      boxShadow: t.shadow, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: accent,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: large ? 42 : 36, height: large ? 42 : 36, borderRadius: 10,
          background: accent + "14",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={large ? 20 : 18} color={accent} />
        </div>
        <span style={{
          fontSize: 12, fontWeight: 500, color: t.textMuted,
          letterSpacing: 0.3,
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: large ? 26 : 20, fontWeight: 750,
        color: t.text, letterSpacing: -0.4,
      }}>
        {value}
      </div>
    </div>
  );
}

/* ── Pagination ────────────────────────────────────────── */

function Pagination({
  page, lastPage, onPage, t,
}: {
  page: number; lastPage: number; onPage: (p: number) => void; t: Tokens;
}) {
  if (lastPage <= 1) return null;

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= lastPage; i++) {
    if (i === 1 || i === lastPage || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 4, padding: "16px 24px",
    }}>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        style={{
          width: 32, height: 32, borderRadius: 8,
          border: `1px solid ${t.border}`, background: "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: page <= 1 ? "not-allowed" : "pointer",
          opacity: page <= 1 ? 0.3 : 1, color: t.textSub,
          transition: "all 0.15s",
        }}
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`e${i}`} style={{
            width: 32, height: 32, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 12, color: t.textFaint,
          }}>
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p as number)}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: `1px solid ${p === page ? "#f97316" : t.border}`,
              background: p === page ? "rgba(249,115,22,0.1)" : "transparent",
              color: p === page ? "#f97316" : t.textSub,
              fontSize: 12, fontWeight: p === page ? 700 : 500,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= lastPage}
        style={{
          width: 32, height: 32, borderRadius: 8,
          border: `1px solid ${t.border}`, background: "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: page >= lastPage ? "not-allowed" : "pointer",
          opacity: page >= lastPage ? 0.3 : 1, color: t.textSub,
          transition: "all 0.15s",
        }}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────── */

export default function WalletPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [txnLoading, setTxnLoading] = useState(false);
  const [error, setError] = useState("");

  /* ── Load wallet summary ── */
  const loadWallet = useCallback(async () => {
    try {
      const res = await getExpWallet();
      if (res.success && res.data) setWallet(res.data);
    } catch { /* ignore */ }
  }, []);

  /* ── Load transactions ── */
  const loadTransactions = useCallback(async (p: number, type: string) => {
    setTxnLoading(true);
    try {
      const res = await getExpWalletTransactions({
        page: p,
        type: type || undefined,
        per_page: 15,
      });
      if (res.success && res.data) {
        setTransactions(res.data.data || []);
        setPage(res.data.current_page || 1);
        setLastPage(res.data.last_page || 1);
      }
    } catch { /* ignore */ }
    setTxnLoading(false);
  }, []);

  /* ── Initial load ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        await Promise.all([loadWallet(), loadTransactions(1, "")]);
      } catch {
        setError("Erreur de connexion");
      }
      setLoading(false);
    })();
  }, [loadWallet, loadTransactions]);

  /* ── Filter change ── */
  function handleFilterChange(type: string) {
    setTypeFilter(type);
    setPage(1);
    loadTransactions(1, type);
  }

  /* ── Page change ── */
  function handlePageChange(p: number) {
    setPage(p);
    loadTransactions(p, typeFilter);
  }

  /* ── Refresh ── */
  async function handleRefresh() {
    setLoading(true);
    await Promise.all([loadWallet(), loadTransactions(page, typeFilter)]);
    setLoading(false);
  }

  /* ── Loading state ── */
  if (loading && !wallet) {
    return (
      <div style={{
        fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))",
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 400, color: t.textMuted,
      }}>
        <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h1 style={{
            fontSize: 24, fontWeight: 750, color: t.text,
            margin: 0, letterSpacing: -0.5,
          }}>
            Mon Portefeuille
          </h1>
          <p style={{ fontSize: 13, color: t.textMuted, margin: "4px 0 0" }}>
            Historique des mouvements financiers
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            background: t.card, border: `1px solid ${t.border}`,
            color: t.textSub, fontSize: 13, fontWeight: 550,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1, transition: "all 0.15s",
          }}
        >
          <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          Actualiser
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 20,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#ef4444", fontSize: 13, fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {/* ── Balance Cards ── */}
      {wallet && (
        <div style={{
          display: "flex", gap: 14, marginBottom: 28, flexWrap: "wrap",
        }}>
          <BalanceCard
            label="Disponible" value={formatDA(wallet.libere)}
            icon={Wallet} accent="#22c55e" t={t} large
          />
          <BalanceCard
            label="En Transit" value={formatDA(wallet.en_transit)}
            icon={Truck} accent="#3b82f6" t={t}
          />
          <BalanceCard
            label="Dettes" value={formatDA(wallet.dettes)}
            icon={AlertTriangle} accent="#ef4444" t={t}
          />
          <BalanceCard
            label="Total Retir&eacute;" value={formatDA(wallet.total_withdrawals)}
            icon={Banknote} accent="#6b7280" t={t}
          />
        </div>
      )}

      {/* ── Transactions Section ── */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 14, boxShadow: t.shadow, overflow: "hidden",
      }}>
        {/* ── Filters ── */}
        <div style={{
          padding: "18px 24px",
          borderBottom: `1px solid ${t.divider}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: t.text }}>
            Transactions
          </div>
          <FilterChips active={typeFilter} onChange={handleFilterChange} t={t} />
        </div>

        {/* ── Table ── */}
        <div style={{ overflowX: "auto", position: "relative" }}>
          {txnLoading && (
            <div style={{
              position: "absolute", inset: 0,
              background: isDark ? "rgba(17,24,39,0.6)" : "rgba(255,255,255,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 2, backdropFilter: "blur(1px)",
            }}>
              <Loader2 size={20} color={t.textMuted} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          )}
          <table style={{
            width: "100%", borderCollapse: "collapse", fontSize: 13,
          }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                {["Date", "Type", "Description", "Montant", "Solde Apr\u00e8s"].map(h => (
                  <th key={h} style={{
                    padding: "10px 16px", textAlign: "left",
                    fontSize: 11, fontWeight: 600, color: t.textMuted,
                    textTransform: "uppercase", letterSpacing: 0.5,
                    whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => {
                const typeDisp = getTypeDisplay(txn.type);
                const isCredit = txn.direction === "in";
                return (
                  <tr
                    key={txn.id}
                    style={{
                      borderBottom: `1px solid ${t.divider}`,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{
                      padding: "12px 16px", color: t.textMuted,
                      fontSize: 12, whiteSpace: "nowrap",
                    }}>
                      {fmtDateTime(txn.created_at)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 20,
                        background: typeDisp.bg, fontSize: 11,
                        fontWeight: 600, color: typeDisp.color,
                        whiteSpace: "nowrap",
                      }}>
                        {isCredit
                          ? <ArrowDownLeft size={11} />
                          : <ArrowUpRight size={11} />
                        }
                        {typeDisp.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: t.textSub, maxWidth: 280 }}>
                      <div style={{
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {txn.description || "-"}
                      </div>
                      {txn.package?.tracking_number && (
                        <div style={{
                          fontSize: 11, color: "#f97316", fontFamily: "monospace",
                          marginTop: 2, display: "flex", alignItems: "center", gap: 4,
                        }}>
                          <PackageIcon size={10} />
                          {txn.package.tracking_number}
                        </div>
                      )}
                    </td>
                    <td style={{
                      padding: "12px 16px", fontWeight: 650,
                      color: isCredit ? "#16a34a" : "#ef4444",
                      whiteSpace: "nowrap", fontSize: 13,
                    }}>
                      {isCredit ? "+" : "-"}{formatDA(txn.amount)}
                    </td>
                    <td style={{
                      padding: "12px 16px", color: t.textMuted,
                      fontWeight: 500, whiteSpace: "nowrap", fontSize: 12,
                    }}>
                      {formatDA(txn.balance_after)}
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && !txnLoading && (
                <tr>
                  <td colSpan={5} style={{
                    padding: 48, textAlign: "center",
                    color: t.textMuted, fontSize: 13,
                  }}>
                    <Wallet size={28} color={t.textFaint} style={{ margin: "0 auto 8px" }} />
                    <div>Aucune transaction trouv&eacute;e</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        <div style={{ borderTop: `1px solid ${t.divider}` }}>
          <Pagination page={page} lastPage={lastPage} onPage={handlePageChange} t={t} />
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
