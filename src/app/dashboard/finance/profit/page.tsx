"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { TrendingUp, Loader2, Package as PackageIcon, ArrowRight, Banknote } from "lucide-react";
import { api, getStoredUser } from "@/lib/api";

function useIsDark() {
  const [dark, setDark] = useState(() => typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false);
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
    inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

function formatDA(n: number | string) { return Number(n).toLocaleString("fr-DZ") + " DA"; }

type Row = {
  id: number;
  tracking_number: string;
  delivered_at: string;
  cod_amount: number;
  shipping_cost: number;
  origin_sd: string | null;
  destination_sd: string | null;
  role: "origin" | "destination" | "both";
  origin_margin: number;
  destination_margin: number;
  earned: number;
};

export default function SdProfitPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const user = getStoredUser();
  const isAdmin = user?.user_type === "admin";
  const mySdId = user?.stop_desk_id ?? null;

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
  const monthStart = today.substring(0, 8) + "01";
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  // Admin can pick a SD; non-admin is locked to their SD
  const [sdList, setSdList] = useState<{ id: number; name: string }[]>([]);
  const [sdId, setSdId] = useState<number | null>(mySdId);

  const [rows, setRows] = useState<Row[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Admin: load SD list to pick from
  useEffect(() => {
    if (!isAdmin) return;
    api<any[]>("/sd-config").then(res => {
      if ((res as any).success && (res as any).data) {
        const list = (res as any).data.filter((s: any) => s.has_caisse).map((s: any) => ({ id: s.id, name: s.name }));
        setSdList(list);
        if (!sdId && list.length > 0) setSdId(list[0].id);
      }
    });
  }, [isAdmin]);

  const load = useCallback(async () => {
    if (!sdId) return;
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set("stop_desk_id", String(sdId));
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo)   qs.set("date_to", dateTo);
    const res = await api<any>(`/sd-profit?${qs.toString()}`);
    if ((res as any).success && (res as any).data) {
      const d = (res as any).data;
      setRows(d.packages);
      setTotalEarned(d.total_earned);
      setTotalPaid(d.total_paid);
      setCount(d.count);
    }
    setLoading(false);
  }, [sdId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const pending = Math.max(0, totalEarned - totalPaid);

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg, fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(22,163,74,0.1)", border: "1px solid rgba(22,163,74,0.2)",
        }}>
          <TrendingUp size={20} style={{ color: "#16a34a" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Profit par Colis</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Marge gagnée sur chaque colis livré</p>
        </div>
      </div>

      {/* Filters — top of page */}
      <div style={{
        background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
        padding: "14px 20px", marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
      }}>
        {[
          { label: "Aujourd'hui", from: today, to: today },
          { label: "7 jours", from: weekAgo, to: today },
          { label: "Ce mois", from: monthStart, to: today },
          { label: "Tout", from: "", to: "" },
        ].map(q => {
          const active = dateFrom === q.from && dateTo === q.to;
          return (
            <button key={q.label} onClick={() => { setDateFrom(q.from); setDateTo(q.to); }} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
              border: `1.5px solid ${active ? "#16a34a" : t.border}`,
              background: active ? "rgba(22,163,74,0.1)" : "transparent",
              color: active ? "#16a34a" : t.textMuted, cursor: "pointer",
            }}>{q.label}</button>
          );
        })}
        <div style={{ width: 1, height: 18, background: t.border }} />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 11 }} />
        <span style={{ fontSize: 11, color: t.textFaint }}>→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text, fontSize: 11 }} />
        {isAdmin && sdList.length > 0 && (
          <>
            <div style={{ width: 1, height: 18, background: t.border }} />
            <select value={sdId ?? ""} onChange={e => setSdId(Number(e.target.value))} style={{
              padding: "5px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
              background: t.inp.bg, color: t.inp.text, fontSize: 11, cursor: "pointer",
            }}>
              {sdList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
        <div style={{ padding: "16px 18px", borderRadius: 14, background: "linear-gradient(135deg, rgba(22,163,74,0.08), rgba(22,163,74,0.02))", border: "1.5px solid rgba(22,163,74,0.25)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", marginBottom: 4 }}>Profit gagné</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#16a34a" }}>{formatDA(totalEarned)}</div>
          <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>{count} colis livrés</div>
        </div>
        <div style={{ padding: "16px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Déjà encaissé</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.textSub }}>{formatDA(totalPaid)}</div>
          <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>Lifetime (toutes dates)</div>
        </div>
        <div style={{ padding: "16px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>À encaisser</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: pending > 0 ? "#f97316" : t.textMuted }}>{formatDA(pending)}</div>
          <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>Solde non-encaissé</div>
        </div>
        <div style={{ padding: "16px 18px", borderRadius: 14, background: t.card, border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Moyenne / colis</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{formatDA(count > 0 ? totalEarned / count : 0)}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, overflow: "hidden" }}>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
          <PackageIcon size={13} color={t.textMuted} />
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Colis livrés</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "rgba(22,163,74,0.1)", padding: "1px 7px", borderRadius: 20 }}>
            {count}
          </span>
        </div>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <Loader2 size={18} color="#16a34a" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: t.textMuted, fontSize: 13 }}>
            Aucun colis livré dans cette période
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: t.rowHover }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Date</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Tracking</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Route</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Rôle</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>COD</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase" }}>Frais</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>Marge</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${t.divider}` }}>
                    <td style={{ padding: "10px 14px", color: t.textMuted, fontSize: 11 }}>
                      {r.delivered_at ? new Date(r.delivered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px", color: t.text, fontWeight: 600, fontFamily: "monospace" }}>{r.tracking_number}</td>
                    <td style={{ padding: "10px 14px", color: t.textSub, fontSize: 11 }}>
                      <span>{r.origin_sd ?? "—"}</span>
                      <ArrowRight size={10} style={{ margin: "0 4px", verticalAlign: "middle", color: t.textFaint }} />
                      <span>{r.destination_sd ?? "—"}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {r.role === "both" ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#8b5cf6", background: "rgba(139,92,246,0.1)", padding: "2px 8px", borderRadius: 99 }}>Origine + Destination</span>
                      ) : r.role === "origin" ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#3b82f6", background: "rgba(59,130,246,0.1)", padding: "2px 8px", borderRadius: 99 }}>Origine</span>
                      ) : (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#f97316", background: "rgba(249,115,22,0.1)", padding: "2px 8px", borderRadius: 99 }}>Destination</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: t.textSub, fontVariantNumeric: "tabular-nums" }}>{formatDA(r.cod_amount)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: t.textSub, fontVariantNumeric: "tabular-nums" }}>{formatDA(r.shipping_cost)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#16a34a", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                      {formatDA(r.earned)}
                      {r.role === "both" && (
                        <div style={{ fontSize: 9, color: t.textFaint, fontWeight: 500 }}>
                          O:{formatDA(r.origin_margin)} + D:{formatDA(r.destination_margin)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: t.rowHover, borderTop: `2px solid ${t.border}` }}>
                  <td colSpan={6} style={{ padding: "12px 14px", fontWeight: 700, color: t.text, fontSize: 12 }}>Total</td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: "#16a34a", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{formatDA(totalEarned)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
