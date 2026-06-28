"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Truck, Banknote, Coins, AlertTriangle, Receipt,
  ArrowDownLeft, ArrowUpRight, Package as PackageIcon,
  Loader2, AlertCircle, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import { ORANGE, formatDA, type Tokens } from "../../../_ui";
import { getExpWallet, type ExpAdminWallet } from "@/lib/expediteur-admin";
import { getWalletTransactions, type WalletTransaction } from "@/lib/wallet";
import type { ExpTabProps } from "./types";

/* ── Wallet transaction type config (labels + colors + direction icon) ──────────
   Wallet movements use their OWN taxonomy (cod_credit / shipping_debit / …) —
   NOT the package STATUS_LABELS/STATUS_COLORS taxonomy, which describes a colis'
   delivery state and is irrelevant to a financial ledger row. We keep this map in
   sync with the merchant self-service wallet (src/app/dashboard/expediteur/wallet). */
const TXN_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  cod_credit:      { label: "COD livré",       color: "#16a34a", bg: "rgba(34,197,94,0.12)" },
  shipping_debit:  { label: "Frais livraison", color: "#ea580c", bg: "rgba(249,115,22,0.12)" },
  return_debit:    { label: "Frais retour",    color: "#dc2626", bg: "rgba(239,68,68,0.12)" },
  cash_withdrawal: { label: "Retrait espèces", color: "#7c3aed", bg: "rgba(139,92,246,0.12)" },
  cash_deposit:    { label: "Dépôt espèces",   color: "#2563eb", bg: "rgba(59,130,246,0.12)" },
  adjustment:      { label: "Ajustement",      color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

function txnDisplay(type: string) {
  return TXN_TYPES[type] ?? { label: type, color: "#6b7280", bg: "rgba(107,114,128,0.12)" };
}

const FILTERS: { value: string; label: string }[] = [
  { value: "",                label: "Tout" },
  { value: "cod_credit",      label: "COD livré" },
  { value: "shipping_debit",  label: "Frais livraison" },
  { value: "return_debit",    label: "Frais retour" },
  { value: "cash_withdrawal", label: "Retrait" },
];

const PER_PAGE = 12;

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })
  );
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function Finances({ userId, t }: ExpTabProps) {
  const [wallet, setWallet] = useState<ExpAdminWallet | null>(null);
  const [txns, setTxns] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  /* ── Fetch (alive-guarded, keyed on userId) ── */
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([getExpWallet(userId), getWalletTransactions(userId)])
      .then(([wRes, txRes]) => {
        if (!alive) return;
        if (wRes.success && wRes.data) setWallet(wRes.data);
        else setError(wRes.message || "Impossible de charger le portefeuille de cet expéditeur.");
        setTxns(txRes.success && txRes.data ? txRes.data : []);
      })
      .catch(() => { if (alive) setError("Erreur de connexion au serveur."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    const [wRes, txRes] = await Promise.all([getExpWallet(userId), getWalletTransactions(userId)]);
    if (wRes.success && wRes.data) setWallet(wRes.data);
    if (txRes.success && txRes.data) setTxns(txRes.data);
    setRefreshing(false);
  }

  /* ── Derived: filter + paginate (client-side; the admin endpoint returns a
        plain array, so pagination is computed here) ── */
  const filtered = useMemo(
    () => (typeFilter ? txns.filter(tx => tx.type === typeFilter) : txns),
    [txns, typeFilter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const totalIn = useMemo(
    () => filtered.filter(tx => tx.direction === "in").reduce((s, tx) => s + Number(tx.amount), 0),
    [filtered],
  );
  const totalOut = useMemo(
    () => filtered.filter(tx => tx.direction === "out").reduce((s, tx) => s + Number(tx.amount), 0),
    [filtered],
  );

  function selectFilter(v: string) { setTypeFilter(v); setPage(1); }

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ ...cardBase(t), padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 80, color: t.textMuted, fontSize: 14 }}>
          <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> Chargement des finances…
        </div>
        <SpinKeyframes />
      </div>
    );
  }

  /* ── Error ── */
  if (error || !wallet) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 24px", borderRadius: 14, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
        <AlertCircle size={18} /> {error || "Portefeuille introuvable."}
      </div>
    );
  }

  const soldeColor = wallet.balance < 0 ? "#ef4444" : "#16a34a";
  const dettesColor = wallet.dettes > 0 ? "#ef4444" : "#6b7280";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Wallet summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <SummaryCard t={t} icon={Wallet}        label="Solde"      value={formatDA(wallet.balance)}            accent={soldeColor}
          note={wallet.balance < 0 ? "L'expéditeur nous doit" : "Solde du portefeuille"} />
        <SummaryCard t={t} icon={Truck}         label="En transit" value={formatDA(wallet.en_transit)}         accent="#3b82f6"
          note="COD non encore livré" />
        <SummaryCard t={t} icon={Banknote}      label="Libéré"     value={formatDA(wallet.libere)}             accent="#16a34a"
          note="Disponible au paiement" />
        <SummaryCard t={t} icon={AlertTriangle} label="Dettes"     value={formatDA(wallet.dettes)}             accent={dettesColor}
          note="Frais livraison + retour" />
        <SummaryCard t={t} icon={Coins}         label="COD collecté" value={formatDA(wallet.total_cod_credited)} accent="#a855f7"
          note="Total crédité" />
      </div>

      {/* ── Secondary breakdown strip ── */}
      <div style={{ ...cardBase(t), padding: 0, display: "flex", flexWrap: "wrap" }}>
        <Stat t={t} label="Frais de livraison" value={formatDA(wallet.total_shipping)}     color="#ea580c" />
        <Stat t={t} label="Frais de retour"    value={formatDA(wallet.total_return_cost)}  color="#dc2626" />
        <Stat t={t} label="Total retiré"       value={formatDA(wallet.total_withdrawals)}  color="#7c3aed" last />
      </div>

      {/* ── Relevé / transactions ── */}
      <div style={{ ...cardBase(t), padding: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${t.divider}`, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: ORANGE + "16", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Receipt size={16} color={ORANGE} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 750, color: t.text, letterSpacing: -0.3 }}>Relevé des transactions</h2>
              <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>
                {filtered.length} mouvement{filtered.length !== 1 ? "s" : ""}
                {filtered.length !== txns.length ? ` / ${txns.length}` : ""}
                {" · "}<span style={{ color: "#16a34a", fontWeight: 600 }}>+{formatDA(totalIn)}</span>
                {" · "}<span style={{ color: "#ef4444", fontWeight: 600 }}>-{formatDA(totalOut)}</span>
              </div>
            </div>
          </div>
          <button onClick={refresh} disabled={refreshing} style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9,
            background: "transparent", border: `1px solid ${t.border}`, color: t.textSub,
            fontSize: 12.5, fontWeight: 600, cursor: refreshing ? "default" : "pointer", opacity: refreshing ? 0.6 : 1,
          }}>
            <RefreshCw size={13} style={refreshing ? { animation: "spin 0.8s linear infinite" } : undefined} /> Actualiser
          </button>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 20px", borderBottom: `1px solid ${t.divider}` }}>
          {FILTERS.map(opt => {
            const active = typeFilter === opt.value;
            const disp = opt.value ? txnDisplay(opt.value) : null;
            return (
              <button key={opt.value || "all"} onClick={() => selectFilter(opt.value)} style={{
                padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${active ? (disp?.color ?? ORANGE) + "55" : t.border}`,
                background: active ? (disp?.bg ?? ORANGE + "14") : "transparent",
                color: active ? (disp?.color ?? ORANGE) : t.textMuted,
                transition: "all 0.15s",
              }}>
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                {["Date", "Type", "Description", "Colis", "Montant", "Solde après"].map((h, i) => (
                  <th key={h} style={{
                    padding: "11px 16px", textAlign: i >= 4 ? "right" : "left",
                    fontSize: 10.5, fontWeight: 700, color: t.textMuted,
                    textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageItems.map(tx => {
                const disp = txnDisplay(tx.type);
                const isIn = tx.direction === "in";
                return (
                  <tr key={tx.id}
                    style={{ borderBottom: `1px solid ${t.divider}`, transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "12px 16px", color: t.textMuted, fontSize: 12, whiteSpace: "nowrap" }}>
                      {fmtDateTime(tx.created_at)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20,
                        background: disp.bg, color: disp.color, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                      }}>
                        {isIn ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />} {disp.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: t.textSub, maxWidth: 280 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tx.description || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      {tx.package?.tracking_number ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontFamily: "monospace", color: ORANGE, fontWeight: 600 }}>
                          <PackageIcon size={11} /> {tx.package.tracking_number}
                        </span>
                      ) : (
                        <span style={{ color: t.textFaint }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", color: isIn ? "#16a34a" : "#ef4444" }}>
                      {isIn ? "+" : "-"}{formatDA(tx.amount)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: t.textMuted, fontWeight: 500, fontSize: 12, whiteSpace: "nowrap" }}>
                      {formatDA(tx.balance_after)}
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 56, textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                    <Wallet size={30} color={t.textFaint} style={{ display: "block", margin: "0 auto 10px" }} />
                    {typeFilter ? "Aucune transaction pour ce filtre." : "Aucune transaction enregistrée."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 20px", borderTop: `1px solid ${t.divider}`, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: t.textMuted }}>
              Page {safePage} / {pageCount}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <PagerBtn t={t} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                <ChevronLeft size={15} /> Précédent
              </PagerBtn>
              <PagerBtn t={t} disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
                Suivant <ChevronRight size={15} />
              </PagerBtn>
            </div>
          </div>
        )}
      </div>

      <SpinKeyframes />
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────────── */

function cardBase(t: Tokens): React.CSSProperties {
  return { background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow };
}

function SummaryCard({ t, icon: Icon, label, value, accent, note }: {
  t: Tokens; icon: React.ElementType; label: string; value: string; accent: string; note?: string;
}) {
  return (
    <div style={{ ...cardBase(t), position: "relative", overflow: "hidden", padding: "16px 18px" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: accent + "1f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={17} color={accent} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, color: t.text, letterSpacing: -0.4 }}>{value}</div>
      {note && <div style={{ fontSize: 10.5, color: t.textFaint, marginTop: 4 }}>{note}</div>}
    </div>
  );
}

function Stat({ t, label, value, color, last }: {
  t: Tokens; label: string; value: string; color: string; last?: boolean;
}) {
  return (
    <div style={{ flex: "1 1 160px", minWidth: 140, padding: "14px 18px", borderRight: last ? "none" : `1px solid ${t.divider}` }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function PagerBtn({ t, disabled, onClick, children }: {
  t: Tokens; disabled: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "7px 12px", borderRadius: 9,
      border: `1px solid ${t.border}`, background: "transparent", color: t.textSub,
      fontSize: 12.5, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
    }}>
      {children}
    </button>
  );
}

function SpinKeyframes() {
  return <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>;
}
