"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  UserPlus, Search, Loader2, Phone, MapPin, Building2, Pencil, Eye, Plus, X, Wallet,
  Mail, Calendar, FileText, Package as PackageIcon, TrendingUp, TrendingDown,
  CheckCircle2, RotateCcw, XCircle, Truck, KeyRound, ShieldCheck, ShieldOff,
  ExternalLink,
} from "lucide-react";
import {
  getUsers, updateUser, getExpediteurStats,
  type StaffUser, type ExpediteurStats,
} from "@/lib/users";
import { getWilayas, type Wilaya } from "@/lib/geography";
import { getWalletSummary, type WalletSummary } from "@/lib/wallet";
import { STATUS_LABELS, STATUS_COLORS, type PackageStatus } from "@/lib/packages";
import { API_BASE_URL, getStoredUser } from "@/lib/api";

/* ── theme ── */
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
    shadow: "none", modalBg: "#111827", overlay: "rgba(0,0,0,0.6)",
    inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", modalBg: "#ffffff", overlay: "rgba(0,0,0,0.35)",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

function formatDA(n: number) { return (Number(n) || 0).toLocaleString("fr-DZ") + " DA"; }

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// API_BASE_URL ends with the API prefix (/api or /api/v1); strip it for static files.
const API_ORIGIN = API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/, "");
/** Build a view URL for an uploaded legal document. Handles absolute URLs,
 *  /storage-relative paths, and bare "user-docs/..." paths alike. */
function fileUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.replace(/^\/+/, "");
  return clean.startsWith("storage/") ? `${API_ORIGIN}/${clean}` : `${API_ORIGIN}/storage/${clean}`;
}

const ACCOUNT_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  active:    { label: "Actif",    bg: "rgba(34,197,94,0.12)",  text: "#16a34a" },
  inactive:  { label: "Inactif",  bg: "rgba(107,114,128,0.14)", text: "#6b7280" },
  suspended: { label: "Suspendu", bg: "rgba(239,68,68,0.12)",   text: "#dc2626" },
};

function pkgStatusMeta(s: string) {
  const c = STATUS_COLORS[s as PackageStatus];
  return {
    label: STATUS_LABELS[s as PackageStatus] ?? s,
    bg: c?.bg ?? "rgba(107,114,128,0.1)",
    text: c?.text ?? "#6b7280",
    dot: c?.dot ?? "#9ca3af",
  };
}

type Tokens = ReturnType<typeof useTokens>;

/* ── Dossier building blocks ── */
function DossierSection({ t, icon: Icon, title, accent = "#f97316", children }: {
  t: Tokens; icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
  title: string; accent?: string; children: React.ReactNode;
}) {
  return (
    <section style={{
      background: t.bg, border: `1px solid ${t.border}`, borderRadius: 14,
      padding: 16, marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
          background: `${accent}1a`,
        }}>
          <Icon size={15} color={accent} />
        </div>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: "0.01em" }}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function InfoRow({ t, icon: Icon, label, value, mono }: {
  t: Tokens; icon?: React.ComponentType<{ size?: number; color?: string }>;
  label: string; value: React.ReactNode; mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0" }}>
      {Icon && <Icon size={14} color={t.textFaint} />}
      <span style={{ fontSize: 12, color: t.textMuted, width: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: mono ? "ui-monospace, monospace" : undefined, wordBreak: "break-word" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function KpiTile({ t, icon: Icon, label, value, color }: {
  t: Tokens; icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string; value: React.ReactNode; color: string;
}) {
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
      padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{value}</span>
    </div>
  );
}

function DocRow({ t, label, value, file }: { t: Tokens; label: string; value?: string | null; file?: string | null }) {
  const url = fileUrl(file);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${t.divider}` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: value ? t.text : t.textFaint, fontFamily: "ui-monospace, monospace", wordBreak: "break-word" }}>{value || "—"}</div>
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600,
          color: "#0ea5e9", textDecoration: "none", padding: "5px 11px", borderRadius: 8,
          background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.22)", flexShrink: 0,
        }}>
          <Eye size={12} /> Voir
        </a>
      ) : (
        <span style={{ fontSize: 11, color: t.textFaint, flexShrink: 0 }}>Aucun fichier</span>
      )}
    </div>
  );
}

function ExpediteurDossier({ user, wallet, t, isAdmin, onClose, onEdit, onApiToggled }: {
  user: StaffUser; wallet?: WalletSummary; t: Tokens; isAdmin: boolean;
  onClose: () => void; onEdit: () => void; onApiToggled: (next: boolean) => void;
}) {
  const [stats, setStats] = useState<ExpediteurStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [apiEnabled, setApiEnabled] = useState(user.api_enabled ?? true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => { setApiEnabled(user.api_enabled ?? true); }, [user.api_enabled]);

  useEffect(() => {
    let alive = true;
    setStatsLoading(true);
    setStatsError("");
    setStats(null);
    getExpediteurStats(user.id).then(res => {
      if (!alive) return;
      if (res.success && res.data) setStats(res.data);
      else setStatsError(res.message || "Impossible de charger les statistiques.");
      setStatsLoading(false);
    });
    return () => { alive = false; };
  }, [user.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggleApi() {
    if (toggling || !isAdmin) return;
    const next = !apiEnabled;
    setToggling(true);
    // Full-profile resend: the update endpoint replaces every field (absent -> null),
    // so we echo the whole expéditeur profile and flip api_enabled only.
    const res = await updateUser(user.id, {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone,
      user_type: user.user_type,
      status: user.status,
      api_enabled: next,
      wilaya_id: user.wilaya_id,
      stop_desk_id: user.stop_desk_id,
      company_name: user.company_name ?? null,
      registre_commerce: user.registre_commerce ?? null,
      nif: user.nif ?? null,
      nis: user.nis ?? null,
    });
    setToggling(false);
    if (res.success) { setApiEnabled(next); onApiToggled(next); }
  }

  const st = ACCOUNT_STATUS[user.status] ?? { label: user.status, bg: "rgba(107,114,128,0.14)", text: "#6b7280" };
  const byStatus = stats ? Object.entries(stats.by_status).filter(([, n]) => n > 0) : [];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", justifyContent: "flex-end", background: t.overlay }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)", height: "100vh", background: t.card,
          borderLeft: `1px solid ${t.border}`, display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${t.divider}`, background: t.card,
          display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 1,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, fontSize: 15, fontWeight: 800,
            background: "rgba(249,115,22,0.12)", color: "#f97316",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {user.first_name[0]}{user.last_name[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.text }}>{user.first_name} {user.last_name}</h2>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: st.bg, color: st.text }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{user.company_name || "Expéditeur"}</div>
          </div>
          <Link href={`/dashboard/expediteurs/${user.id}`} title="Ouvrir la fiche ERP" style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 10,
            border: "none", background: "#f97316", color: "#fff", fontSize: 12, fontWeight: 700, textDecoration: "none",
          }}>
            <ExternalLink size={13} /> Fiche ERP
          </Link>
          <button onClick={onEdit} title="Modifier" style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 10,
            border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>
            <Pencil size={13} /> Modifier
          </button>
          <button onClick={onClose} title="Fermer" style={{
            width: 34, height: 34, borderRadius: 9, border: `1px solid ${t.border}`, background: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
          }}>
            <X size={16} color={t.textMuted} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* Identité */}
          <DossierSection t={t} icon={Building2} title="Identité">
            <InfoRow t={t} icon={Mail} label="Email" value={user.email} />
            <InfoRow t={t} icon={Phone} label="Téléphone" value={user.phone || "—"} />
            <InfoRow t={t} icon={Building2} label="Société" value={user.company_name || "—"} />
            <InfoRow t={t} icon={Calendar} label="Inscrit le" value={fmtDate(user.created_at)} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0 0", marginTop: 6, borderTop: `1px solid ${t.divider}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <KeyRound size={14} color={t.textFaint} />
                <span style={{ fontSize: 12, color: t.textMuted }}>Accès API</span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
                  background: apiEnabled ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.14)",
                  color: apiEnabled ? "#16a34a" : "#6b7280",
                }}>
                  {apiEnabled ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
                  {apiEnabled ? "Activé" : "Désactivé"}
                </span>
              </div>
              {isAdmin && (
                <button onClick={toggleApi} disabled={toggling} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9,
                  border: "none", cursor: toggling ? "default" : "pointer", fontSize: 12, fontWeight: 700, opacity: toggling ? 0.6 : 1,
                  background: apiEnabled ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                  color: apiEnabled ? "#dc2626" : "#16a34a",
                }}>
                  {toggling && <Loader2 size={12} className="animate-spin" />}
                  {apiEnabled ? "Désactiver" : "Activer"}
                </button>
              )}
            </div>
          </DossierSection>

          {/* Documents légaux */}
          <DossierSection t={t} icon={FileText} title="Documents légaux" accent="#0ea5e9">
            <DocRow t={t} label="Registre de Commerce" value={user.registre_commerce} file={user.rc_file} />
            <DocRow t={t} label="NIF" value={user.nif} file={user.nif_file} />
            <div style={{ marginBottom: -8 }}>
              <DocRow t={t} label="NIS" value={user.nis} file={user.nis_file} />
            </div>
          </DossierSection>

          {/* Localisation */}
          <DossierSection t={t} icon={MapPin} title="Localisation" accent="#14b8a6">
            <InfoRow t={t} icon={MapPin} label="Wilaya" value={user.wilaya?.name || "—"} />
            <InfoRow t={t} icon={Building2} label="Stop desk" value={user.stop_desk?.name || "—"} />
          </DossierSection>

          {/* Finances */}
          <DossierSection t={t} icon={Wallet} title="Finances" accent="#16a34a">
            {wallet ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                <KpiTile t={t} icon={Wallet} label="Solde" value={formatDA(wallet.balance)} color={wallet.balance >= 0 ? "#16a34a" : "#ef4444"} />
                <KpiTile t={t} icon={Truck} label="En transit" value={formatDA(wallet.en_transit)} color="#3b82f6" />
                <KpiTile t={t} icon={CheckCircle2} label="Libéré" value={formatDA(wallet.libere)} color="#16a34a" />
                <KpiTile t={t} icon={TrendingDown} label="Dettes" value={formatDA(wallet.dettes)} color="#ef4444" />
                <KpiTile t={t} icon={PackageIcon} label="COD total" value={formatDA(wallet.total_cod)} color="#f97316" />
                <KpiTile t={t} icon={RotateCcw} label="Retours" value={wallet.retour_count} color="#a855f7" />
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: t.textFaint }}>Portefeuille non chargé.</p>
            )}
          </DossierSection>

          {/* Colis (statistiques) */}
          <DossierSection t={t} icon={PackageIcon} title="Colis — statistiques">
            {statsLoading && (
              <div style={{ padding: 24, textAlign: "center", color: t.textMuted, fontSize: 13 }}>
                <Loader2 size={16} className="animate-spin" style={{ display: "inline" }} /> Chargement des statistiques...
              </div>
            )}
            {!statsLoading && statsError && (
              <div style={{ padding: 16, borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626", fontSize: 12 }}>
                {statsError}
              </div>
            )}
            {!statsLoading && !statsError && stats && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
                  <KpiTile t={t} icon={PackageIcon} label="Total" value={stats.total} color="#f97316" />
                  <KpiTile t={t} icon={CheckCircle2} label="Livrés" value={stats.delivered} color="#16a34a" />
                  <KpiTile t={t} icon={Truck} label="En cours" value={stats.in_progress} color="#3b82f6" />
                  <KpiTile t={t} icon={RotateCcw} label="Retours" value={stats.returned} color="#a855f7" />
                  <KpiTile t={t} icon={XCircle} label="Échecs" value={stats.failed} color="#ef4444" />
                  <KpiTile t={t} icon={TrendingUp} label="Taux livraison" value={`${stats.delivery_rate}%`} color="#16a34a" />
                  <KpiTile t={t} icon={TrendingDown} label="Taux retour" value={`${stats.return_rate}%`} color="#ef4444" />
                  <KpiTile t={t} icon={Wallet} label="CA généré" value={formatDA(stats.ca_genere)} color="#f97316" />
                  <KpiTile t={t} icon={PackageIcon} label="COD collecté" value={formatDA(stats.cod_collected)} color="#0ea5e9" />
                </div>

                {byStatus.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
                    {byStatus.map(([s, n]) => {
                      const m = pkgStatusMeta(s);
                      return (
                        <span key={s} style={{
                          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600,
                          padding: "4px 10px", borderRadius: 999, background: m.bg, color: m.text,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: m.dot }} />
                          {m.label} <strong style={{ fontWeight: 800 }}>{n}</strong>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Colis récents
                  </div>
                  {stats.recent.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 12, color: t.textFaint }}>Aucun colis récent.</p>
                  ) : (
                    <div style={{ border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            {["Tracking", "Statut", "Destinataire", "Wilaya", "COD", "Date"].map(h => (
                              <th key={h} style={{
                                padding: "8px 10px", fontSize: 9, fontWeight: 700, color: t.textFaint,
                                textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "left",
                                borderBottom: `1px solid ${t.divider}`, background: t.bg,
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recent.map((p, i) => {
                            const m = pkgStatusMeta(p.status);
                            return (
                              <tr key={`${p.tracking_number}-${i}`} style={{ borderBottom: i < stats.recent.length - 1 ? `1px solid ${t.divider}` : "none" }}>
                                <td style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, color: t.text, fontFamily: "ui-monospace, monospace" }}>{p.tracking_number}</td>
                                <td style={{ padding: "8px 10px" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: m.bg, color: m.text }}>
                                    <span style={{ width: 5, height: 5, borderRadius: 999, background: m.dot }} />{m.label}
                                  </span>
                                </td>
                                <td style={{ padding: "8px 10px", fontSize: 12, color: t.textSub }}>{p.recipient_name || "—"}</td>
                                <td style={{ padding: "8px 10px", fontSize: 12, color: t.textMuted }}>{p.recipient_wilaya || "—"}</td>
                                <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 700, color: t.text }}>{formatDA(p.cod_amount)}</td>
                                <td style={{ padding: "8px 10px", fontSize: 11, color: t.textMuted, whiteSpace: "nowrap" }}>{fmtDate(p.created_at)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </DossierSection>
        </div>
      </div>
    </div>
  );
}

export default function GestionExpediteursPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const currentUser = getStoredUser();
  const isOperator = currentUser?.user_type === "operator" || currentUser?.user_type === "responsable";
  const isAdmin = currentUser?.user_type === "admin";

  const [expediteurs, setExpediteurs] = useState<StaffUser[]>([]);
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [wallets, setWallets] = useState<Record<number, WalletSummary>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [detail, setDetail] = useState<StaffUser | null>(null);
  const [filterWilaya, setFilterWilaya] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBalance, setFilterBalance] = useState(""); // positive, negative, zero

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      getUsers({ type: "expediteur" }),
      getWilayas({ full: true }),
    ]).then(([expRes, wilRes]) => {
      if (expRes.success && expRes.data) {
        setExpediteurs(expRes.data);
        expRes.data.forEach(u => {
          getWalletSummary(u.id).then(r => {
            if (r.success && r.data) setWallets(prev => ({ ...prev, [u.id]: r.data! }));
          });
        });
      }
      if (wilRes.success && wilRes.data) setWilayas(wilRes.data);
      setLoading(false);
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = expediteurs.filter(u => {
    if (filterWilaya && String(u.wilaya_id) !== filterWilaya) return false;
    if (filterStatus && u.status !== filterStatus) return false;
    if (filterBalance) {
      const w = wallets[u.id];
      if (filterBalance === "positive" && (!w || Number(w.balance) <= 0)) return false;
      if (filterBalance === "negative" && (!w || Number(w.balance) >= 0)) return false;
      if (filterBalance === "zero" && w && Number(w.balance) !== 0) return false;
    }
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return u.first_name.toLowerCase().includes(s) || u.last_name.toLowerCase().includes(s)
      || (u.phone ?? "").includes(s) || (u.company_name ?? "").toLowerCase().includes(s)
      || u.email.toLowerCase().includes(s);
  });

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)",
          }}>
            <UserPlus size={20} style={{ color: "#f43f5e" }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Expéditeurs</h1>
            <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>{filtered.length} expéditeur{filtered.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true); }} style={{
          padding: "10px 18px", borderRadius: 10, border: "none",
          background: "#f43f5e", color: "#fff", fontSize: 13, fontWeight: 700,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          <Plus size={14} /> Nouvel Expéditeur
        </button>
      </div>

      {/* Search */}
      <div style={{
        background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
        boxShadow: t.shadow, overflow: "hidden",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.divider}`, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
            <input
              placeholder="Rechercher par nom, téléphone, entreprise, email..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10,
                border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
                fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={filterWilaya} onChange={e => setFilterWilaya(e.target.value)} style={{
              padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
              background: t.inp.bg, color: t.inp.text, fontSize: 11, cursor: "pointer",
            }}>
              <option value="">Toutes wilayas</option>
              {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{
              padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
              background: t.inp.bg, color: t.inp.text, fontSize: 11, cursor: "pointer",
            }}>
              <option value="">Tous statuts</option>
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
              <option value="suspended">Suspendu</option>
            </select>
            <select value={filterBalance} onChange={e => setFilterBalance(e.target.value)} style={{
              padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.inp.border}`,
              background: t.inp.bg, color: t.inp.text, fontSize: 11, cursor: "pointer",
            }}>
              <option value="">Tous soldes</option>
              <option value="positive">Solde positif (on doit)</option>
              <option value="negative">Solde négatif (il doit)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Expéditeur", "Téléphone", "Entreprise", "Wilaya", "Solde", "En transit", "Actions"].map(h => (
                <th key={h} style={{
                  padding: "10px 20px", fontSize: 10, fontWeight: 700, color: t.textFaint,
                  textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left",
                  borderBottom: `1px solid ${t.divider}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: t.textMuted }}>
                <Loader2 size={16} className="animate-spin" style={{ display: "inline" }} /> Chargement...
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: t.textFaint, fontSize: 13 }}>
                Aucun expéditeur trouvé
              </td></tr>
            )}
            {!loading && filtered.map(u => {
              const w = wallets[u.id];
              return (
                <tr key={u.id}
                  onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  style={{ cursor: "pointer", transition: "background 100ms" }}
                  onClick={() => setDetail(u)}
                >
                  <td style={{ padding: "12px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        background: "rgba(244,63,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#f43f5e",
                      }}>
                        {u.first_name[0]}{u.last_name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{u.first_name} {u.last_name}</div>
                        <div style={{ fontSize: 11, color: t.textFaint }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: t.textSub }}>{u.phone ?? "—"}</td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: t.textSub }}>{u.company_name ?? "—"}</td>
                  <td style={{ padding: "12px 20px", fontSize: 13, color: t.textMuted }}>{u.wilaya?.name ?? "—"}</td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: w ? (w.balance >= 0 ? "#16a34a" : "#ef4444") : t.textFaint }}>
                      {w ? formatDA(w.balance) : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 20px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#3b82f6" }}>
                      {w ? formatDA(w.en_transit) : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 20px" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Link href={`/dashboard/expediteurs/${u.id}`} title="Ouvrir la fiche ERP" style={{
                        width: 28, height: 28, borderRadius: 6, cursor: "pointer",
                        background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <ExternalLink size={13} color="#f97316" />
                      </Link>
                      <button onClick={() => { setEditing(u); setShowModal(true); }} title="Modifier" style={{
                        width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer",
                        background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Pencil size={13} color={t.textMuted} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail drawer — full merchant dossier */}
      {detail && (
        <ExpediteurDossier
          user={detail}
          wallet={wallets[detail.id]}
          t={t}
          isAdmin={isAdmin}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setShowModal(true); setDetail(null); }}
          onApiToggled={(next) => {
            const id = detail.id;
            setExpediteurs(prev => prev.map(e => e.id === id ? { ...e, api_enabled: next } : e));
            setDetail(prev => prev ? { ...prev, api_enabled: next } : prev);
          }}
        />
      )}

      {/* Create/Edit modal (redirects to Utilisateurs) */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: t.overlay }}
          onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: t.modalBg, borderRadius: 16, width: "100%", maxWidth: 480,
            border: `1px solid ${t.border}`, padding: 24,
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700, color: t.text }}>
              {editing ? "Modifier l'expéditeur" : "Nouvel Expéditeur"}
            </h3>
            <p style={{ color: t.textMuted, fontSize: 13 }}>
              Pour créer ou modifier un expéditeur, utilisez la page Utilisateurs → onglet Expéditeurs.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{
                padding: "9px 18px", borderRadius: 10, border: `1px solid ${t.border}`,
                background: "transparent", color: t.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Fermer</button>
              <button onClick={() => { setShowModal(false); window.location.href = "/dashboard/users?tab=expediteur"; }} style={{
                padding: "9px 18px", borderRadius: 10, border: "none",
                background: "#f43f5e", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}>Aller aux Utilisateurs</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
