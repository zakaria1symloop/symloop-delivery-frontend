"use client";

import { useEffect, useRef, useState } from "react";
import {
  getWilayas, getCommunes, getAllCommunes, getStopDesks, getAllStopDesks,
  createStopDesk, updateStopDesk, deleteStopDesk,
  type Wilaya, type Commune, type StopDesk,
} from "@/lib/geography";
import { getCaisses, createCaisse, type Caisse } from "@/lib/caisse";
import { api } from "@/lib/api";
import { Plus, Pencil, Trash2, X, Loader2, Store, MapPin, Building2, Warehouse, Network, Search, RotateCcw, Eye, Package, Users, Phone, Navigation, Banknote, Check, XCircle } from "lucide-react";

/* ── theme ───────────────────────────────────────────────── */
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
    card:       "#111827",
    border:     "#1e2130",
    divider:    "#1e2130",
    rowHover:   "#1a1f2e",
    text:       "#f0f0f5",
    textSub:    "#d1d5db",
    textMuted:  "#6b7280",
    textFaint:  "#4b5563",
    shadow:     "none",
    modalBg:    "#111827",
    overlay:    "rgba(0,0,0,0.6)",
    inp:        { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
    label:      "#6b7280",
    inpReadonly: "#0f1623",
  } : {
    card:       "#ffffff",
    border:     "#e5e7eb",
    divider:    "#f3f4f6",
    rowHover:   "#f9fafb",
    text:       "#111827",
    textSub:    "#374151",
    textMuted:  "#6b7280",
    textFaint:  "#9ca3af",
    shadow:     "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    modalBg:    "#ffffff",
    overlay:    "rgba(0,0,0,0.35)",
    inp:        { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    label:      "#6b7280",
    inpReadonly: "#f9fafb",
  };
}

type Tokens = ReturnType<typeof useTokens>;

function inpStyle(t: Tokens): React.CSSProperties {
  return {
    width: "100%", background: t.inp.bg, border: `1px solid ${t.inp.border}`,
    borderRadius: 7, padding: "8px 11px", fontSize: 13,
    color: t.inp.text, outline: "none", transition: "border-color 0.15s",
    boxSizing: "border-box",
  };
}

function selStyle(t: Tokens): React.CSSProperties {
  return {
    background: t.inp.bg, border: `1px solid ${t.inp.border}`,
    borderRadius: 7, padding: "7px 11px", fontSize: 13,
    color: t.inp.text, outline: "none", cursor: "pointer",
    appearance: "auto" as React.CSSProperties["appearance"],
  };
}

function IconBtn({ onClick, title, danger, disabled, children }: {
  onClick: () => void; title?: string;
  danger?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? "rgba(239,68,68,0.08)" : "rgba(0,0,0,0.06)") : "transparent",
        border: "none", borderRadius: 5, padding: "5px 6px",
        cursor: disabled ? "not-allowed" : "pointer",
        color: danger ? "#ef4444" : "inherit",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.4 : 1, transition: "background 0.1s",
      }}
    >{children}</button>
  );
}

/* ── type config ─────────────────────────────────────────── */
const TYPE_CONFIG = {
  agence: { label: "Agence", Icon: Building2, color: "#3b82f6", bg: "rgba(59,130,246,0.09)"  },
  depot:  { label: "Dépôt",  Icon: Warehouse, color: "#f59e0b", bg: "rgba(245,158,11,0.09)"  },
  hub:    { label: "HUB",    Icon: Network,   color: "#10b981", bg: "rgba(16,185,129,0.09)"  },
} as const;

type DeskType = keyof typeof TYPE_CONFIG;

/* ── User assignment data ────────────────────────────────── */
const MOCK_USERS = [
  { id: 1, name: "Ahmed Benali",  role: "operator",     initials: "AB" },
  { id: 2, name: "Sara Meziane",  role: "responsable",  initials: "SM" },
  { id: 3, name: "Khalil Amrani", role: "expediteur",   initials: "KA" },
  { id: 4, name: "Fatima Ouali",  role: "operator",     initials: "FO" },
  { id: 5, name: "Yacine Hadj",   role: "responsable",  initials: "YH" },
  { id: 6, name: "Nadia Bouzid",  role: "expediteur",   initials: "NB" },
  { id: 7, name: "Karim Saadi",   role: "professional", initials: "KS" },
] as const;

const ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  operator:     { label: "Opérateur",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  responsable:  { label: "Responsable",   color: "#10b981", bg: "rgba(16,185,129,0.1)"  },
  expediteur:   { label: "Expéditeur",    color: "#8b5cf6", bg: "rgba(139,92,246,0.1)"  },
  professional: { label: "Professionnel", color: "#3b82f6", bg: "rgba(59,130,246,0.1)"  },
};

/* ── UserAssignmentModal ─────────────────────────────────── */
function UserAssignmentModal({ t, isDark, desk, onClose }: {
  t: Tokens; isDark: boolean; desk: StopDesk; onClose: () => void;
}) {
  const cfg = TYPE_CONFIG[(desk.type ?? "agence") as DeskType];
  const [assignedIds, setAssignedIds] = useState<Set<number>>(
    () => new Set(MOCK_USERS.slice(0, Math.min(desk.users_count ?? 0, MOCK_USERS.length)).map(u => u.id)),
  );
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [hoverId, setHoverId] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = search.trim().toLowerCase();
  const visible = MOCK_USERS.filter(u => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (q && !u.name.toLowerCase().includes(q) && !(ROLE_CFG[u.role]?.label ?? u.role).toLowerCase().includes(q)) return false;
    return true;
  });

  const assigned  = visible.filter(u => assignedIds.has(u.id));
  const available = visible.filter(u => !assignedIds.has(u.id));
  const totalAssigned = assignedIds.size;

  function UserRow({ u, isAssigned }: { u: typeof MOCK_USERS[number]; isAssigned: boolean }) {
    const rc = ROLE_CFG[u.role] ?? { label: u.role, color: "#9ca3af", bg: "rgba(156,163,175,0.1)" };
    const hov = hoverId === u.id;
    return (
      <div
        onMouseEnter={() => setHoverId(u.id)}
        onMouseLeave={() => setHoverId(null)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 7,
          background: hov ? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)") : "transparent",
          transition: "background 0.12s",
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          background: rc.bg, border: `1.5px solid ${rc.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: rc.color }}>{u.initials}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: t.text, lineHeight: 1.2 }}>{u.name}</p>
          <span style={{
            display: "inline-flex", marginTop: 3, padding: "1px 7px", borderRadius: 20,
            fontSize: 10, fontWeight: 600, background: rc.bg, color: rc.color,
          }}>{rc.label}</span>
        </div>
        {isAssigned ? (
          <button
            onClick={() => setAssignedIds(p => { const n = new Set(p); n.delete(u.id); return n; })}
            title="Retirer"
            style={{
              width: 28, height: 28, borderRadius: 7, border: "none", flexShrink: 0,
              background: hov ? "rgba(239,68,68,0.1)" : (isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6"),
              color: hov ? "#ef4444" : t.textMuted,
              cursor: "pointer", transition: "all 0.14s",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          ><X size={13} /></button>
        ) : (
          <button
            onClick={() => setAssignedIds(p => new Set([...p, u.id]))}
            title="Assigner"
            style={{
              width: 28, height: 28, borderRadius: 7, border: "none", flexShrink: 0,
              background: hov ? "rgba(16,185,129,0.12)" : (isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6"),
              color: hov ? "#10b981" : t.textMuted,
              cursor: "pointer", transition: "all 0.14s",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          ><Plus size={13} /></button>
        )}
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 60, background: t.overlay,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, border: `1px solid ${t.border}`,
        borderRadius: 12, width: "100%", maxWidth: 520, maxHeight: "88vh",
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        fontFamily: "var(--font-jakarta, sans-serif)",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{ position: "relative", padding: "16px 20px 14px 24px", borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: cfg.color, borderRadius: "12px 0 0 0" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: cfg.bg, border: `1px solid ${cfg.color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <cfg.Icon size={15} color={cfg.color} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{desk.name}</span>
                {desk.code && (
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: t.textMuted, background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", padding: "1px 6px", borderRadius: 5, border: `1px solid ${t.border}` }}>
                    {desk.code}
                  </span>
                )}
                <span style={{
                  fontSize: 10, fontWeight: 700, transition: "all 0.2s",
                  color: totalAssigned > 0 ? "#f97316" : t.textMuted,
                  background: totalAssigned > 0 ? "rgba(249,115,22,0.1)" : (isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6"),
                  border: `1px solid ${totalAssigned > 0 ? "rgba(249,115,22,0.25)" : t.border}`,
                  padding: "2px 8px", borderRadius: 20,
                }}>
                  {totalAssigned} assigné{totalAssigned !== 1 ? "s" : ""}
                </span>
              </div>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>Gestion des utilisateurs assignés</p>
            </div>
            <IconBtn onClick={onClose} title="Fermer"><X size={15} color={t.textMuted} /></IconBtn>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Search + role filters */}
          <div style={{ padding: "12px 16px 0", flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Search input */}
            <div style={{ position: "relative" }}>
              <Search size={13} color={t.textMuted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom…"
                style={{
                  width: "100%", background: t.inp.bg, border: `1px solid ${t.inp.border}`,
                  borderRadius: 8, padding: "8px 11px 8px 32px", fontSize: 12,
                  color: t.inp.text, outline: "none", boxSizing: "border-box" as const,
                }}
              />
            </div>
            {/* Role filter pills */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" as const }}>
              {([
                { key: "all",          label: "Tous" },
                { key: "operator",     label: ROLE_CFG.operator.label },
                { key: "responsable",  label: ROLE_CFG.responsable.label },
                { key: "expediteur",   label: ROLE_CFG.expediteur.label },
                { key: "professional", label: ROLE_CFG.professional.label },
              ] as const).map(({ key, label }) => {
                const active = filterRole === key;
                const rc = key !== "all" ? ROLE_CFG[key] : null;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterRole(key)}
                    style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", transition: "all 0.12s",
                      border: active
                        ? `1.5px solid ${rc ? rc.color : "#f97316"}`
                        : `1.5px solid ${t.inp.border}`,
                      background: active
                        ? (rc ? rc.bg : "rgba(249,115,22,0.1)")
                        : "transparent",
                      color: active
                        ? (rc ? rc.color : "#f97316")
                        : t.textMuted,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assigned section */}
          <div style={{ padding: "14px 16px 10px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: "#10b981" }}>Assignés</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.12)", padding: "1px 6px", borderRadius: 20 }}>
                {assigned.length}
              </span>
            </div>
            <div style={{
              background: isDark ? "rgba(16,185,129,0.04)" : "rgba(16,185,129,0.03)",
              border: "1px solid rgba(16,185,129,0.12)", borderRadius: 10, minHeight: 52,
            }}>
              {assigned.length === 0 ? (
                <p style={{ margin: 0, padding: "14px 12px", textAlign: "center" as const, fontSize: 12, color: t.textFaint }}>
                  Aucun utilisateur assigné
                </p>
              ) : (
                <div style={{ padding: 4 }}>
                  {assigned.map(u => <UserRow key={u.id} u={u} isAssigned={true} />)}
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={{ margin: "0 16px", borderTop: `1px dashed ${t.border}` }} />

          {/* Available section */}
          <div style={{ padding: "10px 16px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: t.textMuted }}>Disponibles</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, background: isDark ? "rgba(255,255,255,0.07)" : "#f3f4f6", padding: "1px 6px", borderRadius: 20 }}>
                {available.length}
              </span>
            </div>
            <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, minHeight: 52 }}>
              {available.length === 0 ? (
                <p style={{ margin: 0, padding: "14px 12px", textAlign: "center" as const, fontSize: 12, color: t.textFaint }}>
                  {assignedIds.size >= MOCK_USERS.length ? "Tous les utilisateurs sont assignés" : "Aucun résultat"}
                </p>
              ) : (
                <div style={{ padding: 4 }}>
                  {available.map(u => <UserRow key={u.id} u={u} isAssigned={false} />)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${t.border}`, borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>
            Fermer
          </button>
          <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f97316", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}>
            <Users size={13} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── StopDeskDetailModal ─────────────────────────────────── */
interface DetailModalProps {
  t: Tokens;
  isDark: boolean;
  desk: StopDesk;
  commune?: Commune;
  onClose: () => void;
  onEdit: () => void;
  onAssign: () => void;
}

function StopDeskDetailModal({ t, isDark, desk, commune, onClose, onEdit, onAssign }: DetailModalProps) {
  const cfg = TYPE_CONFIG[(desk.type ?? "agence") as DeskType];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lbl: React.CSSProperties = {
    display: "block", fontSize: 10, fontWeight: 700, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 4,
  };
  const val: React.CSSProperties = { fontSize: 13, color: t.textSub, fontWeight: 500 };
  const faint: React.CSSProperties = { color: t.textFaint, fontWeight: 400 };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50, background: t.overlay,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, border: `1px solid ${t.border}`,
        borderRadius: 12, width: "100%", maxWidth: 540,
        boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        fontFamily: "var(--font-jakarta, sans-serif)",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>

        {/* ── Header with left accent strip ── */}
        <div style={{ position: "relative", padding: "18px 20px 16px 24px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: 4, background: cfg.color, borderRadius: "12px 0 0 0",
          }} />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 9, flexShrink: 0,
              background: cfg.bg, border: `1px solid ${cfg.color}28`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <cfg.Icon size={17} color={cfg.color} strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>
                  {desk.name}
                </h2>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  letterSpacing: "0.04em",
                  background: desk.is_active ? "rgba(16,185,129,0.1)" : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"),
                  color: desk.is_active ? "#10b981" : t.textMuted,
                  border: `1px solid ${desk.is_active ? "rgba(16,185,129,0.22)" : t.border}`,
                }}>
                  {desk.is_active ? "● Actif" : "○ Inactif"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: cfg.color }}>
                  <cfg.Icon size={9} strokeWidth={2} />{cfg.label}
                </span>
                {desk.code && (
                  <>
                    <span style={{ color: t.border }}>·</span>
                    <span style={{
                      fontFamily: "monospace", fontSize: 11, color: t.textMuted,
                      background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6",
                      padding: "1px 6px", borderRadius: 5, border: `1px solid ${t.border}`,
                    }}>{desk.code}</span>
                  </>
                )}
                {commune && (
                  <>
                    <span style={{ color: t.border }}>·</span>
                    <span style={{ fontSize: 11, color: t.textMuted }}>
                      {commune.name}{commune.wilaya ? ` / ${commune.wilaya.name}` : ""}
                    </span>
                  </>
                )}
              </div>
            </div>
            <IconBtn onClick={onClose} title="Fermer"><X size={15} color={t.textMuted} /></IconBtn>
          </div>
        </div>

        {/* ── KPI stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "14px 20px", borderBottom: `1px solid ${t.border}` }}>
          {[
            {
              icon: <Package size={12} color={t.textMuted} />,
              label: "Capacité colis",
              value: desk.colis_capacity != null ? String(desk.colis_capacity) : null,
              sub: "colis maximum",
            },
            {
              icon: <Users size={12} color={t.textMuted} />,
              label: "Utilisateurs",
              value: String(desk.users_count ?? 0),
              sub: "assignés à ce point",
            },
          ].map(card => (
            <div key={card.label} style={{
              padding: "12px 14px", borderRadius: 8,
              background: isDark ? "rgba(255,255,255,0.03)" : "#f9fafb",
              border: `1px solid ${t.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: isDark ? "#2e2e2e" : "#fff",
                  border: `1px solid ${t.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {card.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {card.label}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 700, lineHeight: 1, color: card.value != null ? t.text : t.textFaint }}>
                {card.value ?? "—"}
              </p>
              <p style={{ margin: "5px 0 0", fontSize: 11, color: t.textMuted }}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Info grid ── */}
        <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <span style={lbl}>Commune</span>
            <span style={val}>{commune?.name ?? <span style={faint}>—</span>}</span>
          </div>
          <div>
            <span style={lbl}>Wilaya</span>
            <span style={val}>
              {commune?.wilaya?.name ?? <span style={faint}>—</span>}
              {commune?.wilaya?.code && <span style={{ ...faint, marginLeft: 5 }}>({commune.wilaya.code})</span>}
            </span>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={lbl}>Adresse</span>
            <span style={desk.address ? val : { ...val, ...faint }}>{desk.address ?? "Non renseignée"}</span>
          </div>
          <div>
            <span style={lbl}>Latitude</span>
            <span style={{ ...val, fontFamily: desk.lat != null ? "monospace" : "inherit", ...(desk.lat == null ? faint : {}) }}>
              {desk.lat ?? "—"}
            </span>
          </div>
          <div>
            <span style={lbl}>Longitude</span>
            <span style={{ ...val, fontFamily: desk.lng != null ? "monospace" : "inherit", ...(desk.lng == null ? faint : {}) }}>
              {desk.lng ?? "—"}
            </span>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={lbl}>Téléphone</span>
            <span style={{ ...val, fontFamily: desk.phone ? "monospace" : "inherit", ...(desk.phone ? {} : faint) }}>
              {desk.phone ?? "—"}
            </span>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "12px 20px", borderTop: `1px solid ${t.border}`,
        }}>
          <button onClick={onClose} style={{
            background: "none", border: `1px solid ${t.border}`, borderRadius: 7,
            padding: "7px 16px", fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer",
          }}>Fermer</button>
          <button onClick={() => { onClose(); onAssign(); }} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.09)",
            border: "1px solid rgba(139,92,246,0.25)", borderRadius: 7,
            padding: "7px 14px", fontSize: 13, fontWeight: 600, color: "#8b5cf6", cursor: "pointer",
          }}>
            <Users size={13} /> Utilisateurs
          </button>
          <button onClick={() => { onClose(); onEdit(); }} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#f97316", border: "none", borderRadius: 7,
            padding: "7px 16px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
          }}>
            <Pencil size={12} /> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── StopDeskModal ───────────────────────────────────────── */
interface StopDeskModalProps {
  t: Tokens;
  isDark: boolean;
  wilayas: Wilaya[];
  communes: Commune[];
  allDesks: StopDesk[];
  initial?: StopDesk;
  onClose: () => void;
  onSaved: (d: StopDesk) => void;
}

function StopDeskModal({ t, isDark, wilayas, communes, allDesks, initial, onClose, onSaved }: StopDeskModalProps) {
  const isEdit = !!initial;

  const initialCommune  = initial ? communes.find(c => c.id === initial.commune_id) : undefined;
  const initWilayaId    = initialCommune?.wilaya_id?.toString() ?? wilayas[0]?.id.toString() ?? "";

  // Derive initial role from existing data
  const initRole = (() => {
    if (!initial) return "hub" as const;
    if (initial.type === "hub") return "hub" as const;
    if (!initial.parent_sd_id) return "autonome" as const;
    const parent = allDesks.find(d => d.id === initial.parent_sd_id);
    if (parent?.type === "hub") return "relais" as const;
    return "commune" as const;
  })();
  type SDRole = "hub" | "relais" | "commune" | "autonome";
  const [role,          setRole]        = useState<SDRole>(initRole);
  const [parentSdId,    setParentSdId]  = useState<string>(initial?.parent_sd_id?.toString() ?? "");

  // Derive type from role
  const type: DeskType = role === "hub" ? "hub" : "agence";
  const [code,          setCode]        = useState(initial?.code ?? "");
  const [name,          setName]        = useState(initial?.name ?? "");
  const [filterWilayaId,setFW]          = useState(initWilayaId);
  const [communeId,     setCommuneId]   = useState<string>(initial?.commune_id.toString() ?? "");
  const [address,       setAddress]     = useState(initial?.address ?? "");
  const [lat,           setLat]         = useState(initial?.lat != null ? String(initial.lat) : "");
  const [lng,           setLng]         = useState(initial?.lng != null ? String(initial.lng) : "");
  const [isActive,      setIsActive]    = useState(initial?.is_active ?? true);
  const [phone,         setPhone]       = useState(initial?.phone ?? "");
  const [capacity,      setCapacity]    = useState(initial?.colis_capacity != null ? String(initial.colis_capacity) : "");
  const [saving,        setSaving]      = useState(false);
  const [error,         setError]       = useState("");
  const [autoCreateCaisse, setAutoCreateCaisse] = useState(!isEdit);
  const nameRef = useRef<HTMLInputElement>(null);

  const filteredCommunes = filterWilayaId
    ? communes.filter(c => c.wilaya_id.toString() === filterWilayaId)
    : communes;

  // Resolve wilaya name for a desk via communes array
  const getWilayaName = (d: StopDesk) => {
    const c = d.commune ?? communes.find(c => c.id === d.commune_id);
    const w = c?.wilaya ?? wilayas.find(w => w.id === c?.wilaya_id);
    return w?.name ?? "";
  };

  // Hub list (for "relais" role parent selector)
  const hubCandidates = allDesks.filter(d => d.type === "hub" && d.id !== initial?.id);
  // Sub-SD list (for "commune" role parent selector) — non-hub SDs that have a parent (= they belong to a hub)
  const subSdCandidates = allDesks.filter(d => d.type !== "hub" && d.parent_sd_id !== null && d.id !== initial?.id);

  // Clear parent when role changes
  useEffect(() => {
    if (role === "hub" || role === "autonome") setParentSdId("");
  }, [role]);

  // Auto-select first commune when wilaya changes (create mode)
  useEffect(() => {
    if (!isEdit && filteredCommunes.length > 0) {
      setCommuneId(filteredCommunes[0].id.toString());
    } else if (!isEdit) {
      setCommuneId("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterWilayaId]);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    if (!name.trim())         { setError("Le nom est obligatoire.");       return; }
    if (!isEdit && !communeId){ setError("Sélectionnez une commune.");     return; }
    setSaving(true); setError("");

    const parsedLat = lat.trim() ? parseFloat(lat) : null;
    const parsedLng = lng.trim() ? parseFloat(lng) : null;

    const parsedCapacity = capacity.trim() ? parseInt(capacity) : null;

    // Validate parent is selected for relais/commune roles
    if ((role === "relais" || role === "commune") && !parentSdId) {
      setError(role === "relais" ? "Sélectionnez un Hub." : "Sélectionnez un point relais.");
      setSaving(false);
      return;
    }
    const parentId = (role === "hub" || role === "autonome") ? null : (parentSdId ? parseInt(parentSdId) : null);

    const r = isEdit
      ? await updateStopDesk(initial!.id, {
          parent_sd_id: parentId,
          type, code: code.trim() || null,
          name: name.trim(), address: address.trim() || null,
          phone: phone.trim() || null,
          lat: parsedLat, lng: parsedLng, is_active: isActive,
          colis_capacity: parsedCapacity,
        })
      : await createStopDesk({
          commune_id: parseInt(communeId), parent_sd_id: parentId, type,
          code: code.trim() || null, name: name.trim(),
          address: address.trim() || null, phone: phone.trim() || null,
          lat: parsedLat, lng: parsedLng, colis_capacity: parsedCapacity,
        });

    if (r.success && r.data) {
      // Auto-create caisse for the new stop desk
      if (!isEdit && autoCreateCaisse) {
        await createCaisse({
          name: `Caisse ${r.data.name}`,
          stop_desk_id: r.data.id,
          is_active: true,
        });
      }
      onSaved(r.data); onClose();
    }
    else setError("Une erreur est survenue.");
    setSaving(false);
  }

  const field = inpStyle(t);
  const secLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.08em",
    marginBottom: 10, display: "block",
  };
  const fieldLabel: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: t.label, marginBottom: 5, display: "block",
  };
  const secDiv: React.CSSProperties = {
    borderTop: `1px solid ${t.border}`, paddingTop: 16,
  };

  const editCommune = isEdit
    ? (communes.find(c => c.id === initial!.commune_id) ?? initial?.commune)
    : null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50, background: t.overlay,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, border: `1px solid ${t.border}`,
        borderRadius: 12, width: "100%", maxWidth: 520,
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        fontFamily: "var(--font-jakarta, sans-serif)",
        display: "flex", flexDirection: "column",
        maxHeight: "calc(100vh - 48px)",
      }}>

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${t.border}`, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: isDark ? "#333" : "#f3f4f6",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Store size={15} color={t.textMuted} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>
                {isEdit ? "Modifier le Stop Desk" : "Nouveau Stop Desk"}
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>
                {isEdit ? `Édition · ${initial!.name}` : "Remplissez les informations du point"}
              </p>
            </div>
          </div>
          <IconBtn onClick={onClose} title="Fermer"><X size={16} color={t.textMuted} /></IconBtn>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* § 1 — Rôle dans le réseau */}
          <div>
            <span style={secLabel}>Rôle dans le réseau <span style={{ color: "#ef4444", fontWeight: 700 }}>*</span></span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {([
                { key: "hub" as SDRole, icon: Network, color: "#10b981", bg: "rgba(16,185,129,0.09)", label: "Hub", desc: "Centre de tri principal d'une wilaya" },
                { key: "relais" as SDRole, icon: Building2, color: "#3b82f6", bg: "rgba(59,130,246,0.09)", label: "Point relais", desc: "Rattaché directement à un Hub" },
                { key: "commune" as SDRole, icon: Store, color: "#f59e0b", bg: "rgba(245,158,11,0.09)", label: "Point de commune", desc: "Rattaché à un point relais" },
                { key: "autonome" as SDRole, icon: MapPin, color: "#6b7280", bg: "rgba(107,114,128,0.09)", label: "Autonome", desc: "Point indépendant, non rattaché" },
              ] as const).map(opt => {
                const sel = role === opt.key;
                const Icon = opt.icon;
                return (
                  <div key={opt.key}>
                    <button
                      onClick={() => setRole(opt.key)}
                      style={{
                        width: "100%", textAlign: "left",
                        border: `1.5px solid ${sel ? opt.color : t.border}`,
                        borderRadius: sel && (opt.key === "relais" || opt.key === "commune") ? "8px 8px 0 0" : 8,
                        padding: "12px 14px",
                        background: sel ? opt.bg : (isDark ? "#1e1e1e" : "#fafafa"),
                        cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 12,
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        background: sel ? `${opt.color}20` : (isDark ? "#2a2a2a" : "#e5e7eb"),
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={17} color={sel ? opt.color : t.textMuted} strokeWidth={1.8} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? opt.color : t.text, display: "block" }}>
                          {opt.label}
                        </span>
                        <span style={{ fontSize: 11, color: t.textMuted }}>{opt.desc}</span>
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${sel ? opt.color : t.border}`,
                        background: sel ? opt.color : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {sel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                    </button>

                    {/* Inline parent selector for relais */}
                    {sel && opt.key === "relais" && (
                      <div style={{
                        padding: "10px 14px", borderRadius: "0 0 8px 8px",
                        border: `1.5px solid ${opt.color}`, borderTop: "none",
                        background: isDark ? "#1a2332" : "#f0f7ff",
                      }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: opt.color, marginBottom: 5, display: "block" }}>
                          Rattaché au Hub :
                        </label>
                        <select
                          value={parentSdId}
                          onChange={e => setParentSdId(e.target.value)}
                          style={{ ...field, appearance: "auto" as any, fontSize: 13 }}
                        >
                          <option value="">— Sélectionner un Hub —</option>
                          {hubCandidates.map(d => {
                            const wn = getWilayaName(d);
                            return <option key={d.id} value={d.id}>{d.name}{wn ? ` · ${wn}` : ""}</option>;
                          })}
                        </select>
                        {hubCandidates.length === 0 && (
                          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#ef4444" }}>Aucun Hub disponible. Créez d'abord un Hub.</p>
                        )}
                      </div>
                    )}

                    {/* Inline parent selector for commune */}
                    {sel && opt.key === "commune" && (
                      <div style={{
                        padding: "10px 14px", borderRadius: "0 0 8px 8px",
                        border: `1.5px solid ${opt.color}`, borderTop: "none",
                        background: isDark ? "#1f1d14" : "#fffbf0",
                      }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: opt.color, marginBottom: 5, display: "block" }}>
                          Rattaché au point relais :
                        </label>
                        <select
                          value={parentSdId}
                          onChange={e => setParentSdId(e.target.value)}
                          style={{ ...field, appearance: "auto" as any, fontSize: 13 }}
                        >
                          <option value="">— Sélectionner un point relais —</option>
                          {subSdCandidates.map(d => {
                            const wn = getWilayaName(d);
                            const hubName = allDesks.find(p => p.id === d.parent_sd_id)?.name;
                            return <option key={d.id} value={d.id}>{d.name}{hubName ? ` (${hubName})` : ""}{wn ? ` · ${wn}` : ""}</option>;
                          })}
                          {/* Also allow direct hub children to show under hubs */}
                          {hubCandidates.length > 0 && subSdCandidates.length === 0 && (
                            <optgroup label="Ou directement sous un Hub">
                              {hubCandidates.map(d => {
                                const wn = getWilayaName(d);
                                return <option key={d.id} value={d.id}>{d.name}{wn ? ` · ${wn}` : ""}</option>;
                              })}
                            </optgroup>
                          )}
                        </select>
                        {subSdCandidates.length === 0 && hubCandidates.length === 0 && (
                          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#ef4444" }}>Aucun point relais disponible. Créez d'abord un Hub puis un point relais.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* § 2 — Identification */}
          <div style={secDiv}>
            <span style={secLabel}>Identification</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
              <div>
                <label style={fieldLabel}>Code</label>
                <input
                  style={{ ...field, fontFamily: "monospace", letterSpacing: "0.04em" }}
                  value={code} onChange={e => setCode(e.target.value)}
                  placeholder="SD-001" maxLength={20}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
                />
              </div>
              <div>
                <label style={fieldLabel}>Nom <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  ref={nameRef} style={field}
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="ex. Agence Centre-Ville"
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
                />
              </div>
            </div>
          </div>

          {/* § 3 — Localisation */}
          <div style={secDiv}>
            <span style={secLabel}>Localisation</span>

            {isEdit ? (
              /* Edit: commune read-only */
              <div style={{ marginBottom: 12 }}>
                <label style={fieldLabel}>Commune</label>
                <div style={{
                  ...field,
                  background: t.inpReadonly,
                  color: t.textSub, cursor: "not-allowed",
                  display: "flex", flexDirection: "column", gap: 2,
                }}>
                  <span style={{ fontWeight: 500 }}>{editCommune?.name ?? "—"}</span>
                  {editCommune?.wilaya && (
                    <span style={{ fontSize: 11, color: t.textMuted }}>
                      {editCommune.wilaya.name}{(editCommune.wilaya as any).code ? ` · ${(editCommune.wilaya as any).code}` : ""}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* Create: wilaya cascade → commune */
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={fieldLabel}>Wilaya</label>
                  <select
                    value={filterWilayaId}
                    onChange={e => setFW(e.target.value)}
                    style={{ ...field, appearance: "auto", background: t.inp.bg, color: t.inp.text, padding: "8px 11px" }}
                  >
                    <option value="">Toutes</option>
                    {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Commune <span style={{ color: "#ef4444" }}>*</span></label>
                  <select
                    value={communeId}
                    onChange={e => setCommuneId(e.target.value)}
                    style={{ ...field, appearance: "auto", background: t.inp.bg, color: t.inp.text, padding: "8px 11px" }}
                  >
                    <option value="">— Sélectionner —</option>
                    {filteredCommunes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label style={fieldLabel}>Adresse</label>
              <input
                style={field} value={address} onChange={e => setAddress(e.target.value)}
                placeholder="ex. Rue Didouche Mourad, Alger"
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
              />
            </div>
          </div>

          {/* § 4 — Coordonnées GPS */}
          <div style={secDiv}>
            <span style={secLabel}>Coordonnées GPS</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={fieldLabel}>Latitude</label>
                <input
                  style={field} value={lat} onChange={e => setLat(e.target.value)}
                  type="number" step="any" placeholder="36.7372"
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
                />
              </div>
              <div>
                <label style={fieldLabel}>Longitude</label>
                <input
                  style={field} value={lng} onChange={e => setLng(e.target.value)}
                  type="number" step="any" placeholder="3.0860"
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
                />
              </div>
            </div>
          </div>

          {/* § 5 — Paramètres */}
          <div style={secDiv}>
            <span style={secLabel}>Paramètres</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Active toggle */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 8,
                background: isDark ? "#1e1e1e" : "#f9fafb",
                border: `1px solid ${t.border}`,
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>Point actif</span>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>
                    {isActive ? "Visible et opérationnel" : "Désactivé temporairement"}
                  </p>
                </div>
                <div
                  onClick={() => setIsActive(p => !p)}
                  style={{
                    width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                    background: isActive ? "#10b981" : (isDark ? "#444" : "#d1d5db"),
                    position: "relative", cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    left: isActive ? 21 : 3,
                    width: 16, height: 16, borderRadius: "50%", background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    transition: "left 0.18s",
                  }} />
                </div>
              </div>

              {/* Capacity slider */}
              <div>
                <style>{`
                  .sd-cap-slider {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 100%;
                    height: 5px;
                    border-radius: 3px;
                    outline: none;
                    cursor: pointer;
                    display: block;
                  }
                  .sd-cap-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #ffffff;
                    border: 2.5px solid #f97316;
                    box-shadow: 0 1px 5px rgba(249,115,22,0.35), 0 1px 3px rgba(0,0,0,0.12);
                    cursor: pointer;
                    transition: transform 0.12s, box-shadow 0.12s;
                  }
                  .sd-cap-slider::-webkit-slider-thumb:hover {
                    transform: scale(1.22);
                    box-shadow: 0 2px 10px rgba(249,115,22,0.45), 0 1px 4px rgba(0,0,0,0.15);
                  }
                  .sd-cap-slider::-webkit-slider-thumb:active {
                    transform: scale(1.08);
                  }
                  .sd-cap-slider::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #ffffff;
                    border: 2.5px solid #f97316;
                    box-shadow: 0 1px 5px rgba(249,115,22,0.35);
                    cursor: pointer;
                  }
                  .sd-cap-slider::-moz-range-track {
                    height: 5px;
                    border-radius: 3px;
                  }
                  .sd-cap-slider:focus { outline: none; }
                `}</style>

                {/* Label + live value badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <label style={fieldLabel}>Capacité colis</label>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: parseInt(capacity || "0") > 0 ? "#f97316" : t.textFaint,
                    background: parseInt(capacity || "0") > 0
                      ? "rgba(249,115,22,0.1)"
                      : (isDark ? "rgba(255,255,255,0.04)" : "#f3f4f6"),
                    padding: "3px 11px", borderRadius: 20, display: "inline-block",
                    border: `1px solid ${parseInt(capacity || "0") > 0 ? "rgba(249,115,22,0.22)" : t.border}`,
                    minWidth: 84, textAlign: "center", transition: "all 0.2s",
                  }}>
                    {parseInt(capacity || "0") > 0 ? `${capacity} colis` : "Non définie"}
                  </span>
                </div>

                {/* Slider track */}
                <input
                  type="range" min="0" max="2000" step="50"
                  value={capacity || "0"}
                  onChange={e => setCapacity(e.target.value)}
                  className="sd-cap-slider"
                  style={{
                    background: `linear-gradient(to right, #f97316 ${(parseInt(capacity || "0") / 2000) * 100}%, ${isDark ? "#2a3145" : "#e5e7eb"} ${(parseInt(capacity || "0") / 2000) * 100}%)`,
                  }}
                />

                {/* Tick labels */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
                  {([0, 500, 1000, 1500, 2000] as const).map(tick => {
                    const cur = parseInt(capacity || "0");
                    const lit = tick > 0 && cur >= tick;
                    return (
                      <span
                        key={tick}
                        onClick={() => setCapacity(tick === 0 ? "" : String(tick))}
                        style={{
                          fontSize: 10, cursor: "pointer", userSelect: "none",
                          color: lit ? "#f97316" : t.textFaint,
                          fontWeight: lit ? 700 : 400,
                          transition: "color 0.2s",
                        }}
                      >
                        {tick === 0 ? "0" : tick >= 1000 ? `${tick / 1000}k` : tick}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Téléphone */}
              <div>
                <label style={fieldLabel}>Téléphone</label>
                <input
                  style={field} value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="ex. 0555 123 456" type="tel"
                  onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
                  onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
                />
              </div>

              {/* Auto-create caisse (create mode only) */}
              {!isEdit && (
                <div
                  onClick={() => setAutoCreateCaisse(p => !p)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                    background: autoCreateCaisse
                      ? (isDark ? "rgba(249,115,22,0.08)" : "rgba(249,115,22,0.04)")
                      : (isDark ? "#1e1e1e" : "#f9fafb"),
                    border: `1px solid ${autoCreateCaisse ? "rgba(249,115,22,0.3)" : t.border}`,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    border: `2px solid ${autoCreateCaisse ? "#f97316" : t.border}`,
                    background: autoCreateCaisse ? "#f97316" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s",
                  }}>
                    {autoCreateCaisse && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Banknote size={13} color={autoCreateCaisse ? "#f97316" : t.textMuted} strokeWidth={1.8} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: autoCreateCaisse ? "#f97316" : t.text }}>
                        Créer une caisse automatiquement
                      </span>
                    </div>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>
                      Une caisse sera créée et assignée à ce stop desk
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 12, color: "#ef4444", padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.07)" }}>
              {error}
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "14px 20px", borderTop: `1px solid ${t.border}`, flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            background: "none", border: `1px solid ${t.border}`, borderRadius: 7,
            padding: "8px 16px", fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer",
          }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#f97316", border: "none", borderRadius: 7,
            padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff",
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
          }}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */
export default function StopDeskPage() {
  const isDark = useIsDark();
  const t      = useTokens(isDark);

  const [wilayas, setWilayas]           = useState<Wilaya[]>([]);
  const [communes, setCommunes]         = useState<Commune[]>([]);
  const [desks, setDesks]               = useState<StopDesk[]>([]);
  const [communesLoading, setCLoading]  = useState(true);
  const [desksLoading, setDLoading]     = useState(false);
  const [filterWilaya, setFilterW]      = useState<string>("all");
  const [filterCommune, setFilterC]     = useState<string>("all");
  const [filterType, setFilterType]     = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch]             = useState("");
  const [filterCaisse, setFilterCaisse] = useState<string>("all");
  const [viewMode, setViewMode]         = useState<"list" | "network">("list");
  const [showModal, setShowModal]       = useState(false);
  const [editDesk, setEditDesk]         = useState<StopDesk | null>(null);
  const [viewDesk, setViewDesk]         = useState<StopDesk | null>(null);
  const [assignDesk, setAssignDesk]     = useState<StopDesk | null>(null);
  const [communeDesk, setCommuneDesk]   = useState<StopDesk | null>(null);
  const [caissesList, setCaissesList]   = useState<Caisse[]>([]);
  const [caisseTargetDesk, setCaisseTargetDesk] = useState<StopDesk | null>(null);
  const [creatingCaisse, setCreatingCaisse] = useState(false);

  // Set of SD IDs that have an active caisse assigned
  const sdWithCaisse = new Set(caissesList.filter(c => c.stop_desk_id && c.is_active).map(c => c.stop_desk_id!));
  const sdWithAnyCaisse = new Set(caissesList.filter(c => c.stop_desk_id).map(c => c.stop_desk_id!));

  function loadCaisses() {
    getCaisses().then(r => { if (r.success && r.data) setCaissesList(r.data); });
  }

  useEffect(() => {
    getWilayas({ full: true }).then(r => { if (r.success && r.data) setWilayas(r.data); });
    loadCaisses();
  }, []);

  useEffect(() => {
    if (wilayas.length === 0) return;
    setCLoading(true);
    const wById = new Map(wilayas.map(w => [Number(w.id), w]));
    const attach = (list: Commune[]): Commune[] =>
      list
        .map(c => {
          const w = wById.get(Number(c.wilaya_id));
          return w ? { ...c, wilaya: { id: w.id, name: w.name, code: w.code } } : c;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    // "all" → ONE bulk call (avoids a 55-request storm that trips the rate limiter);
    // a specific wilaya → a single scoped call.
    const req = filterWilaya === "all" ? getAllCommunes() : getCommunes(Number(filterWilaya));
    req.then(r => {
      setCommunes(r.success && r.data ? attach(r.data) : []);
      setFilterC("all");
      setCLoading(false);
    });
  }, [wilayas, filterWilaya]);

  useEffect(() => {
    if (communesLoading) return;
    setDLoading(true);
    // "all" → ONE bulk call (was a per-commune storm up to ~1400 requests → 429);
    // a specific commune → a single scoped call.
    const req = filterCommune === "all" ? getAllStopDesks() : getStopDesks(Number(filterCommune));
    req.then(r => {
      const all: StopDesk[] = r.success && r.data ? [...r.data] : [];
      all.sort((a, b) => a.name.localeCompare(b.name));
      setDesks(all);
      setDLoading(false);
    });
  }, [filterCommune, communesLoading]);

  const [toggling, setToggling] = useState<Set<number>>(new Set());

  async function handleToggleActive(d: StopDesk) {
    setToggling(p => new Set(p).add(d.id));
    setDesks(p => p.map(x => x.id === d.id ? { ...x, is_active: !x.is_active } : x));
    const r = await updateStopDesk(d.id, {
      type: d.type, code: d.code, name: d.name,
      address: d.address, phone: d.phone,
      lat: d.lat, lng: d.lng, is_active: !d.is_active,
      colis_capacity: d.colis_capacity,
    });
    if (!r.success) setDesks(p => p.map(x => x.id === d.id ? { ...x, is_active: d.is_active } : x));
    setToggling(p => { const n = new Set(p); n.delete(d.id); return n; });
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer ce stop desk ?")) return;
    const r = await deleteStopDesk(id);
    if (r.success) setDesks(p => p.filter(d => d.id !== id));
  }

  async function handleQuickCreateCaisse(desk: StopDesk) {
    setCreatingCaisse(true);
    const res = await createCaisse({
      name: `Caisse ${desk.name}`,
      stop_desk_id: desk.id,
      is_active: true,
    });
    setCreatingCaisse(false);
    if (res.success) {
      loadCaisses();
      setCaisseTargetDesk(null);
    }
  }

  const isLoading = communesLoading || desksLoading;

  // Derive network role for a desk
  function getDeskRole(d: StopDesk): "hub" | "relais" | "commune" | "autonome" {
    if (d.type === "hub") return "hub";
    if (!d.parent_sd_id) return "autonome";
    const parent = desks.find(p => p.id === d.parent_sd_id);
    if (parent?.type === "hub") return "relais";
    return "commune";
  }

  const filteredDesks = desks.filter(d => {
    if (filterWilaya !== "all" && Number(d.commune?.wilaya_id) !== Number(filterWilaya)) return false;
    if (filterCommune !== "all" && Number(d.commune_id) !== Number(filterCommune)) return false;
    if (filterType !== "all" && getDeskRole(d) !== filterType) return false;
    if (filterStatus === "active"   &&  !d.is_active) return false;
    if (filterStatus === "inactive" &&   d.is_active) return false;
    if (filterCaisse === "with"    && !sdWithAnyCaisse.has(d.id)) return false;
    if (filterCaisse === "without" &&  sdWithAnyCaisse.has(d.id)) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!d.name.toLowerCase().includes(q) && !(d.code ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const hasActiveFilters = search.trim() !== "" || filterType !== "all" || filterStatus !== "all" || filterCaisse !== "all" || filterWilaya !== "all" || filterCommune !== "all";

  function resetFilters() {
    setSearch(""); setFilterType("all"); setFilterStatus("all"); setFilterCaisse("all"); setFilterW("all"); setFilterC("all");
  }

  const th: React.CSSProperties = {
    padding: "10px 14px", fontSize: 11, fontWeight: 600,
    color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.07em",
    borderBottom: `1px solid ${t.border}`, textAlign: "left", background: t.card,
  };
  const td: React.CSSProperties = {
    padding: "11px 14px", fontSize: 13,
    borderBottom: `1px solid ${t.divider}`,
    verticalAlign: "middle", color: t.textSub,
  };

  return (
    <div style={{ width: "100%", fontFamily: "var(--font-jakarta, sans-serif)" }}>

      {showModal && (
        <StopDeskModal
          t={t} isDark={isDark} wilayas={wilayas} communes={communes} allDesks={desks}
          onClose={() => setShowModal(false)}
          onSaved={d => { setDesks(p => [...p, d].sort((a, b) => a.name.localeCompare(b.name))); loadCaisses(); }}
        />
      )}

      {editDesk && (
        <StopDeskModal
          t={t} isDark={isDark} wilayas={wilayas} communes={communes} allDesks={desks} initial={editDesk}
          onClose={() => setEditDesk(null)}
          onSaved={d => {
            setDesks(p => p.map(x => x.id === d.id ? d : x));
            setEditDesk(null);
          }}
        />
      )}
      {communeDesk && (
        <CommuneAssignModal t={t} isDark={isDark} sd={communeDesk} onClose={() => setCommuneDesk(null)} />
      )}

      {viewDesk && (
        <StopDeskDetailModal
          t={t} isDark={isDark} desk={viewDesk}
          commune={communes.find(c => c.id === viewDesk.commune_id)}
          onClose={() => setViewDesk(null)}
          onEdit={() => setEditDesk(viewDesk)}
          onAssign={() => setAssignDesk(viewDesk)}
        />
      )}

      {assignDesk && (
        <UserAssignmentModal
          t={t} isDark={isDark} desk={assignDesk}
          onClose={() => setAssignDesk(null)}
        />
      )}

      {/* Quick-create caisse modal */}
      {caisseTargetDesk && (
        <div onClick={() => !creatingCaisse && setCaisseTargetDesk(null)} style={{
          position: "fixed", inset: 0, zIndex: 50, background: t.overlay,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: t.modalBg, border: `1px solid ${t.border}`,
            borderRadius: 12, width: "100%", maxWidth: 420,
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            fontFamily: "var(--font-jakarta, sans-serif)", overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "16px 20px", borderBottom: `1px solid ${t.border}`,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: "rgba(249,115,22,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Banknote size={15} color="#f97316" strokeWidth={1.8} />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>
                  Créer une caisse
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>
                  Pour {caisseTargetDesk.name}
                </p>
              </div>
              <IconBtn onClick={() => setCaisseTargetDesk(null)} title="Fermer">
                <X size={16} color={t.textMuted} />
              </IconBtn>
            </div>
            <div style={{ padding: "18px 20px" }}>
              <p style={{ margin: 0, fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>
                Une caisse <strong style={{ color: "#f97316" }}>Caisse {caisseTargetDesk.name}</strong> sera
                créée et assignée automatiquement à ce stop desk.
              </p>
              <div style={{
                marginTop: 14, padding: "10px 12px", borderRadius: 8,
                background: isDark ? "rgba(249,115,22,0.06)" : "rgba(249,115,22,0.04)",
                border: "1px solid rgba(249,115,22,0.15)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Check size={13} color="#f97316" />
                <span style={{ fontSize: 12, color: t.textMuted }}>
                  La caisse sera active immédiatement
                </span>
              </div>
            </div>
            <div style={{
              display: "flex", justifyContent: "flex-end", gap: 8,
              padding: "14px 20px", borderTop: `1px solid ${t.border}`,
            }}>
              <button
                onClick={() => setCaisseTargetDesk(null)}
                disabled={creatingCaisse}
                style={{
                  background: "none", border: `1px solid ${t.border}`, borderRadius: 7,
                  padding: "8px 16px", fontSize: 13, fontWeight: 500, color: t.textSub,
                  cursor: creatingCaisse ? "not-allowed" : "pointer",
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => handleQuickCreateCaisse(caisseTargetDesk)}
                disabled={creatingCaisse}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "#f97316", border: "none", borderRadius: 7,
                  padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff",
                  cursor: creatingCaisse ? "not-allowed" : "pointer",
                  opacity: creatingCaisse ? 0.7 : 1,
                }}
              >
                {creatingCaisse && <Loader2 size={13} className="animate-spin" />}
                {creatingCaisse ? "Création…" : "Créer la caisse"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text }}>Stop Desks</h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: t.textMuted }}>
            {hasActiveFilters
              ? <>{filteredDesks.length} résultat{filteredDesks.length !== 1 ? "s" : ""} <span style={{ color: t.textFaint }}>/ {desks.length} au total</span></>
              : <>{desks.length} point{desks.length !== 1 ? "s" : ""}</>
            }
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* View mode toggle */}
          <div style={{
            display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${t.border}`,
          }}>
            {([["list", "Liste", Store], ["network", "Réseau", Network]] as const).map(([mode, label, Icon]) => (
              <button key={mode} onClick={() => setViewMode(mode as "list" | "network")} style={{
                padding: "7px 14px", border: "none", fontSize: 12, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                background: viewMode === mode ? "rgba(249,115,22,0.12)" : "transparent",
                color: viewMode === mode ? "#f97316" : t.textMuted,
                transition: "all 150ms",
              }}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowModal(true)}
            disabled={communes.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: communes.length === 0 ? (isDark ? "#444" : "#e5e7eb") : "#f97316",
              border: "none", borderRadius: 7, padding: "8px 14px",
              fontSize: 13, fontWeight: 600,
              color: communes.length === 0 ? t.textMuted : "#fff",
              cursor: communes.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            <Plus size={14} /> Nouveau Stop Desk
          </button>
        </div>
      </div>

      {/* ═══ Network Tree View ═══ */}
      {viewMode === "network" && (
        <div style={{
          background: t.card, border: `1px solid ${t.border}`, borderRadius: 12,
          boxShadow: t.shadow, padding: 24,
        }}>
          {(() => {
            const hubs = desks.filter(d => d.type === "hub");
            const unassigned = desks.filter(d => d.type !== "hub" && !d.parent_sd_id);
            const getChildren = (parentId: number) => desks.filter(d => d.parent_sd_id === parentId);

            const nodeStyle = (level: number, color: string, bg: string): React.CSSProperties => ({
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10,
              background: bg, border: `1px solid ${color}25`,
              marginBottom: 6, marginLeft: level * 32,
              transition: "all 150ms",
            });

            const renderNode = (d: StopDesk, level: number) => {
              const dType = (d.type ?? "agence") as DeskType;
              const cfg = TYPE_CONFIG[dType];
              const commune = communes.find(c => c.id === d.commune_id);
              const wilaya = commune ? wilayas.find(w => w.id === commune.wilaya_id) : null;
              const children = getChildren(d.id);

              return (
                <div key={d.id}>
                  <div style={nodeStyle(level, cfg.color, cfg.bg)}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                      background: `${cfg.color}20`, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <cfg.Icon size={16} color={cfg.color} strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{d.name}</span>
                        {d.code && <span style={{ fontSize: 11, color: t.textFaint, fontFamily: "monospace" }}>{d.code}</span>}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`,
                        }}>{cfg.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>
                        {commune?.name ?? "—"}{wilaya ? ` · ${wilaya.name}` : ""}
                        {children.length > 0 && <span style={{ marginLeft: 8, color: cfg.color, fontWeight: 600 }}>({children.length} sous-points)</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <IconBtn onClick={() => setCommuneDesk(d)} title="Communes desservies"><MapPin size={13} color="#f97316" /></IconBtn>
                      <IconBtn onClick={() => setEditDesk(d)} title="Modifier"><Pencil size={13} color={t.textMuted} /></IconBtn>
                    </div>
                  </div>
                  {children.map(child => renderNode(child, level + 1))}
                </div>
              );
            };

            return (
              <div>
                {hubs.length === 0 && unassigned.length === 0 && (
                  <div style={{ textAlign: "center", padding: 40, color: t.textMuted, fontSize: 13 }}>
                    Aucun stop desk. Créez un HUB pour commencer.
                  </div>
                )}

                {hubs.map(hub => renderNode(hub, 0))}

                {unassigned.length > 0 && (
                  <div style={{ marginTop: hubs.length > 0 ? 24 : 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: t.textMuted,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      marginBottom: 10, paddingLeft: 4,
                    }}>
                      Non rattachés ({unassigned.length})
                    </div>
                    {unassigned.map(d => renderNode(d, 0))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Filters */}
      {viewMode === "list" && <><div style={{
        background: t.card, border: `1px solid ${t.border}`, borderRadius: 10,
        padding: "14px 16px", marginBottom: 16, boxShadow: t.shadow,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {/* Row 1: search + location dropdowns */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
            <Search size={13} color={t.textMuted} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou code…"
              style={{
                ...selStyle(t), width: "100%", paddingLeft: 30, boxSizing: "border-box",
                fontSize: 13,
              }}
            />
          </div>
          {/* Wilaya */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <MapPin size={13} color={t.textMuted} />
            <select value={filterWilaya} onChange={e => setFilterW(e.target.value)} style={selStyle(t)}>
              <option value="all">Toutes les wilayas</option>
              {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {/* Commune */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Store size={13} color={t.textMuted} />
            <select value={filterCommune} onChange={e => setFilterC(e.target.value)} style={selStyle(t)}>
              <option value="all">Toutes les communes</option>
              {communes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: type + status pill toggles + reset */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {/* Type pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2 }}>Rôle</span>
            {([
              { val: "all",      label: "Tous",            icon: null,     color: isDark ? "#a0a0a0" : "#6b7280", bg: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
              { val: "hub",      label: "Hub",             icon: Network,  color: "#10b981", bg: "rgba(16,185,129,0.09)" },
              { val: "relais",   label: "Point relais",    icon: Building2, color: "#3b82f6", bg: "rgba(59,130,246,0.09)" },
              { val: "commune",  label: "Pt. commune",     icon: Store,    color: "#f59e0b", bg: "rgba(245,158,11,0.09)" },
              { val: "autonome", label: "Autonome",        icon: MapPin,   color: "#6b7280", bg: "rgba(107,114,128,0.09)" },
            ] as const).map(opt => {
              const active = filterType === opt.val;
              const Icon = opt.icon;
              return (
                <button key={opt.val} onClick={() => setFilterType(opt.val)} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
                  border: `1px solid ${active ? opt.color : t.border}`,
                  background: active ? opt.bg : "transparent",
                  color: active ? opt.color : t.textMuted,
                  cursor: "pointer", transition: "all 0.12s",
                }}>
                  {Icon && <Icon size={10} strokeWidth={2} />}
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 16, background: t.border, flexShrink: 0 }} />

          {/* Status pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2 }}>Statut</span>
            {([["all", "Tous", t.textMuted, t.border], ["active", "Actif", "#10b981", "rgba(16,185,129,0.25)"], ["inactive", "Inactif", "#ef4444", "rgba(239,68,68,0.25)"]] as const).map(([val, label, color, border]) => {
              const active = filterStatus === val;
              return (
                <button key={val} onClick={() => setFilterStatus(val)} style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
                  border: `1px solid ${active ? border : t.border}`,
                  background: active ? (val === "active" ? "rgba(16,185,129,0.09)" : val === "inactive" ? "rgba(239,68,68,0.09)" : "transparent") : "transparent",
                  color: active ? color : t.textMuted,
                  cursor: "pointer", transition: "all 0.12s",
                }}>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 16, background: t.border, flexShrink: 0 }} />

          {/* Caisse pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginRight: 2 }}>Caisse</span>
            {([
              ["all",     "Tous",  t.textMuted, t.border],
              ["with",    "Avec",  "#f97316",   "rgba(249,115,22,0.25)"],
              ["without", "Sans",  "#ef4444",   "rgba(239,68,68,0.25)"],
            ] as const).map(([val, label, color, border]) => {
              const active = filterCaisse === val;
              return (
                <button key={val} onClick={() => setFilterCaisse(val)} style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
                  border: `1px solid ${active ? border : t.border}`,
                  background: active ? (val === "with" ? "rgba(249,115,22,0.09)" : val === "without" ? "rgba(239,68,68,0.09)" : "transparent") : "transparent",
                  color: active ? color : t.textMuted,
                  cursor: "pointer", transition: "all 0.12s",
                }}>
                  {val === "with" && <Banknote size={10} strokeWidth={2} />}
                  {val === "without" && <XCircle size={10} strokeWidth={2} />}
                  {label}
                </button>
              );
            })}
          </div>

          {/* Reset */}
          {hasActiveFilters && (
            <button onClick={resetFilters} style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
              border: `1px solid ${t.border}`, background: "transparent",
              color: t.textMuted, cursor: "pointer",
            }}>
              <RotateCcw size={11} /> Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 10, boxShadow: t.shadow, overflow: "hidden",
      }}>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Nom &amp; Code</th>
              <th style={th}>Rôle</th>
              <th style={th}>Parent</th>
              <th style={{ ...th, textAlign: "center" }}>Statut</th>
              <th style={{ ...th, textAlign: "center" }}>Caisse</th>
              <th style={th}>Commune / Wilaya</th>
              <th style={th}>Adresse</th>
              <th style={th}>Téléphone</th>
              <th style={th}>Métriques</th>
              <th style={{ ...th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>

            {isLoading && (
              <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: 32, color: t.textMuted }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </div>
              </td></tr>
            )}

            {!isLoading && filteredDesks.length === 0 && (
              <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: 40, color: t.textFaint }}>
                {hasActiveFilters
                  ? "Aucun résultat pour ces filtres."
                  : "Aucun stop desk. Cliquez sur « Nouveau Stop Desk » pour en ajouter un."
                }
              </td></tr>
            )}

            {!isLoading && filteredDesks.map(d => {
              const commune = communes.find(c => c.id === d.commune_id);
              const deskType = (d.type ?? "agence") as DeskType;
              const cfg = TYPE_CONFIG[deskType];

              return (
                <tr
                  key={d.id}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = t.rowHover}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  style={{ transition: "background 0.1s" }}
                >
                  {/* Nom + Code */}
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                        background: cfg.bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <cfg.Icon size={14} color={cfg.color} strokeWidth={1.8} />
                      </div>
                      <div>
                        <span style={{ fontWeight: 500, color: t.text }}>{d.name}</span>
                        {d.code && (
                          <div style={{ fontFamily: "monospace", fontSize: 11, color: t.textFaint, marginTop: 1 }}>
                            {d.code}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Rôle */}
                  <td style={td}>
                    {(() => {
                      const r = getDeskRole(d);
                      const roleCfg = {
                        hub:      { label: "Hub",          icon: Network,  color: "#10b981", bg: "rgba(16,185,129,0.09)" },
                        relais:   { label: "Pt. relais",   icon: Building2, color: "#3b82f6", bg: "rgba(59,130,246,0.09)" },
                        commune:  { label: "Pt. commune",  icon: Store,    color: "#f59e0b", bg: "rgba(245,158,11,0.09)" },
                        autonome: { label: "Autonome",     icon: MapPin,   color: "#6b7280", bg: "rgba(107,114,128,0.09)" },
                      }[r];
                      const RIcon = roleCfg.icon;
                      return (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "3px 9px", borderRadius: 20,
                          fontSize: 11, fontWeight: 600,
                          background: roleCfg.bg, color: roleCfg.color,
                          border: `1px solid ${roleCfg.color}30`,
                        }}>
                          <RIcon size={10} strokeWidth={2} />
                          {roleCfg.label}
                        </span>
                      );
                    })()}
                  </td>

                  {/* Parent */}
                  <td style={td}>
                    {d.parent_sd_id ? (() => {
                      const p = desks.find(x => x.id === d.parent_sd_id);
                      if (!p) return <span style={{ color: t.textFaint }}>—</span>;
                      const pc = TYPE_CONFIG[(p.type ?? "agence") as DeskType];
                      return (
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                          <pc.Icon size={11} color={pc.color} strokeWidth={2} />
                          <span style={{ color: t.textSub }}>{p.name}</span>
                        </span>
                      );
                    })() : (
                      <span style={{ color: t.textFaint, fontSize: 12 }}>—</span>
                    )}
                  </td>

                  {/* Statut toggle */}
                  <td style={{ ...td, textAlign: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <button
                        onClick={e => { e.stopPropagation(); handleToggleActive(d); }}
                        disabled={toggling.has(d.id)}
                        title={d.is_active ? "Désactiver" : "Activer"}
                        style={{
                          width: 36, height: 20, borderRadius: 10, border: "none", padding: 0,
                          background: d.is_active ? "#10b981" : (isDark ? "#2a3145" : "#d1d5db"),
                          position: "relative", cursor: toggling.has(d.id) ? "not-allowed" : "pointer",
                          opacity: toggling.has(d.id) ? 0.55 : 1,
                          transition: "background 0.2s", flexShrink: 0,
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 3,
                          left: d.is_active ? 17 : 3,
                          width: 14, height: 14, borderRadius: "50%",
                          background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                          transition: "left 0.18s", display: "block",
                        }} />
                      </button>
                      <span style={{ fontSize: 10, fontWeight: 600, color: d.is_active ? "#10b981" : t.textMuted }}>
                        {d.is_active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                  </td>

                  {/* Caisse badge */}
                  <td style={{ ...td, textAlign: "center" }}>
                    {sdWithCaisse.has(d.id) ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 9px", borderRadius: 20,
                        fontSize: 10, fontWeight: 700,
                        background: "rgba(249,115,22,0.09)", color: "#f97316",
                        border: "1px solid rgba(249,115,22,0.22)",
                      }}>
                        <Banknote size={10} strokeWidth={2} />
                        Assignée
                      </span>
                    ) : sdWithAnyCaisse.has(d.id) ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 9px", borderRadius: 20,
                        fontSize: 10, fontWeight: 700,
                        background: "rgba(245,158,11,0.09)", color: "#f59e0b",
                        border: "1px solid rgba(245,158,11,0.22)",
                      }}>
                        <Banknote size={10} strokeWidth={2} />
                        Inactive
                      </span>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setCaisseTargetDesk(d); }}
                        title="Créer une caisse pour ce stop desk"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "3px 9px", borderRadius: 20,
                          fontSize: 10, fontWeight: 700,
                          background: "rgba(239,68,68,0.07)", color: "#ef4444",
                          border: "1px solid rgba(239,68,68,0.15)",
                          cursor: "pointer", transition: "all 0.12s",
                        }}
                      >
                        <Plus size={10} strokeWidth={2.5} />
                        Aucune
                      </button>
                    )}
                  </td>

                  {/* Commune / Wilaya */}
                  <td style={{ ...td, fontSize: 12 }}>
                    <span style={{ color: t.textSub }}>{commune?.name ?? "—"}</span>
                    {commune?.wilaya && (
                      <span style={{ color: t.textFaint, marginLeft: 5 }}>/ {commune.wilaya.name}</span>
                    )}
                  </td>

                  {/* Adresse */}
                  <td style={{ ...td, color: t.textMuted, fontSize: 12 }}>
                    {d.address ?? <span style={{ color: t.textFaint }}>—</span>}
                  </td>

                  {/* Téléphone */}
                  <td style={{ ...td, color: t.textMuted, fontFamily: "monospace", fontSize: 12 }}>
                    {d.phone ?? <span style={{ color: t.textFaint, fontFamily: "inherit" }}>—</span>}
                  </td>

                  {/* Métriques */}
                  <td style={td}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                        <Package size={10} color={t.textMuted} />
                        <span style={{ color: d.colis_capacity ? "#f97316" : t.textFaint, fontWeight: d.colis_capacity ? 600 : 400 }}>
                          {d.colis_capacity != null ? `${d.colis_capacity} colis` : "—"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                        <Users size={10} color={t.textMuted} />
                        <span style={{ color: t.textSub }}>
                          {d.users_count ?? 0} util.
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 2, justifyContent: "flex-end", alignItems: "center" }}>
                      <IconBtn onClick={() => setCommuneDesk(d)} title="Communes desservies">
                        <MapPin size={13} color="#f97316" />
                      </IconBtn>
                      <IconBtn onClick={() => setViewDesk(d)} title="Voir les détails">
                        <Eye size={13} color={t.textMuted} />
                      </IconBtn>
                      <IconBtn onClick={() => setEditDesk(d)} title="Modifier">
                        <Pencil size={13} color={t.textMuted} />
                      </IconBtn>
                      <IconBtn onClick={() => handleDelete(d.id)} title="Supprimer" danger>
                        <Trash2 size={13} />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></>}
    </div>
  );
}

/* ── Commune Assignment Modal ─────────────────────────────── */
function CommuneAssignModal({ t, isDark, sd, onClose }: { t: any; isDark: boolean; sd: any; onClose: () => void }) {
  const [assigned, setAssigned] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api<any>(`/stop-desks/${sd.id}/served-communes`).then(res => {
      if (res.success && res.data) {
        setAssigned(res.data.assigned ?? []);
        setAvailable(res.data.available ?? []);
      }
      setLoading(false);
    });
  }, [sd.id]);

  const assign = (commune: any) => {
    setAssigned(prev => [...prev, commune]);
    setAvailable(prev => prev.filter(c => c.id !== commune.id));
  };

  const unassign = (commune: any) => {
    setAvailable(prev => [...prev, commune].sort((a, b) => a.name.localeCompare(b.name)));
    setAssigned(prev => prev.filter(c => c.id !== commune.id));
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await api(`/stop-desks/${sd.id}/served-communes`, {
      method: "PUT",
      body: JSON.stringify({ commune_ids: assigned.map((c: any) => c.id) }),
    });
    if (res.success) {
      setMsg("Enregistré");
      setTimeout(() => setMsg(""), 2000);
    } else {
      setMsg(res.message || "Erreur");
    }
    setSaving(false);
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: "pointer", transition: "all 0.15s",
    background: active ? "rgba(249,115,22,0.1)" : (isDark ? "#1e2130" : "#f3f4f6"),
    color: active ? "#ea580c" : (isDark ? "#d1d5db" : "#374151"),
    border: `1px solid ${active ? "#f97316" : (isDark ? "#2a3145" : "#e5e7eb")}`,
  });

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50, background: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: isDark ? "#111827" : "#fff", border: `1px solid ${isDark ? "#1e2130" : "#e5e7eb"}`,
        borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", padding: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: isDark ? "#f0f0f5" : "#111827" }}>
              Communes desservies
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: isDark ? "#6b7280" : "#9ca3af" }}>
              {sd.name} — même wilaya uniquement
            </p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: isDark ? "#6b7280" : "#9ca3af" }}>
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: isDark ? "#6b7280" : "#9ca3af" }}>Chargement...</div>
        ) : (
          <>
            {/* Assigned */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#6b7280" : "#9ca3af", textTransform: "uppercase", marginBottom: 6 }}>
                Assignées ({assigned.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {assigned.length === 0 && <span style={{ fontSize: 12, color: isDark ? "#4b5563" : "#d1d5db" }}>Aucune commune assignée</span>}
                {assigned.map((c: any) => (
                  <span key={c.id} onClick={() => unassign(c)} style={chipStyle(true)}>
                    {c.name} ✕
                  </span>
                ))}
              </div>
            </div>

            {/* Available */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#6b7280" : "#9ca3af", textTransform: "uppercase", marginBottom: 6 }}>
                Disponibles ({available.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {available.length === 0 && <span style={{ fontSize: 12, color: isDark ? "#4b5563" : "#d1d5db" }}>Toutes les communes sont assignées</span>}
                {available.map((c: any) => (
                  <span key={c.id} onClick={() => assign(c)} style={chipStyle(false)}>
                    + {c.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Save */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={handleSave} disabled={saving} style={{
                padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                background: "#f97316", color: "#fff", border: "none", cursor: "pointer",
                opacity: saving ? 0.6 : 1,
              }}>
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
              {msg && <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981" }}>{msg}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
