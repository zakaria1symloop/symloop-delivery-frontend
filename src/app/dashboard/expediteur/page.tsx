"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Wallet, TrendingUp, Truck, RotateCcw, Receipt,
  Plus, Upload, Package, RefreshCw, Loader2,
  MapPin, ChevronRight, Eye,
} from "lucide-react";
import { getStoredUser } from "@/lib/api";
import { getExpDashboard, type DashboardData } from "@/lib/expediteur";
import {
  STATUS_LABELS, STATUS_COLORS,
  type PackageStatus, type Package as Pkg,
} from "@/lib/packages";

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

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-DZ", { day: "2-digit", month: "short" });
}

function dayName(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
}

/* ── KPI Card ──────────────────────────────────────────── */

function KpiCard({
  label, value, icon: Icon, accent, t,
}: {
  label: string; value: string;
  icon: React.ElementType; accent: string; t: Tokens;
}) {
  return (
    <div style={{
      flex: "1 1 0", minWidth: 150,
      background: t.card, border: `1px solid ${t.border}`,
      borderRadius: 12, padding: "18px 20px",
      boxShadow: t.shadow, position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: accent,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: accent + "14", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={18} color={accent} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, letterSpacing: 0.3 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: -0.3 }}>
        {value}
      </div>
    </div>
  );
}

/* ── Quick Action Card ─────────────────────────────────── */

function ActionCard({
  label, description, icon: Icon, accent, href, t, router,
}: {
  label: string; description: string;
  icon: React.ElementType; accent: string;
  href: string; t: Tokens; router: ReturnType<typeof useRouter>;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => router.push(href)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flex: "1 1 0", minWidth: 180,
        background: hov ? (accent + "0c") : t.card,
        border: `1px solid ${hov ? accent + "40" : t.border}`,
        borderRadius: 14, padding: "24px 22px",
        boxShadow: t.shadow, cursor: "pointer",
        display: "flex", alignItems: "center", gap: 16,
        transition: "all 0.2s", textAlign: "left",
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: accent + "14",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={22} color={accent} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 650, color: t.text, marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          {description}
        </div>
      </div>
      <ChevronRight size={16} color={t.textFaint} style={{ marginLeft: "auto" }} />
    </button>
  );
}

/* ── Bar Chart (CSS) ───────────────────────────────────── */

function DeliveryChart({
  data, t,
}: {
  data: DashboardData["deliveries_by_day"]; t: Tokens;
}) {
  const maxVal = Math.max(...data.map(d => d.total), 1);

  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`,
      borderRadius: 14, padding: "22px 24px", boxShadow: t.shadow,
      flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 14, fontWeight: 650, color: t.text, marginBottom: 20 }}>
        Livraisons - 7 derniers jours
      </div>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 10,
        height: 160,
      }}>
        {data.map((d, i) => {
          const deliveredH = (d.delivered / maxVal) * 140;
          const failedH = (d.failed / maxVal) * 140;
          return (
            <div key={i} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 6,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: t.textMuted,
                minHeight: 14, textAlign: "center",
              }}>
                {d.total > 0 ? d.total : ""}
              </div>
              <div style={{
                width: "100%", maxWidth: 36,
                display: "flex", flexDirection: "column",
                justifyContent: "flex-end",
                height: 140, borderRadius: 6, overflow: "hidden",
                background: t.divider,
              }}>
                <div style={{
                  height: failedH, background: "#ef4444",
                  transition: "height 0.4s ease",
                  borderRadius: failedH > 0 && deliveredH === 0 ? "4px 4px 0 0" : 0,
                }} />
                <div style={{
                  height: deliveredH, background: "#22c55e",
                  transition: "height 0.4s ease",
                  borderRadius: deliveredH > 0 ? "0 0 0 0" : 0,
                }} />
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: t.textMuted,
                textTransform: "capitalize",
              }}>
                {dayName(d.date)}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{
        display: "flex", gap: 16, marginTop: 14,
        justifyContent: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "#22c55e" }} />
          <span style={{ fontSize: 11, color: t.textMuted }}>Livr&eacute;s</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "#ef4444" }} />
          <span style={{ fontSize: 11, color: t.textMuted }}>&Eacute;checs</span>
        </div>
      </div>
    </div>
  );
}

/* ── Top Wilayas ───────────────────────────────────────── */

function TopWilayas({
  wilayas, t,
}: {
  wilayas: DashboardData["top_wilayas"]; t: Tokens;
}) {
  const maxCount = Math.max(...wilayas.map(w => w.count), 1);

  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`,
      borderRadius: 14, padding: "22px 24px", boxShadow: t.shadow,
      flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 14, fontWeight: 650, color: t.text, marginBottom: 18 }}>
        Top 5 Wilayas
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {wilayas.slice(0, 5).map((w, i) => (
          <div key={i}>
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 5,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: i === 0 ? "rgba(249,115,22,0.12)" : t.divider,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700,
                  color: i === 0 ? "#ea580c" : t.textMuted,
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, fontWeight: 550, color: t.text }}>
                  {w.wilaya_name}
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: t.textMuted }}>
                {w.count} colis
              </span>
            </div>
            <div style={{
              height: 6, borderRadius: 3,
              background: t.divider, overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${(w.count / maxCount) * 100}%`,
                background: i === 0 ? "#f97316" : "#3b82f6",
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        ))}
        {wilayas.length === 0 && (
          <div style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: 20 }}>
            Aucune donn&eacute;e disponible
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Status Chip ───────────────────────────────────────── */

function StatusChip({ status }: { status: string }) {
  const s = status as PackageStatus;
  const colors = STATUS_COLORS[s] || { bg: "rgba(107,114,128,0.1)", text: "#6b7280", dot: "#6b7280" };
  const label = STATUS_LABELS[s] || status;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20,
      background: colors.bg, fontSize: 11, fontWeight: 600,
      color: colors.text, whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: colors.dot, flexShrink: 0,
      }} />
      {label}
    </span>
  );
}

/* ── Main ──────────────────────────────────────────────── */

export default function ExpDashboardPage() {
  const router = useRouter();
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ first_name: string; last_name: string; company_name?: string | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getExpDashboard();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || "Erreur chargement");
      }
    } catch {
      setError("Erreur de connexion");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const u = getStoredUser();
    if (u) setUser(u as any);
    load();
  }, [load]);

  /* ── Loading state ── */
  if (loading && !data) {
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

  const w = data?.wallet;
  const retourRate = w
    ? ((w.retour_count || 0) + (w.total_delivered || 0)) > 0
      ? ((w.retour_count || 0) / ((w.retour_count || 0) + (w.total_delivered || 0))) * 100
      : 0
    : 0;
  const retourColor = retourRate > 20 ? "#ef4444" : retourRate > 10 ? "#f59e0b" : "#22c55e";

  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>

      {/* ── Welcome Banner ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 750, color: t.text, margin: 0, letterSpacing: -0.5 }}>
            Bonjour, {user?.first_name || "Utilisateur"} !
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {user?.company_name && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#ea580c",
                background: "rgba(249,115,22,0.1)",
                padding: "2px 10px", borderRadius: 20,
              }}>
                {user.company_name}
              </span>
            )}
            {(() => {
              const u = user as any;
              const sd = u?.stop_desk;
              const wilayaName = sd?.commune?.wilaya?.name ?? u?.wilaya?.name;
              const communeName = sd?.commune?.name;
              const sdName = sd?.name;
              const parts = [sdName, communeName, wilayaName].filter(Boolean);
              return parts.length > 0 ? (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: "#3b82f6",
                  background: "rgba(59,130,246,0.08)",
                  padding: "2px 10px", borderRadius: 20,
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  <MapPin size={10} />
                  {parts.join(" · ")}
                </span>
              ) : null;
            })()}
          </div>
        </div>
        <button
          onClick={load}
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

      {/* ── Error Banner ── */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 20,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          color: "#ef4444", fontSize: 13, fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* ── KPI Cards ── */}
          <div style={{
            display: "flex", gap: 14, marginBottom: 24,
            flexWrap: "wrap",
          }}>
            <KpiCard
              label="Solde Disponible" value={formatDA(w?.libere)}
              icon={Wallet} accent="#22c55e" t={t}
            />
            <KpiCard
              label="En Transit" value={formatDA(w?.en_transit)}
              icon={Truck} accent="#3b82f6" t={t}
            />
            <KpiCard
              label="Total Livr&eacute;s" value={String(w?.total_delivered || 0)}
              icon={TrendingUp} accent="#16a34a" t={t}
            />
            <KpiCard
              label="Taux Retour" value={retourRate.toFixed(1) + " %"}
              icon={RotateCcw} accent={retourColor} t={t}
            />
            <KpiCard
              label="Frais Total" value={formatDA(w?.total_shipping)}
              icon={Receipt} accent="#6b7280" t={t}
            />
          </div>

          {/* ── Quick Actions ── */}
          <div style={{
            display: "flex", gap: 14, marginBottom: 28,
            flexWrap: "wrap",
          }}>
            <ActionCard
              label="Nouveau Colis" description="Cr&eacute;er un envoi"
              icon={Plus} accent="#f97316"
              href="/dashboard/expediteur/nouveau" t={t} router={router}
            />
            <ActionCard
              label="Import CSV" description="Import en masse"
              icon={Upload} accent="#8b5cf6"
              href="/dashboard/expediteur/import" t={t} router={router}
            />
            <ActionCard
              label="Mes Colis" description="Voir tous mes colis"
              icon={Package} accent="#3b82f6"
              href="/dashboard/expediteur/colis" t={t} router={router}
            />
          </div>

          {/* ── Charts Row ── */}
          <div style={{
            display: "flex", gap: 16, marginBottom: 28,
            flexWrap: "wrap",
          }}>
            <div style={{ flex: "1.4 1 340px", minWidth: 0 }}>
              <DeliveryChart data={data.deliveries_by_day} t={t} />
            </div>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <TopWilayas wilayas={data.top_wilayas} t={t} />
            </div>
          </div>

          {/* ── Recent Packages Table ── */}
          <div style={{
            background: t.card, border: `1px solid ${t.border}`,
            borderRadius: 14, boxShadow: t.shadow, overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 24px", borderBottom: `1px solid ${t.divider}`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 650, color: t.text }}>
                Colis r&eacute;cents
              </div>
              <button
                onClick={() => router.push("/dashboard/expediteur/colis")}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 12, fontWeight: 600, color: "#f97316",
                  background: "none", border: "none", cursor: "pointer",
                  padding: "4px 8px", borderRadius: 6,
                }}
              >
                Voir tout <ChevronRight size={14} />
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%", borderCollapse: "collapse", fontSize: 13,
              }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.divider}` }}>
                    {["Tracking", "Statut", "Destinataire", "Wilaya", "COD", "Date"].map(h => (
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
                  {data.recent_packages.map((pkg) => (
                    <tr
                      key={pkg.id}
                      style={{
                        borderBottom: `1px solid ${t.divider}`,
                        cursor: "default",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{
                        padding: "12px 16px", fontWeight: 600,
                        color: "#f97316", fontFamily: "monospace",
                        fontSize: 12, whiteSpace: "nowrap",
                      }}>
                        {pkg.tracking_number}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusChip status={pkg.status} />
                      </td>
                      <td style={{ padding: "12px 16px", color: t.text, fontWeight: 500 }}>
                        {pkg.recipient_name}
                      </td>
                      <td style={{ padding: "12px 16px", color: t.textSub }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={12} color={t.textFaint} />
                          {pkg.recipient_wilaya?.name || "-"}
                        </div>
                      </td>
                      <td style={{
                        padding: "12px 16px", fontWeight: 600,
                        color: pkg.cod_amount > 0 ? "#16a34a" : t.textMuted,
                        whiteSpace: "nowrap",
                      }}>
                        {pkg.cod_amount > 0 ? formatDA(pkg.cod_amount) : "-"}
                      </td>
                      <td style={{
                        padding: "12px 16px", color: t.textMuted,
                        fontSize: 12, whiteSpace: "nowrap",
                      }}>
                        {fmtDate(pkg.created_at)}
                      </td>
                    </tr>
                  ))}
                  {data.recent_packages.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{
                        padding: 40, textAlign: "center",
                        color: t.textMuted, fontSize: 13,
                      }}>
                        Aucun colis r&eacute;cent
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
