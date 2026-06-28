"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, AlertCircle, Pencil, Search, X, ChevronDown,
  Mail, Phone, Building2, KeyRound, ShieldCheck, ShieldOff,
  Package as PackageIcon, CheckCircle2, TrendingUp, Wallet, Banknote,
  LayoutDashboard, Tags, MessageSquareWarning, Boxes, Users, Activity,
} from "lucide-react";
import {
  useIsDark, useTokens, ORANGE, formatDA, type Tokens,
} from "../../_ui";
import { getStoredUser } from "@/lib/api";
import {
  getUser, updateUser, getUsers, type StaffUser,
} from "@/lib/users";
import { getExpStats, type ExpediteurStats } from "@/lib/expediteur-admin";
import { getWalletSummary, type WalletSummary } from "@/lib/wallet";

import type { ExpTabProps } from "./_tabs/types";
import Overview from "./_tabs/Overview";
import Profil from "./_tabs/Profil";
import Colis from "./_tabs/Colis";
import Finances from "./_tabs/Finances";
import Tarifs from "./_tabs/Tarifs";
import Reclamations from "./_tabs/Reclamations";
import Produits from "./_tabs/Produits";
import Clients from "./_tabs/Clients";
import Activite from "./_tabs/Activite";

/* ── Tab registry ── */
type TabDef = { key: string; label: string; icon: React.ElementType; Component: React.ComponentType<ExpTabProps> };
const TABS: TabDef[] = [
  { key: "overview",     label: "Aperçu",       icon: LayoutDashboard,     Component: Overview },
  { key: "profil",       label: "Profil",       icon: Building2,           Component: Profil },
  { key: "colis",        label: "Colis",        icon: PackageIcon,         Component: Colis },
  { key: "finances",     label: "Finances",     icon: Wallet,              Component: Finances },
  { key: "tarifs",       label: "Tarifs",       icon: Tags,                Component: Tarifs },
  { key: "reclamations", label: "Réclamations", icon: MessageSquareWarning, Component: Reclamations },
  { key: "produits",     label: "Produits",     icon: Boxes,               Component: Produits },
  { key: "clients",      label: "Clients",      icon: Users,               Component: Clients },
  { key: "activite",     label: "Activité",     icon: Activity,            Component: Activite },
];

const ACCOUNT_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  active:    { label: "Actif",    bg: "rgba(34,197,94,0.12)",   text: "#16a34a" },
  inactive:  { label: "Inactif",  bg: "rgba(107,114,128,0.14)", text: "#6b7280" },
  suspended: { label: "Suspendu", bg: "rgba(239,68,68,0.12)",   text: "#dc2626" },
};

export default function ExpediteurFichePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id ?? 0);
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const currentUser = getStoredUser();
  const isAdmin = currentUser?.user_type === "admin";

  const [user, setUser] = useState<StaffUser | null>(null);
  const [stats, setStats] = useState<ExpediteurStats | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [apiEnabled, setApiEnabled] = useState(true);
  const [toggling, setToggling] = useState(false);

  /* ── Load merchant + KPIs ── */
  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setStats(null);
    setWallet(null);
    Promise.all([getUser(id), getExpStats(id), getWalletSummary(id)]).then(([uRes, sRes, wRes]) => {
      if (uRes.success && uRes.data) {
        setUser(uRes.data);
        setApiEnabled(uRes.data.api_enabled ?? true);
      } else {
        setError(uRes.message || "Impossible de charger cet expéditeur.");
      }
      if (sRes.success && sRes.data) setStats(sRes.data);
      if (wRes.success && wRes.data) setWallet(wRes.data);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /* ── Hydrate / sync active tab from ?tab= ── */
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && TABS.some(x => x.key === tab)) setActiveTab(tab);
  }, []);

  function selectTab(key: string) {
    setActiveTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url.toString());
  }

  /* ── Accès API toggle (admin only — full-profile resend) ── */
  async function toggleApi() {
    if (toggling || !isAdmin || !user) return;
    const next = !apiEnabled;
    setToggling(true);
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
    if (res.success) {
      setApiEnabled(next);
      setUser(prev => (prev ? { ...prev, api_enabled: next } : prev));
    }
  }

  /* ── Loading / error ── */
  if (loading) {
    return (
      <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg, fontFamily: "var(--font-jakarta, sans-serif)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 80, color: t.textMuted, fontSize: 14 }}>
          <Loader2 size={18} style={{ animation: "spin 0.8s linear infinite" }} /> Chargement de la fiche…
        </div>
      </div>
    );
  }
  if (error || !user) {
    return (
      <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg, fontFamily: "var(--font-jakarta, sans-serif)" }}>
        <Link href="/dashboard/expediteurs" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, background: t.card, border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 18 }}>
          <ArrowLeft size={15} /> Retour aux expéditeurs
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "28px 24px", borderRadius: 14, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
          <AlertCircle size={18} /> {error || "Expéditeur introuvable."}
        </div>
      </div>
    );
  }

  const st = ACCOUNT_STATUS[user.status] ?? { label: user.status, bg: "rgba(107,114,128,0.14)", text: "#6b7280" };
  const ActiveComponent = (TABS.find(x => x.key === activeTab) ?? TABS[0]).Component;

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg, fontFamily: "var(--font-jakarta, sans-serif)" }}>

      {/* ── Top bar: back + merchant switcher ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <Link href="/dashboard/expediteurs" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9, background: t.card, border: `1px solid ${t.border}`, color: t.textSub, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          <ArrowLeft size={15} /> Retour à la liste
        </Link>
        <MerchantSwitcher t={t} currentId={user.id} onPick={(oid) => router.push(`/dashboard/expediteurs/${oid}`)} />
      </div>

      {/* ── Header identity card ── */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, boxShadow: t.shadow,
        padding: 20, marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0, fontSize: 19, fontWeight: 800,
            background: ORANGE + "1f", color: ORANGE,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {user.first_name[0]}{user.last_name[0]}
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: t.text, letterSpacing: -0.5 }}>
                {user.first_name} {user.last_name}
              </h1>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.text }}>{st.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: ORANGE + "16", color: ORANGE }}>Expéditeur #{user.id}</span>
            </div>
            <div style={{ fontSize: 13.5, color: t.textMuted, marginTop: 4, fontWeight: 600 }}>{user.company_name || "Société non renseignée"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: t.textSub }}>
                <Mail size={13} color={t.textFaint} /> {user.email}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: t.textSub }}>
                <Phone size={13} color={t.textFaint} /> {user.phone || "—"}
              </span>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link href="/dashboard/users?tab=expediteur" style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10,
              border: `1px solid ${t.border}`, background: "transparent", color: t.textSub, fontSize: 13, fontWeight: 700, textDecoration: "none",
            }}>
              <Pencil size={14} /> Modifier
            </Link>
            {isAdmin && (
              <button onClick={toggleApi} disabled={toggling} title="Accès API" style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10,
                border: "none", cursor: toggling ? "default" : "pointer", fontSize: 13, fontWeight: 700, opacity: toggling ? 0.6 : 1,
                background: apiEnabled ? "rgba(34,197,94,0.1)" : "rgba(107,114,128,0.14)",
                color: apiEnabled ? "#16a34a" : "#6b7280",
              }}>
                {toggling ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                  : apiEnabled ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                API {apiEnabled ? "activée" : "désactivée"}
              </button>
            )}
            {!isAdmin && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10,
                fontSize: 13, fontWeight: 700,
                background: apiEnabled ? "rgba(34,197,94,0.1)" : "rgba(107,114,128,0.14)",
                color: apiEnabled ? "#16a34a" : "#6b7280",
              }}>
                <KeyRound size={14} /> API {apiEnabled ? "activée" : "désactivée"}
              </span>
            )}
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10,
          marginTop: 18, paddingTop: 18, borderTop: `1px solid ${t.divider}`,
        }}>
          <Kpi t={t} icon={PackageIcon}  label="Colis"        value={stats ? stats.total : "—"}                          color="#f97316" />
          <Kpi t={t} icon={CheckCircle2} label="Livrés"       value={stats ? stats.delivered : "—"}                      color="#16a34a" />
          <Kpi t={t} icon={TrendingUp}   label="Taux"         value={stats ? `${stats.delivery_rate}%` : "—"}            color="#0ea5e9" />
          <Kpi t={t} icon={Banknote}     label="CA généré"    value={stats ? formatDA(stats.ca_genere) : "—"}            color="#f97316" />
          <Kpi t={t} icon={Wallet}       label="COD collecté" value={stats ? formatDA(stats.cod_collected) : "—"}        color="#a855f7" />
          <Kpi t={t} icon={Wallet}       label="Solde"        value={wallet ? formatDA(wallet.balance) : "—"}            color={wallet && wallet.balance < 0 ? "#ef4444" : "#16a34a"} />
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div style={{
        display: "flex", gap: 4, overflowX: "auto", marginBottom: 16,
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 5, boxShadow: t.shadow,
      }}>
        {TABS.map(tab => {
          const active = tab.key === activeTab;
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => selectTab(tab.key)} style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 9,
              border: "none", cursor: "pointer", whiteSpace: "nowrap", fontSize: 13, fontWeight: 700,
              background: active ? ORANGE : "transparent",
              color: active ? "#fff" : t.textMuted,
              transition: "background 120ms, color 120ms",
            }}>
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Active tab content ── */}
      <ActiveComponent userId={user.id} user={user} t={t} />
    </div>
  );
}

/* ── KPI tile ── */
function Kpi({ t, icon: Icon, label, value, color }: {
  t: Tokens; icon: React.ElementType; label: string; value: React.ReactNode; color: string;
}) {
  return (
    <div style={{ background: t.sectionBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Icon size={13} color={color} />
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <span style={{ fontSize: 18, fontWeight: 800, color: t.text }}>{value}</span>
    </div>
  );
}

/* ── Merchant search / switcher ── */
function MerchantSwitcher({ t, currentId, onPick }: { t: Tokens; currentId: number; onPick: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StaffUser[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const h = setTimeout(async () => {
      const res = await getUsers({ type: "expediteur", search: term });
      if (res.success && res.data) setResults(res.data.filter(u => u.id !== currentId).slice(0, 8));
      else setResults([]);
      setSearching(false);
    }, 280);
    return () => clearTimeout(h);
  }, [q, currentId]);

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} style={{ position: "relative", width: "min(360px, 100%)" }}>
      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Changer d'expéditeur…"
          style={{
            width: "100%", padding: "9px 32px 9px 34px", borderRadius: 10,
            border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
            fontSize: 13, outline: "none", boxSizing: "border-box",
          }}
        />
        {q ? (
          <button onClick={() => { setQ(""); setResults([]); }} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", display: "flex" }}>
            <X size={14} color={t.textFaint} />
          </button>
        ) : (
          <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
        )}
      </div>

      {open && (q.trim() !== "") && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50,
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          overflow: "hidden", maxHeight: 340, overflowY: "auto",
        }}>
          {searching ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 14px", color: t.textMuted, fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Recherche…
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: "16px 14px", color: t.textFaint, fontSize: 13 }}>Aucun expéditeur trouvé.</div>
          ) : (
            results.map(u => (
              <button key={u.id} onClick={() => { onPick(u.id); setQ(""); setOpen(false); }}
                onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                  border: "none", borderBottom: `1px solid ${t.divider}`, background: "transparent",
                  cursor: "pointer", textAlign: "left",
                }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: ORANGE + "16", color: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800 }}>
                  {u.first_name[0]}{u.last_name[0]}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: t.text }}>{u.first_name} {u.last_name}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: t.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.company_name || u.email}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
