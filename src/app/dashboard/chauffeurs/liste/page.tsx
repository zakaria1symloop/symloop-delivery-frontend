"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Truck, Search, Loader2, Users, Package2, CheckCircle2,
  XCircle, TrendingUp, MapPin, Phone, Banknote,
} from "lucide-react";
import { api, getStoredUser, isSDLocked, getLockedSDId } from "@/lib/api";
import { getLocalDrivers, type DriverKPIs } from "@/lib/drivers";
import SDSelector from "@/components/SDSelector";

/* ── SD option type ───────────────────────────────────────── */
interface SDOption {
  id: number;
  name: string;
  code: string | null;
  type: string;
  parent_sd_id: number | null;
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

const SD_KEY = "chauffeurs_liste_sd";

/* ── theme ────────────────────────────────────────────────── */
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

/* ── helpers ──────────────────────────────────────────────── */
function formatDA(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number(n).toLocaleString("fr-DZ") + " DA";
}

function rateColor(rate: number): string {
  if (rate >= 80) return "#22c55e";
  if (rate >= 50) return "#f59e0b";
  return "#ef4444";
}

function rateBg(rate: number): string {
  if (rate >= 80) return "rgba(34,197,94,0.1)";
  if (rate >= 50) return "rgba(245,158,11,0.1)";
  return "rgba(239,68,68,0.1)";
}

const COMMUNE_COLORS = [
  { bg: "rgba(59,130,246,0.1)", text: "#3b82f6", border: "rgba(59,130,246,0.25)" },
  { bg: "rgba(16,185,129,0.1)", text: "#10b981", border: "rgba(16,185,129,0.25)" },
  { bg: "rgba(168,85,247,0.1)", text: "#a855f7", border: "rgba(168,85,247,0.25)" },
  { bg: "rgba(249,115,22,0.1)", text: "#f97316", border: "rgba(249,115,22,0.25)" },
  { bg: "rgba(236,72,153,0.1)", text: "#ec4899", border: "rgba(236,72,153,0.25)" },
  { bg: "rgba(14,165,233,0.1)", text: "#0ea5e9", border: "rgba(14,165,233,0.25)" },
  { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", border: "rgba(245,158,11,0.25)" },
  { bg: "rgba(34,197,94,0.1)",  text: "#22c55e", border: "rgba(34,197,94,0.25)" },
];

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  voiture: "Voiture",
  moto: "Moto",
  camionnette: "Camionnette",
  camion: "Camion",
  velo: "Vélo",
};

/* ── page ─────────────────────────────────────────────────── */
export default function ChauffeursListePage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  /* auth / sd lock */
  const user = getStoredUser();
  const isAdmin = user?.user_type === "admin";
  const lockedSD = isSDLocked(user) ? getLockedSDId(user) : null;

  /* state */
  const [stopDesks, setStopDesks] = useState<SDOption[]>([]);
  const [selectedSD, setSelectedSD] = useState<number | null>(null);
  const [drivers, setDrivers] = useState<DriverKPIs[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  /* init: load stop desks */
  useEffect(() => {
    (async () => {
      const res = await api<SDOption[]>("/stop-desks");
      if (res.success && res.data) {
        setStopDesks(res.data);
        const locked = lockedSD;
        if (locked) {
          setSelectedSD(locked);
        } else {
          const saved = typeof window !== "undefined" ? localStorage.getItem(SD_KEY) : null;
          const savedId = saved ? parseInt(saved, 10) : null;
          if (savedId && res.data.some(sd => sd.id === savedId)) {
            setSelectedSD(savedId);
          } else if (res.data.length > 0) {
            setSelectedSD(res.data[0].id);
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* persist SD selection */
  useEffect(() => {
    if (selectedSD != null && typeof window !== "undefined") {
      localStorage.setItem(SD_KEY, String(selectedSD));
    }
  }, [selectedSD]);

  /* load drivers on SD change */
  const loadDrivers = useCallback(async () => {
    if (!selectedSD) return;
    setLoading(true);
    try {
      const res = await getLocalDrivers({ stop_desk_id: selectedSD });
      if (res.success && res.data) {
        setDrivers(res.data);
      } else {
        setDrivers([]);
      }
    } catch {
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSD]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  /* filtered list */
  const filtered = drivers.filter(d => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const fullName = `${d.first_name} ${d.last_name}`.toLowerCase();
    return (
      fullName.includes(s) ||
      (d.phone ?? "").includes(s) ||
      (d.vehicle_plate ?? "").toLowerCase().includes(s)
    );
  });

  /* KPIs */
  const totalDrivers = drivers.length;
  const enLivraison = drivers.filter(d => d.current_packages > 0).length;
  const avgRate = totalDrivers > 0
    ? Math.round(drivers.reduce((sum, d) => sum + d.delivery_rate, 0) / totalDrivers)
    : 0;
  const totalCaisse = drivers.reduce((sum, d) => sum + (d.caisse_balance ?? 0), 0);

  /* KPI card data */
  const kpiCards: { icon: typeof Users; label: string; value: string; color: string; bg: string }[] = [
    {
      icon: Users,
      label: "Total Chauffeurs",
      value: String(totalDrivers),
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.1)",
    },
    {
      icon: Package2,
      label: "En Livraison",
      value: String(enLivraison),
      color: "#f97316",
      bg: "rgba(249,115,22,0.1)",
    },
    {
      icon: TrendingUp,
      label: "Taux Moyen",
      value: `${avgRate}%`,
      color: rateColor(avgRate),
      bg: rateBg(avgRate),
    },
    {
      icon: Banknote,
      label: "Solde Caisses Total",
      value: formatDA(totalCaisse),
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
    },
  ];

  return (
    <div style={{ fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Truck size={18} color="#f97316" strokeWidth={2} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: t.text, margin: 0, lineHeight: 1.2 }}>
              Chauffeurs Locaux
            </h1>
            <p style={{ fontSize: 12, color: t.textMuted, margin: 0, marginTop: 2 }}>
              Vue d'ensemble et KPIs des chauffeurs par stop desk
            </p>
          </div>
        </div>

        <SDSelector
          stopDesks={stopDesks}
          value={selectedSD}
          onChange={setSelectedSD}
          disabled={!!lockedSD}
        />
      </div>

      {/* ── KPI cards ───────────────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 14, marginBottom: 20,
      }}>
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} style={{
              background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
              padding: "16px 18px", boxShadow: t.shadow,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: kpi.bg, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={18} color={kpi.color} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.text, lineHeight: 1.1 }}>
                  {kpi.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Search bar ──────────────────────────────────────── */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
        padding: "12px 16px", marginBottom: 16, boxShadow: t.shadow,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Search size={15} color={t.textFaint} style={{ flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Rechercher par nom, téléphone ou plaque..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, border: "none", outline: "none",
            background: "transparent", fontSize: 13, color: t.text,
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex" }}
          >
            <XCircle size={14} color={t.textFaint} />
          </button>
        )}
        <span style={{ fontSize: 11, color: t.textFaint, flexShrink: 0 }}>
          {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
        overflow: "hidden", boxShadow: t.shadow,
      }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Loader2 size={24} color={t.textFaint} style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ marginTop: 10, fontSize: 13, color: t.textMuted }}>Chargement des chauffeurs...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : !selectedSD ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Truck size={32} color={t.textFaint} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div style={{ fontSize: 14, color: t.textMuted, fontWeight: 600 }}>Sélectionnez un Stop Desk</div>
            <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>
              Choisissez un stop desk pour voir ses chauffeurs locaux
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Users size={32} color={t.textFaint} style={{ opacity: 0.4, marginBottom: 10 }} />
            <div style={{ fontSize: 14, color: t.textMuted, fontWeight: 600 }}>
              {search ? "Aucun chauffeur trouvé" : "Aucun chauffeur dans ce stop desk"}
            </div>
            <div style={{ fontSize: 12, color: t.textFaint, marginTop: 4 }}>
              {search ? "Essayez de modifier votre recherche" : "Ce stop desk n'a pas encore de chauffeurs assignés"}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1000 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {[
                    { label: "Chauffeur", width: "18%" },
                    { label: "Véhicule", width: "11%" },
                    { label: "Communes", width: "22%" },
                    { label: "Assignés", width: "7%", align: "center" as const },
                    { label: "Livrés", width: "7%", align: "center" as const },
                    { label: "Échecs", width: "7%", align: "center" as const },
                    { label: "Taux%", width: "8%", align: "center" as const },
                    { label: "En Cours", width: "8%", align: "center" as const },
                    { label: "Solde Caisse", width: "12%", align: "right" as const },
                  ].map(col => (
                    <th key={col.label} style={{
                      position: "sticky", top: 0, zIndex: 2,
                      background: t.card, padding: "10px 14px",
                      fontSize: 10, fontWeight: 700, color: t.textFaint,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      textAlign: col.align ?? "left", width: col.width,
                      borderBottom: `1px solid ${t.border}`,
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((driver) => (
                  <DriverRow key={driver.id} driver={driver} t={t} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Driver row component ─────────────────────────────────── */
function DriverRow({ driver, t }: { driver: DriverKPIs; t: Tokens }) {
  const [hovered, setHovered] = useState(false);

  const fullName = `${driver.first_name} ${driver.last_name}`;
  const vehicleLabel = driver.vehicle_type
    ? (VEHICLE_TYPE_LABELS[driver.vehicle_type] ?? driver.vehicle_type)
    : "—";
  const plate = driver.vehicle_plate ?? "—";
  const rate = driver.delivery_rate;

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? t.rowHover : "transparent",
        borderBottom: `1px solid ${t.divider}`,
        transition: "background 100ms",
      }}
    >
      {/* Chauffeur */}
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: "rgba(249,115,22,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#f97316",
          }}>
            {driver.first_name.charAt(0).toUpperCase()}
            {driver.last_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.2 }}>
              {fullName}
            </div>
            {driver.phone && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Phone size={10} color={t.textFaint} />
                <span style={{ fontSize: 11, color: t.textMuted }}>{driver.phone}</span>
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Véhicule */}
      <td style={{ padding: "10px 14px" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: t.textSub }}>{vehicleLabel}</div>
        <div style={{ fontSize: 11, color: t.textFaint, marginTop: 1 }}>{plate}</div>
      </td>

      {/* Communes */}
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {driver.communes.length === 0 ? (
            <span style={{ fontSize: 11, color: t.textFaint, fontStyle: "italic" }}>Aucune commune</span>
          ) : (
            driver.communes.map((commune, idx) => {
              const colorSet = COMMUNE_COLORS[idx % COMMUNE_COLORS.length];
              return (
                <span key={commune.id} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 10, fontWeight: 600, padding: "2px 7px",
                  borderRadius: 99, whiteSpace: "nowrap",
                  background: colorSet.bg, color: colorSet.text,
                  border: `1px solid ${colorSet.border}`,
                }}>
                  <MapPin size={9} strokeWidth={2.5} />
                  {commune.name}
                  {commune.price > 0 && (
                    <span style={{ opacity: 0.75, fontWeight: 500, marginLeft: 1 }}>
                      {commune.price} DA
                    </span>
                  )}
                </span>
              );
            })
          )}
        </div>
      </td>

      {/* Assignés */}
      <td style={{ padding: "10px 14px", textAlign: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
          {driver.total_assigned}
        </span>
      </td>

      {/* Livrés */}
      <td style={{ padding: "10px 14px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <CheckCircle2 size={12} color="#22c55e" strokeWidth={2.5} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#22c55e" }}>
            {driver.total_delivered}
          </span>
        </div>
      </td>

      {/* Échecs */}
      <td style={{ padding: "10px 14px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <XCircle size={12} color={driver.total_failed > 0 ? "#ef4444" : t.textFaint} strokeWidth={2.5} />
          <span style={{ fontSize: 13, fontWeight: 600, color: driver.total_failed > 0 ? "#ef4444" : t.textFaint }}>
            {driver.total_failed}
          </span>
        </div>
      </td>

      {/* Taux% */}
      <td style={{ padding: "10px 14px", textAlign: "center" }}>
        <span style={{
          display: "inline-block", fontSize: 12, fontWeight: 700,
          padding: "3px 10px", borderRadius: 99,
          background: rateBg(rate), color: rateColor(rate),
        }}>
          {rate}%
        </span>
      </td>

      {/* En Cours */}
      <td style={{ padding: "10px 14px", textAlign: "center" }}>
        {driver.current_packages > 0 ? (
          <span style={{
            display: "inline-block", fontSize: 12, fontWeight: 700,
            padding: "3px 10px", borderRadius: 99,
            background: "rgba(249,115,22,0.1)", color: "#f97316",
          }}>
            {driver.current_packages}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: t.textFaint }}>0</span>
        )}
      </td>

      {/* Solde Caisse */}
      <td style={{ padding: "10px 14px", textAlign: "right" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
          <Banknote size={13} color={driver.caisse_balance > 0 ? "#10b981" : t.textFaint} strokeWidth={2} />
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: driver.caisse_balance > 0 ? "#10b981" : t.textFaint,
          }}>
            {formatDA(driver.caisse_balance)}
          </span>
        </div>
      </td>
    </tr>
  );
}
