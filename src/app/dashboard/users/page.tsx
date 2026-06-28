"use client";

import React, { useState, useEffect, useCallback, useRef, type FormEvent } from "react";
import Link from "next/link";
import {
  Plus, Pencil, Trash2, X, Search, AlertCircle, Loader2,
  Phone, Mail, MapPin, Building2, Calendar, UserPlus, Package,
  Users, ShieldCheck, Truck, UserCog, ChevronRight, Car,
  Upload, FileCheck, Eye, Boxes, BarChart3, Code2,
} from "lucide-react";
import { getWilayas, getAllCommunes } from "@/lib/geography";
import type { Wilaya, Commune, StopDesk } from "@/lib/geography";
import { api, getStoredUser } from "@/lib/api";
import {
  getUsers, createUser, updateUser, toggleUserStatus, deleteUser,
  getClients, createClient, updateClient, deleteClient,
} from "@/lib/users";
import type { StaffUser, Client, PaginatedClients } from "@/lib/users";
import { getRoles, assignRole, type Role } from "@/lib/roles";

/* ── dark-mode hook ──────────────────────────────────────── */
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

/* ── design tokens ───────────────────────────────────────── */
function useTokens(isDark: boolean) {
  return isDark ? {
    card: "#111827", border: "#1e2130", divider: "#1e2130",
    rowHover: "#1a1f2e", text: "#f0f0f5", textSub: "#d1d5db",
    textMuted: "#6b7280", textFaint: "#4b5563",
    shadow: "none", modalBg: "#111827", overlay: "rgba(0,0,0,0.7)",
    inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
    label: "#6b7280", inpReadonly: "#111827", sectionBg: "#0f1623",
  } : {
    card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6",
    rowHover: "#fafafa", text: "#111827", textSub: "#374151",
    textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    modalBg: "#ffffff", overlay: "rgba(0,0,0,0.4)",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    label: "#6b7280", inpReadonly: "#f9fafb", sectionBg: "#f9fafb",
  };
}
type T = ReturnType<typeof useTokens>;

/* ── constants ───────────────────────────────────────────── */
const TABS = [
  { id: "admin",             label: "Admins",       Icon: ShieldCheck, color: "#3b82f6" },
  { id: "operator",          label: "Opérateurs",   Icon: UserCog,     color: "#f59e0b" },
  { id: "responsable",       label: "Responsables", Icon: Users,       color: "#10b981" },
  { id: "expediteur",        label: "Expéditeurs",  Icon: Truck,       color: "#f43f5e" },
  { id: "chauffeur",         label: "Livreurs",     Icon: Car,         color: "#0ea5e9" },
  { id: "transit_chauffeur", label: "Transit",      Icon: Truck,       color: "#6366f1" },
  { id: "clients",           label: "Clients",      Icon: Package,     color: "#8b5cf6" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const ROLE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  admin:             { color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  label: "Admin"             },
  operator:          { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  label: "Opérateur"         },
  responsable:       { color: "#10b981", bg: "rgba(16,185,129,0.1)",  label: "Responsable"       },
  expediteur:        { color: "#f43f5e", bg: "rgba(244,63,94,0.1)",   label: "Expéditeur"        },
  chauffeur:         { color: "#0ea5e9", bg: "rgba(14,165,233,0.1)",  label: "Livreur"           },
  transit_chauffeur: { color: "#6366f1", bg: "rgba(99,102,241,0.1)",  label: "Transit"           },
};

const STATUS_CFG = {
  active:    { label: "Actif",    dot: "#10b981", chip: "rgba(16,185,129,0.1)",  text: "#059669" },
  inactive:  { label: "Inactif",  dot: "#9ca3af", chip: "rgba(156,163,175,0.1)", text: "#6b7280" },
  suspended: { label: "Suspendu", dot: "#ef4444", chip: "rgba(239,68,68,0.1)",   text: "#dc2626" },
};

const NEW_LABELS: Record<string, string> = {
  admin: "Nouvel Admin", operator: "Nouvel Opérateur",
  responsable: "Nouveau Responsable", expediteur: "Nouvel Expéditeur",
  chauffeur: "Nouveau Livreur", transit_chauffeur: "Nouveau Transit",
  clients: "Nouveau Client",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-DZ", { day: "2-digit", month: "short", year: "numeric" });
}
function getInitials(f: string, l: string) {
  return `${f[0] ?? ""}${l[0] ?? ""}`.toUpperCase();
}

/* ── style helpers ───────────────────────────────────────── */
function inpStyle(t: T, focused = false): React.CSSProperties {
  return {
    width: "100%", background: t.inp.bg,
    border: `1.5px solid ${focused ? "#f97316" : t.inp.border}`,
    borderRadius: 9, padding: "10px 13px", fontSize: 13, lineHeight: "1.4",
    color: t.inp.text, outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxSizing: "border-box", minHeight: 42,
    boxShadow: focused ? "0 0 0 3px rgba(249,115,22,0.12)" : "none",
  };
}
function selStyle(t: T): React.CSSProperties {
  return {
    width: "100%", background: t.inp.bg, border: `1.5px solid ${t.inp.border}`,
    borderRadius: 9, padding: "10px 13px", fontSize: 13,
    color: t.inp.text, outline: "none", cursor: "pointer",
    appearance: "auto" as React.CSSProperties["appearance"],
    minHeight: 42, boxSizing: "border-box",
  };
}

/* ── primitives ──────────────────────────────────────────── */
function IconBtn({ onClick, title, danger, children }: {
  onClick: () => void; title?: string; danger?: boolean; children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? "rgba(239,68,68,0.1)" : "rgba(0,0,0,0.06)") : "transparent",
        border: "none", borderRadius: 6, padding: "6px 7px", cursor: "pointer",
        color: danger ? "#ef4444" : "inherit",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.12s",
      }}
    >{children}</button>
  );
}

function Avatar({ first, last, role, size = 32 }: {
  first: string; last: string; role: string; size?: number;
}) {
  const rc = ROLE_CFG[role] ?? { color: "#9ca3af", bg: "rgba(156,163,175,0.1)" };
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
      background: rc.bg, border: `1.5px solid ${rc.color}28`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: size * 0.36, fontWeight: 700, color: rc.color, letterSpacing: "-0.01em" }}>
        {getInitials(first, last)}
      </span>
    </div>
  );
}

function StatusChip({ status, onClick }: { status: string; onClick?: () => void }) {
  const [hov, setHov] = useState(false);
  const s = STATUS_CFG[status as keyof typeof STATUS_CFG] ?? STATUS_CFG.inactive;
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
        background: s.chip, color: s.text, border: "none",
        cursor: onClick ? "pointer" : "default",
        opacity: hov && onClick ? 0.7 : 1,
        transition: "opacity 0.1s", whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {s.label}
    </button>
  );
}

function StatusSegment({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: T }) {
  const opts = [
    { v: "active",    label: "Actif",    color: "#10b981" },
    { v: "inactive",  label: "Inactif",  color: "#6b7280" },
    { v: "suspended", label: "Suspendu", color: "#ef4444" },
  ];
  return (
    <div style={{
      display: "inline-flex", borderRadius: 20, overflow: "hidden",
      border: `1.5px solid ${t.border}`, background: t.sectionBg,
    }}>
      {opts.map((o, i) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          style={{
            padding: "5px 16px", fontSize: 12, fontWeight: 600,
            background: value === o.v ? o.color : "transparent",
            color: value === o.v ? "#fff" : t.textMuted,
            border: "none", cursor: "pointer",
            borderRight: i < 2 ? `1px solid ${t.border}` : "none",
            transition: "all 0.15s",
          }}
        >{o.label}</button>
      ))}
    </div>
  );
}

/* ── File Upload Field ───────────────────────────────────── */
function FileUploadField({ t, label, existingUrl, onChange }: {
  t: T; label: string; existingUrl?: string | null;
  onChange: (file: File | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [hov, setHov] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    onChange(f);
  }

  const hasNew = !!file;
  const hasExisting = !!existingUrl && !hasNew;

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: t.label, display: "block", marginBottom: 6 }}>{label}</label>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleChange} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => ref.current?.click()}
          onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 500,
            border: `1.5px dashed ${hov ? "#f97316" : t.inp.border}`,
            background: hov ? "rgba(249,115,22,0.04)" : t.inp.bg,
            color: hov ? "#f97316" : t.textMuted,
            cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
          }}
        >
          <Upload size={12} /> {hasNew ? "Changer" : "Téléverser"}
        </button>
        {hasNew && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#059669" }}>
            <FileCheck size={12} />
            <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file!.name}</span>
            <button type="button"
              onClick={() => { setFile(null); onChange(null); if (ref.current) ref.current.value = ""; }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0, lineHeight: 1, display: "flex" }}
            ><X size={11} /></button>
          </div>
        )}
        {hasExisting && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#059669" }}>
            <FileCheck size={12} />
            <span>Fichier existant</span>
            <a href={`/storage/${existingUrl}`} target="_blank" rel="noopener noreferrer"
              style={{ color: "#0ea5e9", textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>
              <Eye size={11} /> Voir
            </a>
          </div>
        )}
        {!hasNew && !hasExisting && (
          <span style={{ fontSize: 11, color: t.textFaint }}>PDF, JPG, PNG · max 5 Mo</span>
        )}
      </div>
    </div>
  );
}

/* ── Modal shell ─────────────────────────────────────────── */
function Modal({ t, title, onClose, children, wide, accentColor }: {
  t: T; title: string; onClose: () => void; children: React.ReactNode;
  wide?: boolean; accentColor?: string;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const ac = accentColor ?? "#f97316";

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50, background: t.overlay,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, backdropFilter: "blur(3px)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, border: `1px solid ${t.border}`,
        borderRadius: 16, width: "100%", maxWidth: wide ? 580 : 520,
        boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.1)",
        fontFamily: "var(--font-jakarta, sans-serif)",
        display: "flex", flexDirection: "column",
        maxHeight: "calc(100vh - 40px)", overflow: "hidden",
      }}>
        {/* Gradient header with accent tint */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px", borderBottom: `1px solid ${t.border}`, flexShrink: 0,
          background: `linear-gradient(135deg, ${ac}14 0%, ${ac}06 100%)`,
          borderRadius: "16px 16px 0 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: ac, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>{title}</span>
          </div>
          <IconBtn onClick={onClose} title="Fermer"><X size={16} color={t.textMuted} /></IconBtn>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Section label + Field ───────────────────────────────── */
function SecLabel({ label, t, accentColor }: { label: string; t: T; accentColor?: string }) {
  const ac = accentColor ?? "#f97316";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
      <div style={{ width: 3, height: 12, borderRadius: 2, background: ac, flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: ac }}>
        {label}
      </p>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", display: "block", marginBottom: 5 }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

/* ── Save Button ─────────────────────────────────────────── */
function SaveBtn({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button disabled={saving} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        background: saving ? "#e46c10" : hov ? "#e8680e" : "#f97316",
        border: "none", borderRadius: 9, padding: "9px 22px",
        fontSize: 13, fontWeight: 600, color: "#fff",
        cursor: saving ? "not-allowed" : "pointer",
        transition: "background 0.15s, box-shadow 0.15s",
        minWidth: 140, justifyContent: "center",
        boxShadow: hov && !saving ? "0 4px 14px rgba(249,115,22,0.35)" : "none",
      }}
    >
      {saving && <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />}
      {saving ? "Enregistrement…" : "Enregistrer"}
    </button>
  );
}

/* ── Toggle switch ───────────────────────────────────────── */
function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: "relative", width: 40, height: 22, borderRadius: 22, flexShrink: 0,
        border: "none", padding: 0,
        background: checked ? "#f97316" : "#cbd5e1",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background 0.18s ease",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: checked ? 20 : 2,
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        transition: "left 0.18s ease",
      }} />
    </button>
  );
}

function FocusInput({ t, ...props }: { t: T } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [foc, setFoc] = useState(false);
  return (
    <input {...props} style={inpStyle(t, foc)}
      onFocus={e => { setFoc(true); props.onFocus?.(e); }}
      onBlur={e => { setFoc(false); props.onBlur?.(e); }}
    />
  );
}

/* ── Commune Picker (shared by chauffeur + transit) ──────── */
function CommunePicker({ t, accentColor, wilayas, communes, communeWilayaFilter, onFilterChange, selectedIds, prices, onToggle, onPriceChange, sectionCard }: {
  t: T; accentColor: string;
  wilayas: Wilaya[]; communes: Commune[];
  communeWilayaFilter: string; onFilterChange: (v: string) => void;
  selectedIds: number[]; prices: Record<number, string>;
  onToggle: (id: number) => void; onPriceChange: (id: number, val: string) => void;
  sectionCard: React.CSSProperties;
}) {
  const [wilayaSearch, setWilayaSearch] = useState("");
  const [wilayaOpen, setWilayaOpen] = useState(false);
  const [communeSearch, setCommuneSearch] = useState("");
  const [hoveredChip, setHoveredChip] = useState<number | null>(null);
  const [hoveredWilaya, setHoveredWilaya] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setWilayaOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const wilayaSelected = !!communeWilayaFilter;
  const selectedWilaya = wilayas.find(w => String(w.id) === communeWilayaFilter);

  const filteredWilayas = wilayas.filter(w =>
    !wilayaSearch ||
    w.name.toLowerCase().includes(wilayaSearch.toLowerCase()) ||
    (w.code && w.code.toLowerCase().includes(wilayaSearch.toLowerCase()))
  );

  const communesInWilaya = wilayaSelected
    ? communes.filter(c => c.wilaya_id === Number(communeWilayaFilter))
    : [];

  const visibleCommunes = communeSearch
    ? communesInWilaya.filter(c => c.name.toLowerCase().includes(communeSearch.toLowerCase()))
    : communesInWilaya;

  const selectedInWilaya = communesInWilaya.filter(c => selectedIds.includes(c.id)).length;

  function clearWilaya() {
    onFilterChange("");
    setCommuneSearch("");
    setWilayaSearch("");
  }

  return (
    <div style={sectionCard}>
      <SecLabel label="Communes assignées" t={t} accentColor={accentColor} />

      {/* ── Step 1: Wilaya search picker ── */}
      <div ref={dropdownRef} style={{ position: "relative", marginBottom: wilayaSelected ? 12 : 0 }}>
        {wilayaSelected ? (
          /* Selected wilaya chip */
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px", borderRadius: 9,
            background: `${accentColor}12`, border: `1.5px solid ${accentColor}40`,
          }}>
            <MapPin size={13} color={accentColor} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: accentColor }}>
              {selectedWilaya?.name}
              {selectedWilaya?.code && (
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 5, opacity: 0.7 }}>
                  ({selectedWilaya.code})
                </span>
              )}
            </span>
            <button type="button" onClick={clearWilaya} style={{
              background: "none", border: "none", cursor: "pointer",
              color: accentColor, padding: 2, display: "flex", opacity: 0.7, flexShrink: 0,
              borderRadius: 4, transition: "opacity 0.12s",
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            {/* Search input */}
            <div style={{ position: "relative" }}>
              <Search size={13} color={wilayaOpen ? accentColor : t.textMuted}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", transition: "color 0.15s" }} />
              <input
                type="text"
                value={wilayaSearch}
                onChange={e => { setWilayaSearch(e.target.value); setWilayaOpen(true); }}
                onFocus={() => setWilayaOpen(true)}
                placeholder="Rechercher une wilaya…"
                style={{
                  width: "100%", background: t.inp.bg,
                  border: `1.5px solid ${wilayaOpen ? accentColor : t.inp.border}`,
                  borderRadius: wilayaOpen && filteredWilayas.length > 0 ? "9px 9px 0 0" : 9,
                  padding: "10px 13px 10px 36px", fontSize: 13, color: t.inp.text,
                  outline: "none", boxSizing: "border-box", minHeight: 42,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxShadow: wilayaOpen ? `0 0 0 3px ${accentColor}14` : "none",
                  fontFamily: "var(--font-jakarta, sans-serif)",
                }}
              />
            </div>

            {/* Dropdown list */}
            {wilayaOpen && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
                background: t.inp.bg, border: `1.5px solid ${accentColor}`,
                borderTop: `1px solid ${t.border}`, borderRadius: "0 0 9px 9px",
                maxHeight: 210, overflowY: "auto",
                boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
              }}>
                {filteredWilayas.length === 0 ? (
                  <p style={{ margin: 0, padding: "12px 14px", fontSize: 12, color: t.textFaint }}>
                    Aucune wilaya trouvée.
                  </p>
                ) : filteredWilayas.map(w => (
                  <button key={w.id} type="button"
                    onMouseEnter={() => setHoveredWilaya(w.id)}
                    onMouseLeave={() => setHoveredWilaya(null)}
                    onClick={() => {
                      onFilterChange(String(w.id));
                      setWilayaSearch("");
                      setWilayaOpen(false);
                    }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: "9px 14px", background: hoveredWilaya === w.id ? `${accentColor}0e` : "transparent",
                      border: "none", borderBottom: `1px solid ${t.divider}`,
                      cursor: "pointer", fontSize: 13, color: t.text, textAlign: "left",
                      transition: "background 0.1s",
                    }}
                  >
                    <span>{w.name}</span>
                    {w.code && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: hoveredWilaya === w.id ? accentColor : t.textFaint,
                        letterSpacing: "0.05em", transition: "color 0.1s",
                      }}>{w.code}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {!wilayaOpen && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: t.textFaint, fontStyle: "italic" }}>
                Recherchez et sélectionnez une wilaya pour voir ses communes.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Step 2: Commune chips ── */}
      {wilayaSelected && (
        <div>
          {/* Commune search + selection count */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={11} color={t.textMuted}
                style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                type="text"
                value={communeSearch}
                onChange={e => setCommuneSearch(e.target.value)}
                placeholder={`Filtrer les ${communesInWilaya.length} communes…`}
                style={{
                  width: "100%", background: t.sectionBg,
                  border: `1px solid ${t.border}`, borderRadius: 7,
                  padding: "6px 10px 6px 27px", fontSize: 12, color: t.inp.text,
                  outline: "none", boxSizing: "border-box",
                  fontFamily: "var(--font-jakarta, sans-serif)",
                }}
              />
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
              flexShrink: 0, letterSpacing: "0.02em",
              background: selectedInWilaya > 0 ? `${accentColor}18` : t.sectionBg,
              color: selectedInWilaya > 0 ? accentColor : t.textFaint,
              border: `1px solid ${selectedInWilaya > 0 ? `${accentColor}30` : t.border}`,
              transition: "all 0.15s",
            }}>
              {selectedInWilaya} / {communesInWilaya.length}
            </span>
          </div>

          {/* Chips */}
          {visibleCommunes.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {visibleCommunes.map(c => {
                const active = selectedIds.includes(c.id);
                const hov = hoveredChip === c.id;
                return (
                  <button key={c.id} type="button"
                    onClick={() => onToggle(c.id)}
                    onMouseEnter={() => setHoveredChip(c.id)}
                    onMouseLeave={() => setHoveredChip(null)}
                    style={{
                      padding: "5px 13px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                      border: `1.5px solid ${active ? accentColor : hov ? `${accentColor}60` : t.inp.border}`,
                      background: active ? `${accentColor}18` : hov ? `${accentColor}08` : t.inp.bg,
                      color: active ? accentColor : hov ? accentColor : t.textMuted,
                      cursor: "pointer",
                      transform: hov && !active ? "translateY(-1px)" : "none",
                      boxShadow: active ? `0 0 0 2px ${accentColor}22` : hov ? `0 2px 8px ${accentColor}20` : "none",
                      transition: "all 0.12s ease",
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: t.textFaint }}>
              {communeSearch ? "Aucun résultat." : "Aucune commune pour cette wilaya."}
            </p>
          )}
        </div>
      )}

      {/* ── Price table ── */}
      {selectedIds.length > 0 && (
        <div style={{
          marginTop: 14, borderRadius: 8, overflow: "hidden",
          border: `1px solid ${t.border}`,
        }}>
          {/* Table header */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 100px 30px",
            padding: "6px 12px", background: t.sectionBg,
            borderBottom: `1px solid ${t.border}`,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Commune
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Prix (DA)
            </span>
            <span />
          </div>

          {/* Rows */}
          {selectedIds.map((id, idx) => {
            const c = communes.find(x => x.id === id);
            if (!c) return null;
            return (
              <div key={id} style={{
                display: "grid", gridTemplateColumns: "1fr 100px 30px",
                alignItems: "center", padding: "7px 12px",
                borderBottom: idx < selectedIds.length - 1 ? `1px solid ${t.divider}` : "none",
                background: "transparent",
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 500, color: accentColor,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8,
                }}>
                  {c.name}
                  {c.wilaya && <span style={{ fontSize: 10, color: t.textFaint, marginLeft: 5 }}>{c.wilaya.name}</span>}
                </span>
                <input
                  type="number" min="0" step="0.01"
                  value={prices[id] ?? ""}
                  onChange={e => onPriceChange(id, e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: "100%", background: t.inp.bg, border: `1px solid ${t.inp.border}`,
                    borderRadius: 6, padding: "5px 8px", fontSize: 12, fontWeight: 500,
                    color: t.inp.text, outline: "none", boxSizing: "border-box",
                    fontFamily: "var(--font-jakarta, sans-serif)",
                  }}
                />
                <button type="button" onClick={() => onToggle(id)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: t.textFaint, padding: 2, display: "flex", justifyContent: "center",
                  transition: "color 0.12s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                  onMouseLeave={e => (e.currentTarget.style.color = t.textFaint)}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Docs Viewer Modal ───────────────────────────────────── */
function DocsModal({ t, user, onClose }: { t: T; user: StaffUser; onClose: () => void }) {
  const rc = ROLE_CFG[user.user_type] ?? { color: "#f97316", label: user.user_type };
  const docs: { label: string; path: string | null | undefined }[] = [
    { label: "Registre de Commerce", path: user.rc_file },
    { label: "NIF",                  path: user.nif_file },
    { label: "NIS",                  path: user.nis_file },
    { label: "Permis de conduire",   path: user.permis_file },
    { label: "CIN",                  path: user.cin_file },
  ].filter(d => d.path);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: 16, width: "100%", maxWidth: 420, boxShadow: "0 24px 60px rgba(0,0,0,0.22)", fontFamily: "var(--font-jakarta, sans-serif)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.border}`, background: `linear-gradient(135deg, ${rc.color}12 0%, ${rc.color}05 100%)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 16, borderRadius: 2, background: rc.color }} />
            <FileCheck size={14} color={rc.color} />
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Documents</span>
          </div>
          <IconBtn onClick={onClose}><X size={15} color={t.textMuted} /></IconBtn>
        </div>
        <div style={{ padding: "12px 20px 20px" }}>
          {docs.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <FileCheck size={28} color={t.textFaint} style={{ display: "block", margin: "0 auto 8px" }} />
              <p style={{ margin: 0, fontSize: 13, color: t.textFaint }}>Aucun document uploadé</p>
            </div>
          ) : docs.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < docs.length - 1 ? `1px solid ${t.divider}` : "none" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{d.label}</span>
              <a href={`/storage/${d.path}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#0ea5e9", textDecoration: "none", padding: "4px 10px", borderRadius: 8, background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)" }}>
                <Eye size={11} /> Voir
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Assign Stop Desk Modal ──────────────────────────────── */
function AssignSDModal({ t, user, stopDesks, wilayas, communes, onClose, onSaved }: {
  t: T; user: StaffUser; stopDesks: StopDesk[];
  wilayas: Wilaya[]; communes: Commune[];
  onClose: () => void; onSaved: () => void;
}) {
  const rc = ROLE_CFG[user.user_type] ?? { color: "#10b981" };
  const sel = selStyle(t);

  // Find current stop desk's commune+wilaya for initial state
  const currentSD = stopDesks.find(s => s.id === user.stop_desk_id);
  const currentCommune = currentSD ? communes.find(c => c.id === currentSD.commune_id) : undefined;

  const [selWilaya,    setSelWilaya]    = useState(currentCommune ? String(currentCommune.wilaya_id) : "");
  const [selCommune,   setSelCommune]   = useState(currentSD ? String(currentSD.commune_id) : "");
  const [selSD,        setSelSD]        = useState(user.stop_desk_id ? String(user.stop_desk_id) : "");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  // Wilayas that have at least one stop desk
  const wilayasWithSD = wilayas.filter(w =>
    stopDesks.some(sd => communes.find(c => c.id === sd.commune_id)?.wilaya_id === w.id)
  );
  // Communes in selected wilaya that have at least one stop desk
  const communesWithSD = selWilaya
    ? communes.filter(c => c.wilaya_id === Number(selWilaya) && stopDesks.some(sd => sd.commune_id === c.id))
    : [];
  // Stop desks in selected commune
  const sdsInCommune = selCommune
    ? stopDesks.filter(sd => sd.commune_id === Number(selCommune))
    : [];

  async function save() {
    setSaving(true); setError("");
    const res = await updateUser(user.id, {
      first_name: user.first_name, last_name: user.last_name,
      email: user.email, user_type: user.user_type, status: user.status,
      stop_desk_id: selSD ? Number(selSD) : null,
    });
    setSaving(false);
    if (res.success) { onSaved(); onClose(); }
    else setError((res as { message?: string }).message ?? "Erreur");
  }

  const step = !selWilaya ? 1 : !selCommune ? 2 : 3;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 24px 60px rgba(0,0,0,0.22)", fontFamily: "var(--font-jakarta, sans-serif)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.border}`, background: `linear-gradient(135deg, ${rc.color}12 0%, ${rc.color}05 100%)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 16, borderRadius: 2, background: rc.color }} />
            <Building2 size={14} color={rc.color} />
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Assigner Stop Desk</span>
            <span style={{ fontSize: 11, color: t.textMuted, fontWeight: 400 }}>— {user.first_name} {user.last_name}</span>
          </div>
          <IconBtn onClick={onClose}><X size={15} color={t.textMuted} /></IconBtn>
        </div>

        {/* Steps */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {error && <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", fontSize: 12, color: "#ef4444" }}>{error}</div>}

          {/* Step breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.textFaint }}>
            {["Wilaya", "Commune", "Stop Desk"].map((lbl, i) => (
              <React.Fragment key={lbl}>
                <span style={{ fontWeight: step > i + 1 ? 600 : step === i + 1 ? 700 : 400, color: step > i + 1 ? rc.color : step === i + 1 ? t.text : t.textFaint }}>{lbl}</span>
                {i < 2 && <ChevronRight size={10} color={t.textFaint} />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1 — Wilaya */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Wilaya</label>
            <div style={{ position: "relative" }}>
              <MapPin size={13} color={selWilaya ? rc.color : t.textMuted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", transition: "color 0.15s" }} />
              <select style={{ ...sel, paddingLeft: 32, border: `1.5px solid ${selWilaya ? rc.color + "60" : t.inp.border}` }}
                value={selWilaya}
                onChange={e => { setSelWilaya(e.target.value); setSelCommune(""); setSelSD(""); }}>
                <option value="">— Sélectionner une wilaya —</option>
                {wilayasWithSD.map(w => <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ""}</option>)}
              </select>
            </div>
          </div>

          {/* Step 2 — Commune */}
          <div style={{ opacity: !selWilaya ? 0.4 : 1, transition: "opacity 0.2s" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Commune</label>
            <div style={{ position: "relative" }}>
              <MapPin size={13} color={selCommune ? rc.color : t.textMuted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", transition: "color 0.15s" }} />
              <select style={{ ...sel, paddingLeft: 32, border: `1.5px solid ${selCommune ? rc.color + "60" : t.inp.border}` }}
                value={selCommune} disabled={!selWilaya}
                onChange={e => { setSelCommune(e.target.value); setSelSD(""); }}>
                <option value="">— Sélectionner une commune —</option>
                {communesWithSD.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Step 3 — Stop Desk */}
          <div style={{ opacity: !selCommune ? 0.4 : 1, transition: "opacity 0.2s" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Stop Desk</label>
            <div style={{ position: "relative" }}>
              <Building2 size={13} color={selSD ? rc.color : t.textMuted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", transition: "color 0.15s" }} />
              <select style={{ ...sel, paddingLeft: 32, border: `1.5px solid ${selSD ? rc.color + "60" : t.inp.border}` }}
                value={selSD} disabled={!selCommune}
                onChange={e => setSelSD(e.target.value)}>
                <option value="">— Sélectionner —</option>
                {sdsInCommune.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` · ${s.code}` : ""}{s.type ? ` (${s.type})` : ""}</option>)}
              </select>
            </div>
          </div>

          {/* Clear assignment */}
          {user.stop_desk_id && (
            <button type="button" onClick={() => { setSelWilaya(""); setSelCommune(""); setSelSD(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: t.textFaint, textAlign: "left", padding: 0, textDecoration: "underline", textUnderlineOffset: 2 }}>
              Retirer l&apos;assignation
            </button>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} style={{ background: "none", border: `1.5px solid ${t.border}`, borderRadius: 9, padding: "8px 16px", fontSize: 12, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, background: saving ? `${rc.color}99` : rc.color, border: "none", borderRadius: 9, padding: "8px 18px", fontSize: 12, fontWeight: 600, color: "#fff", cursor: saving ? "not-allowed" : "pointer" }}>
            {saving && <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />}
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Assign Wilaya Modal (expéditeur) ────────────────────── */
function AssignWilayaModal({ t, user, wilayas, onClose, onSaved }: { t: T; user: StaffUser; wilayas: Wilaya[]; onClose: () => void; onSaved: () => void }) {
  const rc = ROLE_CFG[user.user_type] ?? { color: "#f43f5e" };
  const [value, setValue] = useState(user.wilaya_id ? String(user.wilaya_id) : "");
  const [saving, setSaving] = useState(false);
  const sel = selStyle(t);

  async function save() {
    setSaving(true);
    const res = await updateUser(user.id, {
      first_name: user.first_name, last_name: user.last_name,
      email: user.email, user_type: user.user_type, status: user.status,
      wilaya_id: value ? Number(value) : null,
    });
    setSaving(false);
    if (res.success) { onSaved(); onClose(); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: 16, width: "100%", maxWidth: 380, boxShadow: "0 24px 60px rgba(0,0,0,0.22)", fontFamily: "var(--font-jakarta, sans-serif)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.border}`, background: `linear-gradient(135deg, ${rc.color}12 0%, ${rc.color}05 100%)` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 16, borderRadius: 2, background: rc.color }} />
            <MapPin size={14} color={rc.color} />
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Wilaya assignée</span>
          </div>
          <IconBtn onClick={onClose}><X size={15} color={t.textMuted} /></IconBtn>
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: t.textMuted }}>Wilaya pour <strong style={{ color: t.text }}>{user.first_name} {user.last_name}</strong></p>
          <div style={{ position: "relative" }}>
            <MapPin size={13} color={t.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <select style={{ ...sel, paddingLeft: 34 }} value={value} onChange={e => setValue(e.target.value)}>
              <option value="">— Aucune —</option>
              {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ""}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} style={{ background: "none", border: `1.5px solid ${t.border}`, borderRadius: 9, padding: "8px 16px", fontSize: 12, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, background: saving ? `${rc.color}99` : rc.color, border: "none", borderRadius: 9, padding: "8px 18px", fontSize: 12, fontWeight: 600, color: "#fff", cursor: saving ? "not-allowed" : "pointer" }}>
            {saving && <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} />}
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Vehicle & Docs Modal (drivers) ──────────────────────── */
function VehicleModal({ t, user, onClose, onSaved }: { t: T; user: StaffUser; onClose: () => void; onSaved: () => void }) {
  const rc = ROLE_CFG[user.user_type] ?? { color: "#0ea5e9" };
  const [form, setForm] = useState({
    vehicle_plate:    user.vehicle_plate    ?? "",
    vehicle_type:     user.vehicle_type     ?? "",
    vehicle_marque:   user.vehicle_marque   ?? "",
    permis_numero:    user.permis_numero    ?? "",
    permis_categorie: user.permis_categorie ?? "",
    cin_numero:       user.cin_numero       ?? "",
  });
  const [files, setFiles] = useState<Record<string, File | null>>({ permis_file: null, cin_file: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [k]: e.target.value }));
  const sel = selStyle(t);
  const sectionCard: React.CSSProperties = { background: t.sectionBg, borderRadius: 10, padding: "14px 16px", marginBottom: 10 };

  async function save() {
    setSaving(true); setError("");
    const hasFiles = Object.values(files).some(Boolean);
    const res = await updateUser(user.id, {
      first_name: user.first_name, last_name: user.last_name,
      email: user.email, user_type: user.user_type, status: user.status,
      wilaya_id: user.wilaya_id, stop_desk_id: user.stop_desk_id,
      vehicle_plate:    form.vehicle_plate    || null,
      vehicle_type:     form.vehicle_type     || null,
      vehicle_marque:   form.vehicle_marque   || null,
      permis_numero:    form.permis_numero    || null,
      permis_categorie: form.permis_categorie || null,
      cin_numero:       form.cin_numero       || null,
      communes: (user.communes ?? []).map(c => ({ id: c.id, price: c.pivot?.price ?? null })),
    }, hasFiles ? files : undefined);
    setSaving(false);
    if (res.success) { onSaved(); onClose(); }
    else setError((res as { message?: string }).message ?? "Erreur");
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(4px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "calc(100vh - 40px)", boxShadow: "0 24px 60px rgba(0,0,0,0.22)", fontFamily: "var(--font-jakarta, sans-serif)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.border}`, background: `linear-gradient(135deg, ${rc.color}12 0%, ${rc.color}05 100%)`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 16, borderRadius: 2, background: rc.color }} />
            <Car size={14} color={rc.color} />
            <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Véhicule & Documents</span>
          </div>
          <IconBtn onClick={onClose}><X size={15} color={t.textMuted} /></IconBtn>
        </div>
        <div style={{ overflowY: "auto", padding: 20 }}>
          {error && <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", marginBottom: 10, fontSize: 12, color: "#ef4444" }}>{error}</div>}
          <div style={sectionCard}>
            <SecLabel label="Véhicule" t={t} accentColor={rc.color} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Immatriculation"><FocusInput t={t} value={form.vehicle_plate} onChange={set("vehicle_plate")} placeholder="12345-123-16" /></Field>
                <Field label="Type">
                  <select style={sel} value={form.vehicle_type} onChange={set("vehicle_type")}>
                    <option value="">—</option>
                    <option value="moto">Moto</option>
                    <option value="voiture">Voiture</option>
                    <option value="camionette">Camionette</option>
                    <option value="camion">Camion</option>
                  </select>
                </Field>
              </div>
              <Field label="Marque / Modèle"><FocusInput t={t} value={form.vehicle_marque} onChange={set("vehicle_marque")} placeholder="Renault Symbol 2020" /></Field>
            </div>
          </div>
          <div style={sectionCard}>
            <SecLabel label="Permis & CIN" t={t} accentColor={rc.color} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="N° Permis"><FocusInput t={t} value={form.permis_numero} onChange={set("permis_numero")} placeholder="1234567" /></Field>
                <Field label="Catégorie">
                  <select style={sel} value={form.permis_categorie} onChange={set("permis_categorie")}>
                    <option value="">—</option>
                    {["A","B","C","D","E","F"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <FileUploadField t={t} label="Permis (scan)" existingUrl={user.permis_file} onChange={f => setFiles(p => ({ ...p, permis_file: f }))} />
              <Field label="N° CIN"><FocusInput t={t} value={form.cin_numero} onChange={set("cin_numero")} placeholder="123456789" /></Field>
              <FileUploadField t={t} label="CIN (scan)" existingUrl={user.cin_file} onChange={f => setFiles(p => ({ ...p, cin_file: f }))} />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "none", border: `1.5px solid ${t.border}`, borderRadius: 9, padding: "8px 16px", fontSize: 12, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>Annuler</button>
          <SaveBtn saving={saving} onClick={save} />
        </div>
      </div>
    </div>
  );
}

/* ── Commune Assign Modal ────────────────────────────────── */
function CommuneAssignModal({ t, accentColor, wilayas, communes, selectedIds, prices, onToggle, onPriceChange, onClose, user, onSaved }: {
  t: T; accentColor: string;
  wilayas: Wilaya[]; communes: Commune[];
  selectedIds: number[]; prices: Record<number, string>;
  onToggle: (id: number) => void; onPriceChange: (id: number, val: string) => void;
  onClose: () => void;
  user?: StaffUser; onSaved?: () => void;
}) {
  const [communeWilayaFilter, setCommuneWilayaFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const sectionCard: React.CSSProperties = { background: t.sectionBg, borderRadius: 10, padding: "14px 16px" };

  async function handleSave() {
    if (!user || !onSaved) { onClose(); return; }
    setSaving(true);
    const res = await updateUser(user.id, {
      first_name: user.first_name, last_name: user.last_name,
      email: user.email, user_type: user.user_type, status: user.status,
      wilaya_id: user.wilaya_id, stop_desk_id: user.stop_desk_id,
      communes: selectedIds.map(id => ({ id, price: prices[id] ? Number(prices[id]) : null })),
    });
    setSaving(false);
    if (res.success) { onSaved(); onClose(); }
  }
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, backdropFilter: "blur(4px)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, border: `1px solid ${t.border}`,
        borderRadius: 16, width: "100%", maxWidth: 560,
        boxShadow: "0 32px 80px rgba(0,0,0,0.28)",
        fontFamily: "var(--font-jakarta, sans-serif)",
        display: "flex", flexDirection: "column",
        maxHeight: "calc(100vh - 40px)", overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px", borderBottom: `1px solid ${t.border}`,
          background: `linear-gradient(135deg, ${accentColor}14 0%, ${accentColor}06 100%)`,
          borderRadius: "16px 16px 0 0", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: accentColor }} />
            <MapPin size={15} color={accentColor} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>
              Communes assignées
              {selectedIds.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: `${accentColor}18`, color: accentColor }}>
                  {selectedIds.length} sélectionnée{selectedIds.length > 1 ? "s" : ""}
                </span>
              )}
            </span>
          </div>
          <IconBtn onClick={onClose} title="Fermer"><X size={16} color={t.textMuted} /></IconBtn>
        </div>
        <div style={{ overflowY: "auto", padding: 20 }}>
          <CommunePicker
            t={t} accentColor={accentColor} wilayas={wilayas} communes={communes}
            communeWilayaFilter={communeWilayaFilter} onFilterChange={setCommuneWilayaFilter}
            selectedIds={selectedIds} prices={prices}
            onToggle={onToggle} onPriceChange={onPriceChange}
            sectionCard={sectionCard}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "14px 20px", borderTop: `1px solid ${t.border}`, flexShrink: 0, background: t.modalBg }}>
          <button onClick={user ? handleSave : onClose} disabled={saving} style={{
            display: "flex", alignItems: "center", gap: 7,
            background: saving ? `${accentColor}99` : accentColor, border: "none", borderRadius: 9, padding: "9px 22px",
            fontSize: 13, fontWeight: 600, color: "#fff", cursor: saving ? "not-allowed" : "pointer",
          }}>
            {saving && <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />}
            {saving ? "Enregistrement…" : (user ? "Enregistrer" : "Confirmer")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Staff Modal ─────────────────────────────────────────── */
type StaffForm = {
  first_name: string; last_name: string; email: string; phone: string;
  password: string; status: string; wilaya_id: string; stop_desk_id: string;
  company_name: string; registre_commerce: string; nif: string; nis: string;
  permis_numero: string; permis_categorie: string; cin_numero: string;
  vehicle_plate: string; vehicle_type: string; vehicle_marque: string;
  commune_ids: number[];
  commune_prices: Record<number, string>;
};

function StaffModal({ t, userType, editing, wilayas, communes, stopDesks, onClose, onSaved }: {
  t: T; userType: string; editing: StaffUser | null;
  wilayas: Wilaya[]; communes: Commune[]; stopDesks: StopDesk[];
  onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editing;
  const formRef = useRef<HTMLFormElement>(null);
  const [communeModalOpen, setCommuneModalOpen] = useState(false);

  // For commune assignment: operator sees only their wilaya, admin sees all
  const user = getStoredUser();
  const isOp = user?.user_type === "operator" || user?.user_type === "responsable";
  const opWilayaId = isOp && user?.stop_desk_id ? stopDesks.find(sd => sd.id === user.stop_desk_id)?.commune?.wilaya_id ?? null : null;
  const modalCommunes = opWilayaId ? communes.filter(c => c.wilaya_id === opWilayaId) : communes;
  const modalWilayas = opWilayaId ? wilayas.filter(w => w.id === opWilayaId) : wilayas;
  const [form, setForm] = useState<StaffForm>({
    first_name:        editing?.first_name ?? "",
    last_name:         editing?.last_name ?? "",
    email:             editing?.email ?? "",
    phone:             editing?.phone ?? "",
    password:          "",
    status:            editing?.status ?? "active",
    wilaya_id:         editing?.wilaya_id ? String(editing.wilaya_id) : "",
    stop_desk_id:      editing?.stop_desk_id ? String(editing.stop_desk_id) : (isOp && user?.stop_desk_id ? String(user.stop_desk_id) : ""),
    company_name:      editing?.company_name ?? "",
    registre_commerce: editing?.registre_commerce ?? "",
    nif:               editing?.nif ?? "",
    nis:               editing?.nis ?? "",
    permis_numero:     editing?.permis_numero ?? "",
    permis_categorie:  editing?.permis_categorie ?? "",
    cin_numero:        editing?.cin_numero ?? "",
    vehicle_plate:     editing?.vehicle_plate ?? "",
    vehicle_type:      editing?.vehicle_type ?? "",
    vehicle_marque:    editing?.vehicle_marque ?? "",
    commune_ids:    editing?.communes?.map(c => c.id) ?? [],
    commune_prices: Object.fromEntries(
      (editing?.communes ?? []).map(c => [c.id, c.pivot?.price != null ? String(c.pivot.price) : ""])
    ),
  });
  const [files, setFiles] = useState<Record<string, File | null>>({
    rc_file: null, nif_file: null, nis_file: null, permis_file: null, cin_file: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof StaffForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  const setFileField = (k: string) => (f: File | null) =>
    setFiles(p => ({ ...p, [k]: f }));

  const toggleCommune = (id: number) =>
    setForm(p => {
      const selected = p.commune_ids.includes(id);
      const commune_ids = selected ? p.commune_ids.filter(x => x !== id) : [...p.commune_ids, id];
      const commune_prices = { ...p.commune_prices };
      if (selected) delete commune_prices[id];
      return { ...p, commune_ids, commune_prices };
    });

  const setCommunePrice = (id: number, val: string) =>
    setForm(p => ({ ...p, commune_prices: { ...p.commune_prices, [id]: val } }));

  const rc = ROLE_CFG[userType] ?? { color: "#f97316", bg: "rgba(249,115,22,0.09)", label: userType };
  const isDriver = userType === "chauffeur";
  const isTransit = userType === "transit_chauffeur";
  const isExpediteur = userType === "expediteur";
  const isResponsable = userType === "responsable";
  const isOperator = userType === "operator";
  const sel = selStyle(t);
  const sectionCard: React.CSSProperties = { background: t.sectionBg, borderRadius: 10, padding: "14px 16px" };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) { setError("Prénom et nom obligatoires."); return; }
    if (!form.email.trim())                                 { setError("Email obligatoire."); return; }
    if (!isEdit && !form.password.trim())                   { setError("Mot de passe obligatoire."); return; }
    setError(""); setSaving(true);

    const payload = {
      first_name:        form.first_name.trim(),
      last_name:         form.last_name.trim(),
      email:             form.email.trim(),
      phone:             form.phone.trim() || null,
      user_type:         userType,
      status:            form.status,
      wilaya_id:         form.wilaya_id    ? Number(form.wilaya_id)    : null,
      stop_desk_id:      form.stop_desk_id ? Number(form.stop_desk_id) : null,
      company_name:      form.company_name.trim()      || null,
      registre_commerce: form.registre_commerce.trim() || null,
      nif:               form.nif.trim()               || null,
      nis:               form.nis.trim()               || null,
      permis_numero:     form.permis_numero.trim()     || null,
      permis_categorie:  form.permis_categorie         || null,
      cin_numero:        form.cin_numero.trim()        || null,
      vehicle_plate:     form.vehicle_plate.trim()     || null,
      vehicle_type:      form.vehicle_type             || null,
      vehicle_marque:    form.vehicle_marque.trim()    || null,
      communes: (isDriver || isTransit)
        ? form.commune_ids.map(id => ({
            id,
            price: form.commune_prices[id] ? Number(form.commune_prices[id]) : null,
          }))
        : undefined,
    };

    // Add password if provided (edit = optional, create = required)
    if (form.password.trim()) {
      (payload as any).password = form.password;
    }

    const hasFiles = Object.values(files).some(Boolean);
    const res = isEdit
      ? await updateUser(editing!.id, payload, hasFiles ? files : undefined)
      : await createUser({ ...payload, password: form.password }, hasFiles ? files : undefined);

    setSaving(false);
    if (res.success) { onSaved(); onClose(); }
    else setError((res as { message?: string }).message ?? "Erreur serveur");
  }

  return (
    <>
      {communeModalOpen && (
        <CommuneAssignModal
          t={t} accentColor={rc.color} wilayas={modalWilayas} communes={modalCommunes}
          selectedIds={form.commune_ids} prices={form.commune_prices}
          onToggle={toggleCommune} onPriceChange={setCommunePrice}
          onClose={() => setCommuneModalOpen(false)}
        />
      )}
      <Modal t={t} title={isEdit ? `Modifier — ${rc.label}` : `Nouveau — ${rc.label}`} onClose={onClose} wide={!isEdit && (isExpediteur || isDriver || isTransit)} accentColor={rc.color}>
      <form ref={formRef} onSubmit={submit} style={{ overflowY: "auto", padding: "20px 20px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 9, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", marginBottom: 4 }}>
            <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>
          </div>
        )}

        {/* Identité */}
        <div style={sectionCard}>
          <SecLabel label="Identité" t={t} accentColor={rc.color} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <Field label="Prénom" required>
              <FocusInput t={t} value={form.first_name} onChange={set("first_name")} placeholder="Ahmed" />
            </Field>
            <Field label="Nom" required>
              <FocusInput t={t} value={form.last_name} onChange={set("last_name")} placeholder="Benali" />
            </Field>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Email" required>
              <FocusInput t={t} type="email" value={form.email} onChange={set("email")} placeholder="exemple@email.com" />
            </Field>
            <Field label="Téléphone">
              <FocusInput t={t} value={form.phone} onChange={set("phone")} placeholder="05XXXXXXXX" />
            </Field>
          </div>
        </div>

        {/* Sécurité */}
        <div style={sectionCard}>
          <SecLabel label="Sécurité" t={t} accentColor={rc.color} />
          <Field label="Mot de passe" required={!isEdit}>
            <FocusInput t={t} type="password" value={form.password} onChange={set("password")}
              placeholder={isEdit ? "Laisser vide pour ne pas modifier" : "Minimum 6 caractères"} />
          </Field>
        </div>

        {/* Statut (edit only) */}
        {isEdit && (
          <div style={sectionCard}>
            <SecLabel label="Statut" t={t} accentColor={rc.color} />
            <StatusSegment value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} t={t} />
          </div>
        )}

        {/* Responsable / Opérateur — Stop Desk */}
        {(isResponsable || isOperator) && !isEdit && (
          <div style={sectionCard}>
            <SecLabel label="Assignation" t={t} accentColor={rc.color} />
            <Field label="Stop Desk assigné">
              <div style={{ position: "relative" }}>
                <Building2 size={13} color={t.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <select style={{ ...sel, paddingLeft: 34 }} value={form.stop_desk_id} onChange={set("stop_desk_id")}>
                  <option value="">— Aucun —</option>
                  {stopDesks.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
                </select>
              </div>
            </Field>
          </div>
        )}

        {/* Expéditeur — wilaya + company + docs */}
        {isExpediteur && !isEdit && (
          <>
            <div style={sectionCard}>
              <SecLabel label="Assignation" t={t} accentColor={rc.color} />
              <Field label="Wilaya assignée">
                <div style={{ position: "relative" }}>
                  <MapPin size={13} color={t.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <select style={{ ...sel, paddingLeft: 34 }} value={form.wilaya_id} onChange={set("wilaya_id")}>
                    <option value="">— Aucune —</option>
                    {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ""}</option>)}
                  </select>
                </div>
              </Field>
              {/* Admin picks the SD; operator's SD is auto-assigned server-side */}
              {!isOp && (
                <Field label="Stop Desk assigné">
                  <div style={{ position: "relative" }}>
                    <Building2 size={13} color={t.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <select style={{ ...sel, paddingLeft: 34 }} value={form.stop_desk_id} onChange={set("stop_desk_id")}>
                      <option value="">— Aucun —</option>
                      {stopDesks.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
                    </select>
                  </div>
                </Field>
              )}
            </div>
            <div style={sectionCard}>
              <SecLabel label="Entreprise" t={t} accentColor={rc.color} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Field label="Raison sociale">
                  <FocusInput t={t} value={form.company_name} onChange={set("company_name")} placeholder="SARL MonEntreprise" />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Registre de Commerce">
                    <FocusInput t={t} value={form.registre_commerce} onChange={set("registre_commerce")} placeholder="16/00-1234567B05" />
                  </Field>
                  <Field label="NIF">
                    <FocusInput t={t} value={form.nif} onChange={set("nif")} placeholder="000000000000000" />
                  </Field>
                </div>
                <Field label="NIS">
                  <FocusInput t={t} value={form.nis} onChange={set("nis")} placeholder="000000000000000" />
                </Field>
              </div>
            </div>
            <div style={sectionCard}>
              <SecLabel label="Documents (optionnels)" t={t} accentColor={rc.color} />
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <FileUploadField t={t} label="Registre de Commerce (scan)" existingUrl={(editing as StaffUser | null)?.rc_file} onChange={setFileField("rc_file")} />
                <FileUploadField t={t} label="NIF (scan)" existingUrl={(editing as StaffUser | null)?.nif_file} onChange={setFileField("nif_file")} />
                <FileUploadField t={t} label="NIS (scan)" existingUrl={(editing as StaffUser | null)?.nis_file} onChange={setFileField("nis_file")} />
              </div>
            </div>
          </>
        )}

        {/* Chauffeur local — communes + permis/CIN + vehicle */}
        {isDriver && !isEdit && (
          <>
            {/* Commune summary + open modal button */}
            <div style={{ ...sectionCard, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SecLabel label="Communes assignées" t={t} accentColor={rc.color} />
                {form.commune_ids.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {form.commune_ids.slice(0, 5).map(id => {
                      const c = communes.find(x => x.id === id);
                      if (!c) return null;
                      return (
                        <span key={id} style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 500,
                          background: `${rc.color}12`, color: rc.color,
                          border: `1px solid ${rc.color}25`,
                        }}>
                          {c.name}
                          {form.commune_prices[id] && <span style={{ fontSize: 10, opacity: 0.75 }}>· {form.commune_prices[id]} DA</span>}
                        </span>
                      );
                    })}
                    {form.commune_ids.length > 5 && (
                      <span style={{ padding: "2px 9px", borderRadius: 12, fontSize: 11, color: t.textFaint, background: t.sectionBg, border: `1px solid ${t.border}` }}>
                        +{form.commune_ids.length - 5} autres
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: t.textFaint, fontStyle: "italic" }}>Aucune commune assignée</p>
                )}
              </div>
              <button type="button" onClick={() => setCommuneModalOpen(true)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${rc.color}40`, background: `${rc.color}0a`,
                color: rc.color, cursor: "pointer", flexShrink: 0,
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = `${rc.color}18`; e.currentTarget.style.borderColor = `${rc.color}70`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${rc.color}0a`; e.currentTarget.style.borderColor = `${rc.color}40`; }}
              >
                <MapPin size={12} /> Gérer
              </button>
            </div>
            <div style={sectionCard}>
              <SecLabel label="Permis & CIN" t={t} accentColor={rc.color} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="N° Permis de conduire">
                    <FocusInput t={t} value={form.permis_numero} onChange={set("permis_numero")} placeholder="1234567" />
                  </Field>
                  <Field label="Catégorie permis">
                    <select style={sel} value={form.permis_categorie} onChange={set("permis_categorie")}>
                      <option value="">— —</option>
                      {["A", "B", "C", "D", "E", "F"].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
                <FileUploadField t={t} label="Permis de conduire (scan)" existingUrl={(editing as StaffUser | null)?.permis_file} onChange={setFileField("permis_file")} />
                <Field label="N° Carte Nationale d'Identité (CIN)">
                  <FocusInput t={t} value={form.cin_numero} onChange={set("cin_numero")} placeholder="123456789" />
                </Field>
                <FileUploadField t={t} label="CIN (scan)" existingUrl={(editing as StaffUser | null)?.cin_file} onChange={setFileField("cin_file")} />
              </div>
            </div>
            <div style={sectionCard}>
              <SecLabel label="Véhicule" t={t} accentColor={rc.color} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Immatriculation">
                    <FocusInput t={t} value={form.vehicle_plate} onChange={set("vehicle_plate")} placeholder="12345-123-16" />
                  </Field>
                  <Field label="Type de véhicule">
                    <select style={sel} value={form.vehicle_type} onChange={set("vehicle_type")}>
                      <option value="">— Sélectionner —</option>
                      <option value="moto">Moto</option>
                      <option value="voiture">Voiture</option>
                      <option value="camionette">Camionette</option>
                      <option value="camion">Camion</option>
                    </select>
                  </Field>
                </div>
                <Field label="Marque / Modèle">
                  <FocusInput t={t} value={form.vehicle_marque} onChange={set("vehicle_marque")} placeholder="Renault Symbol 2020" />
                </Field>
              </div>
            </div>
          </>
        )}

        {/* Transit chauffeur — communes (multi) + permis/CIN + vehicle */}
        {isTransit && !isEdit && (
          <>
            {/* Commune summary + open modal button */}
            <div style={{ ...sectionCard, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SecLabel label="Communes assignées" t={t} accentColor={rc.color} />
                {form.commune_ids.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {form.commune_ids.slice(0, 5).map(id => {
                      const c = communes.find(x => x.id === id);
                      if (!c) return null;
                      return (
                        <span key={id} style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 500,
                          background: `${rc.color}12`, color: rc.color,
                          border: `1px solid ${rc.color}25`,
                        }}>
                          {c.name}
                          {form.commune_prices[id] && <span style={{ fontSize: 10, opacity: 0.75 }}>· {form.commune_prices[id]} DA</span>}
                        </span>
                      );
                    })}
                    {form.commune_ids.length > 5 && (
                      <span style={{ padding: "2px 9px", borderRadius: 12, fontSize: 11, color: t.textFaint, background: t.sectionBg, border: `1px solid ${t.border}` }}>
                        +{form.commune_ids.length - 5} autres
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: t.textFaint, fontStyle: "italic" }}>Aucune commune assignée</p>
                )}
              </div>
              <button type="button" onClick={() => setCommuneModalOpen(true)} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${rc.color}40`, background: `${rc.color}0a`,
                color: rc.color, cursor: "pointer", flexShrink: 0,
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = `${rc.color}18`; e.currentTarget.style.borderColor = `${rc.color}70`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${rc.color}0a`; e.currentTarget.style.borderColor = `${rc.color}40`; }}
              >
                <MapPin size={12} /> Gérer
              </button>
            </div>
            <div style={sectionCard}>
              <SecLabel label="Permis & CIN" t={t} accentColor={rc.color} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="N° Permis de conduire">
                    <FocusInput t={t} value={form.permis_numero} onChange={set("permis_numero")} placeholder="1234567" />
                  </Field>
                  <Field label="Catégorie permis">
                    <select style={sel} value={form.permis_categorie} onChange={set("permis_categorie")}>
                      <option value="">— —</option>
                      {["A", "B", "C", "D", "E", "F"].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
                <FileUploadField t={t} label="Permis de conduire (scan)" existingUrl={(editing as StaffUser | null)?.permis_file} onChange={setFileField("permis_file")} />
                <Field label="N° Carte Nationale d'Identité (CIN)">
                  <FocusInput t={t} value={form.cin_numero} onChange={set("cin_numero")} placeholder="123456789" />
                </Field>
                <FileUploadField t={t} label="CIN (scan)" existingUrl={(editing as StaffUser | null)?.cin_file} onChange={setFileField("cin_file")} />
              </div>
            </div>
            <div style={sectionCard}>
              <SecLabel label="Véhicule" t={t} accentColor={rc.color} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Immatriculation">
                    <FocusInput t={t} value={form.vehicle_plate} onChange={set("vehicle_plate")} placeholder="12345-123-16" />
                  </Field>
                  <Field label="Type de véhicule">
                    <select style={sel} value={form.vehicle_type} onChange={set("vehicle_type")}>
                      <option value="">— Sélectionner —</option>
                      <option value="moto">Moto</option>
                      <option value="voiture">Voiture</option>
                      <option value="camionette">Camionette</option>
                      <option value="camion">Camion</option>
                    </select>
                  </Field>
                </div>
                <Field label="Marque / Modèle">
                  <FocusInput t={t} value={form.vehicle_marque} onChange={set("vehicle_marque")} placeholder="Renault Symbol 2020" />
                </Field>
              </div>
            </div>
          </>
        )}
        <div style={{ height: 8 }} />
      </form>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: `1px solid ${t.border}`, flexShrink: 0, background: t.modalBg }}>
        <button onClick={onClose} style={{ background: "none", border: `1.5px solid ${t.border}`, borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>
          Annuler
        </button>
        <SaveBtn saving={saving} onClick={() => formRef.current?.requestSubmit()} />
      </div>
    </Modal>
    </>
  );
}

/* ── Client Modal ────────────────────────────────────────── */
type ClientForm = {
  first_name: string; last_name: string; phone1: string; phone2: string;
  wilaya_id: string; commune_id: string; stop_desk_id: string;
};

function ClientModal({ t, editing, wilayas, communes, stopDesks, onClose, onSaved }: {
  t: T; editing: Client | null;
  wilayas: Wilaya[]; communes: Commune[]; stopDesks: StopDesk[];
  onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editing;
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<ClientForm>({
    first_name:   editing?.first_name ?? "",
    last_name:    editing?.last_name ?? "",
    phone1:       editing?.phone1 ?? "",
    phone2:       editing?.phone2 ?? "",
    wilaya_id:    editing?.wilaya_id ? String(editing.wilaya_id) : "",
    commune_id:   editing?.commune_id ? String(editing.commune_id) : "",
    stop_desk_id: editing?.stop_desk_id ? String(editing.stop_desk_id) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof ClientForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => { const n = { ...p, [k]: e.target.value }; if (k === "wilaya_id") n.commune_id = ""; return n; });

  const filteredCommunes = form.wilaya_id
    ? communes.filter(c => c.wilaya_id === Number(form.wilaya_id))
    : communes;

  const sel = selStyle(t);
  const sectionCard: React.CSSProperties = { background: t.sectionBg, borderRadius: 10, padding: "14px 16px" };
  const clientAccent = "#8b5cf6";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) { setError("Prénom et nom obligatoires."); return; }
    if (!form.phone1.trim()) { setError("Téléphone 1 obligatoire."); return; }
    setError(""); setSaving(true);
    const payload = {
      first_name: form.first_name.trim(), last_name: form.last_name.trim(),
      phone1: form.phone1.trim(), phone2: form.phone2.trim() || null,
      wilaya_id:    form.wilaya_id    ? Number(form.wilaya_id)    : null,
      commune_id:   form.commune_id   ? Number(form.commune_id)   : null,
      stop_desk_id: form.stop_desk_id ? Number(form.stop_desk_id) : null,
    };
    const res = isEdit ? await updateClient(editing!.id, payload) : await createClient(payload);
    setSaving(false);
    if (res.success) { onSaved(); onClose(); }
    else setError((res as { message?: string }).message ?? "Erreur serveur");
  }

  return (
    <Modal t={t} title={isEdit ? "Modifier client" : "Nouveau client"} onClose={onClose} accentColor={clientAccent}>
      <form ref={formRef} onSubmit={submit} style={{ overflowY: "auto", padding: "20px 20px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 9, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", marginBottom: 4 }}>
            <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "#ef4444" }}>{error}</span>
          </div>
        )}
        <div style={sectionCard}>
          <SecLabel label="Identité" t={t} accentColor={clientAccent} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Prénom" required><FocusInput t={t} value={form.first_name} onChange={set("first_name")} placeholder="Ahmed" /></Field>
            <Field label="Nom" required><FocusInput t={t} value={form.last_name} onChange={set("last_name")} placeholder="Benali" /></Field>
          </div>
        </div>
        <div style={sectionCard}>
          <SecLabel label="Contact" t={t} accentColor={clientAccent} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Téléphone 1" required><FocusInput t={t} value={form.phone1} onChange={set("phone1")} placeholder="05XXXXXXXX" /></Field>
            <Field label="Téléphone 2"><FocusInput t={t} value={form.phone2} onChange={set("phone2")} placeholder="Optionnel" /></Field>
          </div>
        </div>
        <div style={sectionCard}>
          <SecLabel label="Localisation" t={t} accentColor={clientAccent} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="Wilaya">
              <select style={sel} value={form.wilaya_id} onChange={set("wilaya_id")}>
                <option value="">— Sélectionner —</option>
                {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
            <Field label="Commune">
              <select style={{ ...sel, opacity: !form.wilaya_id ? 0.5 : 1 }}
                value={form.commune_id} onChange={set("commune_id")} disabled={!form.wilaya_id}>
                <option value="">— Sélectionner —</option>
                {filteredCommunes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Stop Desk (optionnel)">
              <select style={sel} value={form.stop_desk_id} onChange={set("stop_desk_id")}>
                <option value="">— Aucun —</option>
                {stopDesks.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
        </div>
        <div style={{ height: 8 }} />
      </form>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: `1px solid ${t.border}`, flexShrink: 0, background: t.modalBg }}>
        <button onClick={onClose} style={{ background: "none", border: `1.5px solid ${t.border}`, borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>Annuler</button>
        <SaveBtn saving={saving} onClick={() => formRef.current?.requestSubmit()} />
      </div>
    </Modal>
  );
}

/* ── User Detail Panel ───────────────────────────────────── */
function UserPanel({ t, isDark, user, onClose, onEdit, onSaved }: {
  t: T; isDark: boolean; user: StaffUser; onClose: () => void; onEdit: () => void; onSaved: () => void;
}) {
  const rc = ROLE_CFG[user.user_type] ?? { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", label: user.user_type };
  const isDriver = user.user_type === "chauffeur" || user.user_type === "transit_chauffeur";
  const isExpediteur = user.user_type === "expediteur";

  // "Accès API" toggle — admin-only. Defaults enabled when the flag is absent.
  const isAdmin = getStoredUser()?.user_type === "admin";
  const [apiEnabled, setApiEnabled] = useState(user.api_enabled !== false);
  const [savingApi, setSavingApi] = useState(false);

  async function toggleApi(next: boolean) {
    setSavingApi(true);
    const prev = apiEnabled;
    setApiEnabled(next); // optimistic
    // Send the full expéditeur profile so the backend (which nulls absent fields)
    // doesn't wipe company/wilaya data while flipping just the API flag.
    const res = await updateUser(user.id, {
      first_name: user.first_name, last_name: user.last_name,
      email: user.email, phone: user.phone, user_type: user.user_type,
      status: user.status, wilaya_id: user.wilaya_id, stop_desk_id: user.stop_desk_id,
      company_name: user.company_name, registre_commerce: user.registre_commerce,
      nif: user.nif, nis: user.nis,
      api_enabled: next,
    });
    setSavingApi(false);
    if (res.success) onSaved();
    else setApiEnabled(prev); // rollback on failure
  }

  function InfoRow({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent?: boolean }) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: `1px solid ${t.divider}` }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
          <Icon size={13} color={accent ? rc.color : t.textMuted} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 500, color: accent ? rc.color : t.text, wordBreak: "break-word" }}>{value}</p>
        </div>
      </div>
    );
  }

  function SectionHead({ label }: { label: string }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "18px 0 6px" }}>
        <div style={{ width: 3, height: 11, borderRadius: 2, background: rc.color }} />
        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: rc.color }}>{label}</p>
      </div>
    );
  }

  function FileLink({ label, path }: { label: string; path?: string | null }) {
    if (!path) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${t.divider}` }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FileCheck size={13} color={t.textMuted} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
          <a href={`/storage/${path}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: "#0ea5e9", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Eye size={11} /> Voir le fichier
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`@keyframes slideInR { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "flex-end" }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: "100%", maxWidth: 400, height: "100%", background: t.card,
          borderLeft: `1px solid ${t.border}`, boxShadow: "-16px 0 48px rgba(0,0,0,0.14)",
          display: "flex", flexDirection: "column", fontFamily: "var(--font-jakarta, sans-serif)",
          animation: "slideInR 0.22s ease",
        }}>
          {/* Header with role-tinted gradient */}
          <div style={{
            background: `linear-gradient(135deg, ${rc.color}14 0%, ${rc.color}06 100%)`,
            borderBottom: `1px solid ${t.border}`, padding: "18px 20px", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <Avatar first={user.first_name} last={user.last_name} role={user.user_type} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>
                  {user.first_name} {user.last_name}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: rc.bg, color: rc.color }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: rc.color }} />
                    {rc.label}
                  </span>
                  <StatusChip status={user.status} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <IconBtn onClick={onEdit} title="Modifier"><Pencil size={14} color={t.textMuted} /></IconBtn>
                <IconBtn onClick={onClose} title="Fermer"><X size={15} color={t.textMuted} /></IconBtn>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 24px" }}>

            <SectionHead label="Contact" />
            <InfoRow icon={Mail} label="Adresse e-mail" value={user.email} />
            <InfoRow icon={Phone} label="Téléphone" value={user.phone ?? "—"} />

            {/* Responsable */}
            {user.user_type === "responsable" && (
              <>
                <SectionHead label="Assignation" />
                <InfoRow icon={Building2} label="Stop Desk" value={user.stop_desk?.name ?? "—"} />
              </>
            )}

            {/* Expéditeur */}
            {isExpediteur && (
              <>
                {/* Accès API — admin-only toggle, gates the API REST resources */}
                {isAdmin && (
                  <>
                    <SectionHead label="Accès API" />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${t.divider}` }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Code2 size={13} color={apiEnabled ? "#f97316" : t.textMuted} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>API REST</p>
                        <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: apiEnabled ? "#f97316" : t.textMuted }}>
                          {apiEnabled ? "Activé" : "Désactivé"}
                          {savingApi && <span style={{ fontSize: 11, fontWeight: 400, color: t.textFaint, marginLeft: 6 }}>…</span>}
                        </p>
                      </div>
                      <Toggle checked={apiEnabled} disabled={savingApi} onChange={toggleApi} />
                    </div>
                  </>
                )}

                <SectionHead label="Assignation" />
                <InfoRow icon={MapPin} label="Wilaya" value={user.wilaya?.name ?? "—"} />
                {(user.company_name || user.registre_commerce || user.nif || user.nis) && (
                  <>
                    <SectionHead label="Entreprise" />
                    {user.company_name    && <InfoRow icon={Building2} label="Raison sociale"      value={user.company_name} />}
                    {user.registre_commerce && <InfoRow icon={Building2} label="Registre de Commerce" value={user.registre_commerce} />}
                    {user.nif             && <InfoRow icon={Building2} label="NIF"                 value={user.nif} />}
                    {user.nis             && <InfoRow icon={Building2} label="NIS"                 value={user.nis} />}
                  </>
                )}
                {(user.rc_file || user.nif_file || user.nis_file) && (
                  <>
                    <SectionHead label="Documents" />
                    <FileLink label="Registre de Commerce" path={user.rc_file} />
                    <FileLink label="NIF"                  path={user.nif_file} />
                    <FileLink label="NIS"                  path={user.nis_file} />
                  </>
                )}
              </>
            )}

            {/* Drivers */}
            {isDriver && (
              <>
                {/* Communes */}
                {(user.communes ?? []).length > 0 && (
                  <>
                    <SectionHead label="Communes assignées" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 8 }}>
                      {(user.communes ?? []).map(c => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 8, background: isDark ? "rgba(255,255,255,0.04)" : "#f9fafb" }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{c.name}</span>
                            {c.wilaya && <span style={{ fontSize: 11, color: t.textFaint, marginLeft: 6 }}>{c.wilaya.name}</span>}
                          </div>
                          {c.pivot?.price != null && (
                            <span style={{ fontSize: 12, fontWeight: 600, color: rc.color, background: `${rc.color}12`, padding: "2px 8px", borderRadius: 12 }}>
                              {c.pivot.price} DA
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Permis & CIN */}
                {(user.permis_numero || user.cin_numero || user.permis_file || user.cin_file) && (
                  <>
                    <SectionHead label="Permis & CIN" />
                    {user.permis_numero   && <InfoRow icon={UserCog}  label="N° Permis"   value={`${user.permis_numero}${user.permis_categorie ? ` — Cat. ${user.permis_categorie}` : ""}`} />}
                    {user.cin_numero      && <InfoRow icon={ShieldCheck} label="N° CIN"   value={user.cin_numero} />}
                    <FileLink label="Permis (scan)" path={user.permis_file} />
                    <FileLink label="CIN (scan)"    path={user.cin_file} />
                  </>
                )}

                {/* Vehicle */}
                {(user.vehicle_plate || user.vehicle_type || user.vehicle_marque) && (
                  <>
                    <SectionHead label="Véhicule" />
                    {user.vehicle_plate  && <InfoRow icon={Car} label="Immatriculation" value={user.vehicle_plate} />}
                    {user.vehicle_type   && <InfoRow icon={Car} label="Type"             value={user.vehicle_type} />}
                    {user.vehicle_marque && <InfoRow icon={Car} label="Marque / Modèle"  value={user.vehicle_marque} />}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Client Detail Panel ─────────────────────────────────── */
function ClientPanel({ t, isDark, client, onClose, onEdit }: {
  t: T; isDark: boolean; client: Client; onClose: () => void; onEdit: () => void;
}) {
  function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: `1px solid ${t.divider}` }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
          <Icon size={13} color={t.textMuted} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 500, color: t.text, wordBreak: "break-word" }}>{value}</p>
        </div>
      </div>
    );
  }
  return (
    <>
      <style>{`@keyframes slideInR { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "flex-end" }}>
        <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, height: "100%", background: t.card, borderLeft: `1px solid ${t.border}`, boxShadow: "-12px 0 40px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", fontFamily: "var(--font-jakarta, sans-serif)", animation: "slideInR 0.22s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            <Avatar first={client.first_name} last={client.last_name} role="operator" size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>{client.first_name} {client.last_name}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>Client #{client.id}</p>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <IconBtn onClick={onEdit} title="Modifier"><Pencil size={14} color={t.textMuted} /></IconBtn>
              <IconBtn onClick={onClose} title="Fermer"><X size={15} color={t.textMuted} /></IconBtn>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Contact</p>
            <InfoRow icon={Phone} label="Téléphone 1" value={client.phone1} />
            {client.phone2 && <InfoRow icon={Phone} label="Téléphone 2" value={client.phone2} />}
            <p style={{ margin: "16px 0 6px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Localisation</p>
            <InfoRow icon={MapPin} label="Wilaya" value={client.wilaya?.name ?? "—"} />
            <InfoRow icon={MapPin} label="Commune" value={client.commune?.name ?? "—"} />
            <InfoRow icon={Building2} label="Stop Desk" value={client.stop_desk?.name ?? "—"} />
            <p style={{ margin: "16px 0 6px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Informations</p>
            <InfoRow icon={UserPlus} label="Créé par" value={client.created_by_user ? `${client.created_by_user.first_name} ${client.created_by_user.last_name}` : "—"} />
            <InfoRow icon={Calendar} label="Date création" value={fmtDate(client.created_at)} />
            <p style={{ margin: "16px 0 8px", fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Historique colis</p>
            <div style={{ border: `1.5px dashed ${t.border}`, borderRadius: 10, padding: "28px 16px", textAlign: "center" }}>
              <Package size={28} color={t.textFaint} style={{ marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
              <p style={{ margin: 0, fontSize: 13, color: t.textMuted }}>Aucun colis pour ce client</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Main Page ───────────────────────────────────────────── */
export default function UsersPage() {
  const isDark = useIsDark();
  const t      = useTokens(isDark);

  // Operator restrictions
  const currentUser = getStoredUser();
  const isOperatorView = currentUser?.user_type === "operator" || currentUser?.user_type === "responsable";
  const operatorSDId = currentUser?.stop_desk_id ?? null;

  // Tabs visible to this user
  const OPERATOR_TABS: TabId[] = ["operator", "responsable", "expediteur", "chauffeur"];
  const visibleTabs = isOperatorView ? TABS.filter(t => OPERATOR_TABS.includes(t.id)) : TABS;
  const defaultTab = isOperatorView ? "expediteur" : "admin";

  const [tab,      setTab]      = useState<TabId>(defaultTab);
  const [staffMap, setStaffMap] = useState<Record<string, StaffUser[]>>({});
  const [clients,  setClients]  = useState<PaginatedClients | null>(null);
  const [loading,  setLoading]  = useState(false);

  const [wilayas,   setWilayas]   = useState<Wilaya[]>([]);
  const [communes,  setCommunes]  = useState<Commune[]>([]);
  const [stopDesks, setStopDesks] = useState<StopDesk[]>([]);

  // Custom roles (roles & permissions). Loaded once; admin-only assignment.
  const [roles, setRoles] = useState<Role[]>([]);
  // Local override of each user's role so the dropdown reflects changes instantly.
  const [roleAssignments, setRoleAssignments] = useState<Record<number, number | null>>({});
  const [roleSaving, setRoleSaving] = useState<number | null>(null);

  const [staffModal,   setStaffModal]   = useState(false);
  const [clientModal,  setClientModal]  = useState(false);
  const [editUser,     setEditUser]     = useState<StaffUser | null>(null);
  const [editClient,   setEditClient]   = useState<Client | null>(null);
  const [detailUser,      setDetailUser]      = useState<StaffUser | null>(null);
  const [detailClient,    setDetailClient]    = useState<Client | null>(null);
  const [communeUser,     setCommuneUser]     = useState<StaffUser | null>(null);
  const [communeIds,      setCommuneIds]      = useState<number[]>([]);
  const [communePrices,   setCommunePrices]   = useState<Record<number, string>>({});
  const [vehicleUser,     setVehicleUser]     = useState<StaffUser | null>(null);
  const [sdUser,          setSdUser]          = useState<StaffUser | null>(null);
  const [wilayaUser,      setWilayaUser]      = useState<StaffUser | null>(null);
  const [docsUser,        setDocsUser]        = useState<StaffUser | null>(null);

  const [search,           setSearch]           = useState("");
  const [staffSearch,      setStaffSearch]      = useState("");
  const [staffStatusFilter, setStaffStatusFilter] = useState("");
  const [staffWilayaFilter,    setStaffWilayaFilter]    = useState("");
  const [staffHasCommunes,     setStaffHasCommunes]     = useState<boolean | null>(null);
  const [staffHasVehicle,      setStaffHasVehicle]      = useState<boolean | null>(null);
  const [staffStopDeskFilter,  setStaffStopDeskFilter]  = useState("");
  const [staffUnassigned,      setStaffUnassigned]      = useState<boolean | null>(null);
  const [clientWilayaFilter,   setClientWilayaFilter]   = useState("");
  const [clientHasPhone2,      setClientHasPhone2]      = useState<boolean | null>(null);
  const [page,             setPage]             = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getWilayas({ full: true }).then(r => r.success && r.data && setWilayas(r.data));
    getAllCommunes().then(r => r.success && r.data && setCommunes(r.data));
    api<StopDesk[]>("/stop-desks").then(r => r.success && r.data && setStopDesks(r.data));
    // Load custom roles once (admins only assign them).
    if (!isOperatorView) getRoles().then(r => r.success && r.data && setRoles(r.data));
  }, [isOperatorView]);

  // Current role for a row: local override wins, else the value from the API.
  function currentRoleId(u: StaffUser): number | null {
    return u.id in roleAssignments ? roleAssignments[u.id] : (u.role_id ?? null);
  }

  async function handleAssignRole(u: StaffUser, roleId: number | null) {
    setRoleSaving(u.id);
    const res = await assignRole(u.id, roleId);
    setRoleSaving(null);
    if (res.success) setRoleAssignments(p => ({ ...p, [u.id]: roleId }));
    else alert(res.message || "Échec de l'attribution du rôle.");
  }

  // Communes for driver assignment: operator sees only their wilaya's communes, admin sees all
  const operatorWilayaId = isOperatorView && operatorSDId
    ? stopDesks.find(sd => sd.id === operatorSDId)?.commune?.wilaya_id ?? null
    : null;
  const driverCommunes = operatorWilayaId
    ? communes.filter(c => c.wilaya_id === operatorWilayaId)
    : communes;
  const driverWilayas = operatorWilayaId
    ? wilayas.filter(w => w.id === operatorWilayaId)
    : wilayas;

  // Preload all tab counts in background so badges show immediately on page load
  useEffect(() => {
    visibleTabs.forEach(tb => {
      if (tb.id === "clients") return;
      getUsers({ type: tb.id }).then(r => {
        if (r.success && r.data) setStaffMap(p => ({ ...p, [tb.id]: r.data! }));
      });
    });
    if (!isOperatorView) {
      getClients({ per_page: 1 }).then(r => {
        if (r.success && r.data) setClients(r.data);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTab = useCallback(async (tabId: TabId, pg = 1, q = "") => {
    setLoading(true);
    if (tabId === "clients") {
      const res = await getClients({ search: q, page: pg, per_page: 20 });
      if (res.success && res.data) setClients(res.data);
    } else {
      const res = await getUsers({ type: tabId });
      if (res.success && res.data) setStaffMap(p => ({ ...p, [tabId]: res.data! }));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTab(tab, page, search); }, [tab, page, loadTab]);

  function handleSearch(v: string) {
    setSearch(v); setPage(1);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => loadTab("clients", 1, v), 300);
  }

  async function handleToggle(u: StaffUser) {
    const res = await toggleUserStatus(u.id);
    if (res.success && res.data)
      setStaffMap(p => ({ ...p, [tab]: (p[tab] ?? []).map(x => x.id === u.id ? res.data! : x) }));
  }

  async function handleDeleteUser(u: StaffUser) {
    if (!confirm(`Supprimer ${u.first_name} ${u.last_name} ?`)) return;
    await deleteUser(u.id);
    loadTab(tab, page, search);
  }

  async function handleDeleteClient(c: Client) {
    if (!confirm(`Supprimer ${c.first_name} ${c.last_name} ?`)) return;
    await deleteClient(c.id);
    setDetailClient(null);
    loadTab("clients", page, search);
  }

  const isClientTab = tab === "clients";
  // Can the current user edit this staff user?
  function canEditUser(u: StaffUser): boolean {
    if (!isOperatorView) return true; // admin can edit all
    if (u.id === currentUser?.id) return true; // can edit self
    if (u.user_type === "chauffeur" || u.user_type === "transit_chauffeur") return true;
    if (u.user_type === "expediteur") return true;
    return false; // can't edit other operators/responsables
  }

  // Can the current user create users of this type?
  function canCreateInTab(): boolean {
    if (!isOperatorView) return true;
    return tab === "expediteur" || tab === "chauffeur";
  }

  const staffListRaw = staffMap[tab] ?? [];

  // Client-side filter for staff tabs
  const staffList = staffListRaw.filter(u => {
    // Operator: only show users from same SD (for operator/responsable types)
    if (isOperatorView && operatorSDId) {
      if ((u.user_type === "operator" || u.user_type === "responsable") && u.stop_desk_id !== operatorSDId) return false;
    }
    if (staffStatusFilter && u.status !== staffStatusFilter) return false;
    if (staffSearch) {
      const q = staffSearch.toLowerCase();
      if (!(
        u.first_name.toLowerCase().includes(q) ||
        u.last_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? "").includes(q) ||
        (u.company_name ?? "").toLowerCase().includes(q)
      )) return false;
    }
    if (staffWilayaFilter) {
      if (tab === "expediteur" && String(u.wilaya_id) !== staffWilayaFilter) return false;
      if ((tab === "chauffeur" || tab === "transit_chauffeur") &&
          !(u.communes ?? []).some(c => String(c.wilaya_id) === staffWilayaFilter)) return false;
    }
    if (staffHasCommunes === true  && (u.communes ?? []).length === 0) return false;
    if (staffHasCommunes === false && (u.communes ?? []).length > 0)  return false;
    if (staffHasVehicle  === true  && !u.vehicle_plate) return false;
    if (staffHasVehicle  === false && !!u.vehicle_plate) return false;
    if (staffStopDeskFilter && String(u.stop_desk_id) !== staffStopDeskFilter) return false;
    // Unassigned filter: responsable/operator → no stop_desk_id, expediteur → no wilaya_id
    if (staffUnassigned === true) {
      if ((tab === "responsable" || tab === "operator") && !!u.stop_desk_id) return false;
      if (tab === "expediteur"  && !!u.wilaya_id)    return false;
    }
    if (staffUnassigned === false) {
      if ((tab === "responsable" || tab === "operator") && !u.stop_desk_id) return false;
      if (tab === "expediteur"  && !u.wilaya_id)    return false;
    }
    return true;
  });

  const filteredClients = (clients?.data ?? []).filter(c => {
    if (clientWilayaFilter && String(c.wilaya_id) !== clientWilayaFilter) return false;
    if (clientHasPhone2 === true  && !c.phone2) return false;
    if (clientHasPhone2 === false && !!c.phone2) return false;
    return true;
  });

  const total = isClientTab ? (clients?.total ?? 0) : staffList.length;
  const curTab = visibleTabs.find(tb => tb.id === tab) ?? visibleTabs[0];
  const showAssignCol = tab === "responsable" || tab === "expediteur" || tab === "chauffeur" || tab === "transit_chauffeur";

  function tabCount(id: string) {
    if (id === "clients") return clients?.total;
    return staffMap[id]?.length;
  }

  const th: React.CSSProperties = {
    padding: "10px 14px", fontSize: 11, fontWeight: 600, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.07em",
    borderBottom: `1px solid ${t.border}`, textAlign: "left", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "12px 14px", fontSize: 13, borderBottom: `1px solid ${t.divider}`,
    verticalAlign: "middle", color: t.textSub,
  };

  return (
    <div style={{ width: "100%", fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Modals */}
      {detailUser && (
        <UserPanel t={t} isDark={isDark} user={detailUser}
          onClose={() => setDetailUser(null)}
          onEdit={() => { setEditUser(detailUser); setStaffModal(true); setDetailUser(null); }}
          onSaved={() => loadTab(tab, page, search)} />
      )}
      {staffModal && (
        <StaffModal t={t} userType={tab} editing={editUser} wilayas={wilayas} communes={communes} stopDesks={stopDesks}
          onClose={() => { setStaffModal(false); setEditUser(null); }}
          onSaved={() => loadTab(tab, page, search)} />
      )}
      {clientModal && (
        <ClientModal t={t} editing={editClient} wilayas={wilayas} communes={communes} stopDesks={stopDesks}
          onClose={() => { setClientModal(false); setEditClient(null); }}
          onSaved={() => loadTab("clients", page, search)} />
      )}
      {detailClient && (
        <ClientPanel t={t} isDark={isDark} client={detailClient}
          onClose={() => setDetailClient(null)}
          onEdit={() => { setEditClient(detailClient); setClientModal(true); setDetailClient(null); }} />
      )}
      {communeUser && (
        <CommuneAssignModal
          t={t} accentColor={ROLE_CFG[communeUser.user_type]?.color ?? "#0ea5e9"}
          wilayas={driverWilayas} communes={driverCommunes}
          selectedIds={communeIds} prices={communePrices}
          onToggle={id => setCommuneIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])}
          onPriceChange={(id, val) => setCommunePrices(p => ({ ...p, [id]: val }))}
          onClose={() => setCommuneUser(null)}
          user={communeUser}
          onSaved={() => loadTab(tab, page, search)}
        />
      )}
      {vehicleUser && (
        <VehicleModal t={t} user={vehicleUser}
          onClose={() => setVehicleUser(null)}
          onSaved={() => { loadTab(tab, page, search); setVehicleUser(null); }} />
      )}
      {sdUser && (
        <AssignSDModal t={t} user={sdUser} stopDesks={stopDesks} wilayas={wilayas} communes={communes}
          onClose={() => setSdUser(null)}
          onSaved={() => { loadTab(tab, page, search); setSdUser(null); }} />
      )}
      {wilayaUser && (
        <AssignWilayaModal t={t} user={wilayaUser} wilayas={wilayas}
          onClose={() => setWilayaUser(null)}
          onSaved={() => { loadTab(tab, page, search); setWilayaUser(null); }} />
      )}
      {docsUser && (
        <DocsModal t={t} user={docsUser} onClose={() => setDocsUser(null)} />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "-0.02em" }}>Utilisateurs</h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: t.textMuted }}>
            {total} {isClientTab ? "client" : curTab.label.toLowerCase().replace(/s$/, "")}{total !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreateInTab() && (
          <button
            onClick={() => { if (isClientTab) { setEditClient(null); setClientModal(true); } else { setEditUser(null); setStaffModal(true); } }}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#f97316", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer" }}
          >
            <Plus size={14} /> {NEW_LABELS[tab]}
          </button>
        )}
      </div>

      {/* Main card */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, boxShadow: t.shadow, overflow: "hidden" }}>

        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, overflowX: "auto" }}>
          {visibleTabs.map(tb => {
            const active = tab === tb.id;
            const count = tabCount(tb.id);
            return (
              <button key={tb.id}
                onClick={() => { setTab(tb.id); setPage(1); setSearch(""); setStaffSearch(""); setStaffStatusFilter(""); setStaffWilayaFilter(""); setStaffHasCommunes(null); setStaffHasVehicle(null); setStaffStopDeskFilter(""); setStaffUnassigned(null); setClientWilayaFilter(""); setClientHasPhone2(null); }}
                style={{
                  position: "relative", display: "flex", alignItems: "center", gap: 6,
                  padding: "11px 15px", fontSize: 12, fontWeight: active ? 600 : 500,
                  color: active ? t.text : t.textMuted,
                  background: "transparent", border: "none", cursor: "pointer",
                  whiteSpace: "nowrap", flexShrink: 0, transition: "color 0.12s",
                }}
              >
                <tb.Icon size={13} color={active ? tb.color : undefined} />
                {tb.label}
                {count !== undefined && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20,
                    background: active ? tb.color : (isDark ? "rgba(255,255,255,0.07)" : "#f3f4f6"),
                    color: active ? "#fff" : t.textMuted, transition: "all 0.12s",
                  }}>{count}</span>
                )}
                {active && <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: tb.color, borderRadius: "2px 2px 0 0" }} />}
              </button>
            );
          })}
        </div>

        {/* Filter bar */}
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* ── Row 1: Search + Controls ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Search input */}
            <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 320 }}>
              <Search size={13} color={t.textMuted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              {isClientTab
                ? <input value={search} onChange={e => handleSearch(e.target.value)}
                    placeholder="Rechercher par nom ou téléphone…"
                    style={{ ...inpStyle(t), paddingLeft: 32, minHeight: 36, padding: "7px 12px 7px 32px", fontSize: 12 }} />
                : <input value={staffSearch} onChange={e => setStaffSearch(e.target.value)}
                    placeholder="Nom, email, téléphone…"
                    style={{ ...inpStyle(t), paddingLeft: 32, minHeight: 36, padding: "7px 12px 7px 32px", fontSize: 12 }} />
              }
            </div>

            {/* Status dropdown — staff only */}
            {!isClientTab && (
              <select value={staffStatusFilter} onChange={e => setStaffStatusFilter(e.target.value)}
                style={{ ...selStyle(t), width: "auto", minWidth: 140, minHeight: 36, padding: "7px 10px", fontSize: 12 }}>
                <option value="">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="suspended">Suspendu</option>
              </select>
            )}

            {/* Wilaya dropdown — expediteur / driver tabs */}
            {(tab === "expediteur" || tab === "chauffeur" || tab === "transit_chauffeur") && (
              <select value={staffWilayaFilter} onChange={e => setStaffWilayaFilter(e.target.value)}
                style={{ ...selStyle(t), width: "auto", minWidth: 150, minHeight: 36, padding: "7px 10px", fontSize: 12 }}>
                <option value="">Toutes les wilayas</option>
                {wilayas.map(w => <option key={w.id} value={String(w.id)}>{w.name}{w.code ? ` (${w.code})` : ""}</option>)}
              </select>
            )}
            {/* Wilaya dropdown — client tab */}
            {isClientTab && (
              <select value={clientWilayaFilter} onChange={e => setClientWilayaFilter(e.target.value)}
                style={{ ...selStyle(t), width: "auto", minWidth: 150, minHeight: 36, padding: "7px 10px", fontSize: 12 }}>
                <option value="">Toutes les wilayas</option>
                {wilayas.map(w => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
              </select>
            )}

            {/* Stop desk dropdown — responsable + operator tabs */}
            {(tab === "responsable" || tab === "operator") && (
              <select value={staffStopDeskFilter} onChange={e => setStaffStopDeskFilter(e.target.value)}
                style={{ ...selStyle(t), width: "auto", minWidth: 160, minHeight: 36, padding: "7px 10px", fontSize: 12 }}>
                <option value="">Tous les stop desks</option>
                {stopDesks.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            )}

            {/* Communes toggle — driver tabs */}
            {(tab === "chauffeur" || tab === "transit_chauffeur") && (
              <div style={{ display: "flex", borderRadius: 20, overflow: "hidden", border: `1.5px solid ${staffHasCommunes !== null ? curTab.color : t.inp.border}`, flexShrink: 0, transition: "border-color 0.15s" }}>
                <button type="button"
                  onClick={() => setStaffHasCommunes(p => p === true ? null : true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 12px", fontSize: 11, fontWeight: 600,
                    background: staffHasCommunes === true ? curTab.color : "transparent",
                    color: staffHasCommunes === true ? "#fff" : t.textMuted,
                    border: "none", cursor: "pointer",
                    borderRight: `1px solid ${staffHasCommunes !== null ? curTab.color + "40" : t.divider}`,
                    transition: "all 0.12s",
                  }}
                >
                  <MapPin size={10} style={{ flexShrink: 0 }} /> Avec communes
                </button>
                <button type="button"
                  onClick={() => setStaffHasCommunes(p => p === false ? null : false)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 12px", fontSize: 11, fontWeight: 600,
                    background: staffHasCommunes === false ? `${curTab.color}18` : "transparent",
                    color: staffHasCommunes === false ? curTab.color : t.textMuted,
                    border: "none", cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  Sans communes
                </button>
              </div>
            )}

            {/* Vehicle toggle — driver tabs */}
            {(tab === "chauffeur" || tab === "transit_chauffeur") && (
              <div style={{ display: "flex", borderRadius: 20, overflow: "hidden", border: `1.5px solid ${staffHasVehicle !== null ? curTab.color : t.inp.border}`, flexShrink: 0, transition: "border-color 0.15s" }}>
                <button type="button"
                  onClick={() => setStaffHasVehicle(p => p === true ? null : true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 12px", fontSize: 11, fontWeight: 600,
                    background: staffHasVehicle === true ? curTab.color : "transparent",
                    color: staffHasVehicle === true ? "#fff" : t.textMuted,
                    border: "none", cursor: "pointer",
                    borderRight: `1px solid ${staffHasVehicle !== null ? curTab.color + "40" : t.divider}`,
                    transition: "all 0.12s",
                  }}
                >
                  <Car size={10} style={{ flexShrink: 0 }} /> Avec véhicule
                </button>
                <button type="button"
                  onClick={() => setStaffHasVehicle(p => p === false ? null : false)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 12px", fontSize: 11, fontWeight: 600,
                    background: staffHasVehicle === false ? `${curTab.color}18` : "transparent",
                    color: staffHasVehicle === false ? curTab.color : t.textMuted,
                    border: "none", cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  Sans véhicule
                </button>
              </div>
            )}

            {/* Unassigned toggle — responsable + operator + expediteur */}
            {(tab === "responsable" || tab === "operator" || tab === "expediteur") && (
              <div style={{ display: "flex", borderRadius: 20, overflow: "hidden", border: `1.5px solid ${staffUnassigned !== null ? curTab.color : t.inp.border}`, flexShrink: 0, transition: "border-color 0.15s" }}>
                <button type="button"
                  onClick={() => setStaffUnassigned(p => p === false ? null : false)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", fontSize: 11, fontWeight: 600, background: staffUnassigned === false ? curTab.color : "transparent", color: staffUnassigned === false ? "#fff" : t.textMuted, border: "none", cursor: "pointer", borderRight: `1px solid ${staffUnassigned !== null ? curTab.color + "40" : t.divider}`, transition: "all 0.12s" }}>
                  Assignés
                </button>
                <button type="button"
                  onClick={() => setStaffUnassigned(p => p === true ? null : true)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", fontSize: 11, fontWeight: 600, background: staffUnassigned === true ? `${curTab.color}18` : "transparent", color: staffUnassigned === true ? curTab.color : t.textMuted, border: "none", cursor: "pointer", transition: "all 0.12s" }}>
                  Non assignés
                </button>
              </div>
            )}

            {/* Phone2 toggle — client tab */}
            {isClientTab && (
              <div style={{ display: "flex", borderRadius: 20, overflow: "hidden", border: `1.5px solid ${clientHasPhone2 !== null ? curTab.color : t.inp.border}`, flexShrink: 0, transition: "border-color 0.15s" }}>
                <button type="button"
                  onClick={() => setClientHasPhone2(p => p === true ? null : true)}
                  style={{
                    padding: "5px 12px", fontSize: 11, fontWeight: 600,
                    background: clientHasPhone2 === true ? curTab.color : "transparent",
                    color: clientHasPhone2 === true ? "#fff" : t.textMuted,
                    border: "none", cursor: "pointer",
                    borderRight: `1px solid ${clientHasPhone2 !== null ? curTab.color + "40" : t.divider}`,
                    transition: "all 0.12s",
                  }}
                >
                  <Phone size={10} style={{ display: "inline", marginRight: 4 }} /> Avec tél. 2
                </button>
                <button type="button"
                  onClick={() => setClientHasPhone2(p => p === false ? null : false)}
                  style={{
                    padding: "5px 12px", fontSize: 11, fontWeight: 600,
                    background: clientHasPhone2 === false ? `${curTab.color}18` : "transparent",
                    color: clientHasPhone2 === false ? curTab.color : t.textMuted,
                    border: "none", cursor: "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  Sans tél. 2
                </button>
              </div>
            )}

            {/* Active filter count + Reset */}
            {(() => {
              const count = [
                !isClientTab && staffSearch,
                !isClientTab && staffStatusFilter,
                !isClientTab && staffWilayaFilter,
                !isClientTab && staffStopDeskFilter,
                !isClientTab && staffHasCommunes !== null,
                !isClientTab && staffHasVehicle !== null,
                !isClientTab && staffUnassigned !== null,
                isClientTab && search,
                isClientTab && clientWilayaFilter,
                isClientTab && clientHasPhone2 !== null,
              ].filter(Boolean).length;
              if (count === 0) return null;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: `${curTab.color}18`, color: curTab.color,
                    border: `1px solid ${curTab.color}30`, letterSpacing: "0.04em",
                  }}>
                    {count} filtre{count > 1 ? "s" : ""} actif{count > 1 ? "s" : ""}
                  </span>
                  <button type="button"
                    onClick={() => {
                      setStaffSearch(""); setStaffStatusFilter(""); setStaffWilayaFilter("");
                      setStaffHasCommunes(null); setStaffHasVehicle(null); setStaffStopDeskFilter(""); setStaffUnassigned(null);
                      setClientWilayaFilter(""); setClientHasPhone2(null);
                      if (isClientTab) handleSearch("");
                    }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 600, color: t.textMuted,
                      padding: "3px 6px", borderRadius: 6,
                      textDecoration: "underline", textUnderlineOffset: 2,
                      transition: "color 0.12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                    onMouseLeave={e => (e.currentTarget.style.color = t.textMuted)}
                  >
                    Réinitialiser
                  </button>
                </div>
              );
            })()}
          </div>

          {/* ── Row 2: Active filter chips ── */}
          {(() => {
            const chips: { label: string; onRemove: () => void }[] = [];
            if (!isClientTab) {
              if (staffSearch)       chips.push({ label: `"${staffSearch}"`,                     onRemove: () => setStaffSearch("") });
              if (staffStatusFilter) chips.push({ label: STATUS_CFG[staffStatusFilter as keyof typeof STATUS_CFG]?.label ?? staffStatusFilter, onRemove: () => setStaffStatusFilter("") });
              if (staffWilayaFilter) chips.push({ label: wilayas.find(w => String(w.id) === staffWilayaFilter)?.name ?? staffWilayaFilter, onRemove: () => setStaffWilayaFilter("") });
              if (staffStopDeskFilter) chips.push({ label: stopDesks.find(s => String(s.id) === staffStopDeskFilter)?.name ?? staffStopDeskFilter, onRemove: () => setStaffStopDeskFilter("") });
              if (staffHasCommunes === true)  chips.push({ label: "Avec communes",  onRemove: () => setStaffHasCommunes(null) });
              if (staffHasCommunes === false) chips.push({ label: "Sans communes",  onRemove: () => setStaffHasCommunes(null) });
              if (staffHasVehicle  === true)  chips.push({ label: "Avec véhicule",  onRemove: () => setStaffHasVehicle(null) });
              if (staffHasVehicle  === false) chips.push({ label: "Sans véhicule",  onRemove: () => setStaffHasVehicle(null) });
              if (staffUnassigned  === true)  chips.push({ label: "Non assignés",   onRemove: () => setStaffUnassigned(null) });
              if (staffUnassigned  === false) chips.push({ label: "Assignés",        onRemove: () => setStaffUnassigned(null) });
            } else {
              if (search)            chips.push({ label: `"${search}"`,                           onRemove: () => handleSearch("") });
              if (clientWilayaFilter) chips.push({ label: wilayas.find(w => String(w.id) === clientWilayaFilter)?.name ?? clientWilayaFilter, onRemove: () => setClientWilayaFilter("") });
              if (clientHasPhone2 === true)  chips.push({ label: "Avec tél. 2",  onRemove: () => setClientHasPhone2(null) });
              if (clientHasPhone2 === false) chips.push({ label: "Sans tél. 2",  onRemove: () => setClientHasPhone2(null) });
            }
            if (chips.length === 0) return null;
            return (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8, width: "100%" }}>
                {chips.map((chip, i) => (
                  <span key={i} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 8px 3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                    background: `${curTab.color}0f`, color: curTab.color,
                    border: `1px solid ${curTab.color}28`,
                  }}>
                    {chip.label}
                    <button type="button" onClick={chip.onRemove} style={{
                      background: "none", border: "none", cursor: "pointer", color: curTab.color,
                      padding: 0, display: "flex", opacity: 0.7, lineHeight: 1,
                    }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={e => (e.currentTarget.style.opacity = "0.7")}
                    ><X size={10} /></button>
                  </span>
                ))}
                {!isClientTab && (
                  <span style={{ fontSize: 11, color: t.textFaint, alignSelf: "center", marginLeft: 4 }}>
                    {staffList.length} / {staffListRaw.length} résultat{staffList.length !== 1 ? "s" : ""}
                  </span>
                )}
                {isClientTab && filteredClients.length !== (clients?.data ?? []).length && (
                  <span style={{ fontSize: 11, color: t.textFaint, alignSelf: "center", marginLeft: 4 }}>
                    {filteredClients.length} / {(clients?.data ?? []).length} résultat{filteredClients.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              {!isClientTab ? (
                <tr>
                  <th style={th}>Utilisateur</th>
                  <th style={th}>Téléphone</th>
                  <th style={th}>
                    {tab === "responsable" ? "Stop Desk"
                      : tab === "expediteur" ? "Entreprise"
                      : (tab === "chauffeur" || tab === "transit_chauffeur") ? "Communes / Véhicule"
                      : "Info"}
                  </th>
                  <th style={{ ...th, textAlign: "center" }}>Statut</th>
                  <th style={th}>Créé le</th>
                  <th style={th}>Rôle</th>
                  <th style={{ ...th, textAlign: "right" }}>Actions</th>
                </tr>
              ) : (
                <tr>
                  <th style={th}>Nom</th>
                  <th style={th}>Téléphone(s)</th>
                  <th style={th}>Localisation</th>
                  <th style={th}>Stop Desk</th>
                  <th style={th}>Créé par</th>
                  <th style={th}>Date</th>
                  <th style={{ ...th, textAlign: "right" }}>Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {/* Loading */}
              {loading && (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", padding: 40, color: t.textMuted }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Loader2 size={14} className="animate-spin" /> Chargement…
                  </div>
                </td></tr>
              )}

              {/* Staff empty state */}
              {!loading && !isClientTab && staffList.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", padding: 52 }}>
                  <Users size={28} color={t.textFaint} style={{ display: "block", margin: "0 auto 8px" }} />
                  <p style={{ margin: 0, fontSize: 13, color: t.textFaint }}>
                    Aucun utilisateur. Cliquez sur «{NEW_LABELS[tab]}» pour en créer un.
                  </p>
                </td></tr>
              )}

              {/* Staff rows */}
              {!loading && !isClientTab && staffList.map(u => {
                const rc = ROLE_CFG[u.user_type] ?? { color: "#9ca3af", bg: "rgba(156,163,175,0.1)", label: u.user_type };
                const isDriverRow = u.user_type === "chauffeur" || u.user_type === "transit_chauffeur";
                const communeCount = (u.communes ?? []).length;
                return (
                  <tr key={u.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = t.rowHover}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                    style={{ transition: "background 0.1s" }}
                  >
                    {/* Name + email */}
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar first={u.first_name} last={u.last_name} role={u.user_type} size={34} />
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: t.text }}>{u.first_name} {u.last_name}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textFaint, display: "flex", alignItems: "center", gap: 4 }}>
                            <Mail size={10} /> {u.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td style={{ ...td, fontSize: 13 }}>
                      {u.phone
                        ? <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Phone size={11} color={t.textFaint} />{u.phone}</span>
                        : <span style={{ color: t.textFaint }}>—</span>}
                    </td>

                    {/* Role-specific info column */}
                    <td style={{ ...td, fontSize: 12 }}>
                      {u.user_type === "responsable" && (
                        u.stop_desk ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: "rgba(16,185,129,0.1)", color: "#059669",
                            border: "1px solid rgba(16,185,129,0.2)",
                          }}>
                            <Building2 size={10} /> {u.stop_desk.name}
                          </span>
                        ) : (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: "rgba(239,68,68,0.07)", color: "#ef4444",
                            border: "1px solid rgba(239,68,68,0.15)",
                          }}>
                            Non assigné
                          </span>
                        )
                      )}
                      {u.user_type === "expediteur" && (
                        <div>
                          {u.company_name && (
                            <p style={{ margin: "0 0 4px", fontWeight: 600, color: t.text, fontSize: 12 }}>{u.company_name}</p>
                          )}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                            {u.wilaya ? (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                background: `${rc.color}12`, color: rc.color,
                                border: `1px solid ${rc.color}25`,
                              }}>
                                <MapPin size={9} /> {u.wilaya.name}
                              </span>
                            ) : (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                                background: "rgba(239,68,68,0.07)", color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.15)",
                              }}>
                                Non assigné
                              </span>
                            )}
                            {u.nif && <span style={{ fontSize: 11, color: t.textFaint }}>NIF: {u.nif}</span>}
                          </div>
                        </div>
                      )}
                      {isDriverRow && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {/* Communes badge */}
                          {communeCount > 0 ? (
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                              background: `${rc.color}14`, color: rc.color, alignSelf: "flex-start",
                            }}>
                              <MapPin size={9} /> {communeCount} commune{communeCount > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span style={{ color: t.textFaint, fontSize: 11 }}>Aucune commune</span>
                          )}
                          {/* Vehicle */}
                          {u.vehicle_plate && (
                            <span style={{ display: "flex", alignItems: "center", gap: 4, color: t.textMuted, fontSize: 11 }}>
                              <Car size={10} color={t.textFaint} />
                              {u.vehicle_plate}
                              {u.vehicle_type && <span style={{ color: t.textFaint }}>· {u.vehicle_type}</span>}
                              {u.vehicle_marque && <span style={{ color: t.textFaint }}>· {u.vehicle_marque}</span>}
                            </span>
                          )}
                          {/* Permis */}
                          {u.permis_numero && (
                            <span style={{ fontSize: 11, color: t.textFaint }}>
                              Permis {u.permis_numero}{u.permis_categorie ? ` (Cat. ${u.permis_categorie})` : ""}
                            </span>
                          )}
                        </div>
                      )}
                      {u.user_type === "operator" && (
                        u.stop_desk ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: "rgba(245,158,11,0.1)", color: "#d97706",
                            border: "1px solid rgba(245,158,11,0.2)",
                          }}>
                            <Building2 size={10} /> {u.stop_desk.name}
                          </span>
                        ) : (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "2px 9px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                            background: "rgba(239,68,68,0.07)", color: "#ef4444",
                            border: "1px solid rgba(239,68,68,0.15)",
                          }}>
                            Non assigné
                          </span>
                        )
                      )}
                      {u.user_type === "admin" && (
                        <span style={{ color: t.textFaint }}>—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ ...td, textAlign: "center" }}>
                      <StatusChip status={u.status} onClick={() => handleToggle(u)} />
                    </td>

                    {/* Created at */}
                    <td style={{ ...td, fontSize: 12, whiteSpace: "nowrap", color: t.textMuted }}>
                      {u.created_at ? fmtDate(u.created_at) : <span style={{ color: t.textFaint }}>—</span>}
                    </td>

                    {/* Role (custom roles & permissions) */}
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {isOperatorView ? (
                        (() => {
                          const rid = currentRoleId(u);
                          const r = roles.find(x => x.id === rid);
                          return r
                            ? <span style={{ fontSize: 12, fontWeight: 600, color: t.textSub }}>{r.name}</span>
                            : <span style={{ fontSize: 12, color: t.textFaint }}>Aucun</span>;
                        })()
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <select
                            value={currentRoleId(u) ?? ""}
                            disabled={roleSaving === u.id}
                            onChange={(e) => handleAssignRole(u, e.target.value ? Number(e.target.value) : null)}
                            style={{
                              background: t.inp.bg, border: `1.5px solid ${t.inp.border}`, borderRadius: 8,
                              padding: "6px 9px", fontSize: 12, color: t.inp.text, outline: "none",
                              cursor: roleSaving === u.id ? "wait" : "pointer", maxWidth: 150,
                            }}
                          >
                            <option value="">Aucun</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                          {roleSaving === u.id && <Loader2 size={13} className="animate-spin" color={t.textMuted} />}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ ...td, textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                        {/* Role-specific icon buttons */}
                        {isDriverRow && (
                          <IconBtn onClick={() => {
                            setCommuneIds((u.communes ?? []).map(c => c.id));
                            setCommunePrices(Object.fromEntries((u.communes ?? []).map(c => [c.id, c.pivot?.price != null ? String(c.pivot.price) : ""])));
                            setCommuneUser(u);
                          }} title="Gérer les communes">
                            <MapPin size={13} color={rc.color} />
                          </IconBtn>
                        )}
                        {isDriverRow && (
                          <IconBtn onClick={() => setVehicleUser(u)} title="Véhicule & Documents">
                            <Car size={13} color={rc.color} />
                          </IconBtn>
                        )}
                        {!isOperatorView && (u.user_type === "responsable" || u.user_type === "operator" || u.user_type === "expediteur") && (
                          <IconBtn onClick={() => setSdUser(u)} title="Assigner Stop Desk">
                            <Building2 size={13} color={rc.color} />
                          </IconBtn>
                        )}
                        {canEditUser(u) && u.user_type === "expediteur" && (
                          <IconBtn onClick={() => setWilayaUser(u)} title="Wilaya assignée">
                            <MapPin size={13} color={rc.color} />
                          </IconBtn>
                        )}
                        {(u.rc_file || u.nif_file || u.nis_file || u.permis_file || u.cin_file) && (
                          <IconBtn onClick={() => setDocsUser(u)} title="Voir les documents">
                            <FileCheck size={13} color={t.textMuted} />
                          </IconBtn>
                        )}
                        <Link href={`/dashboard/users/${u.id}/performance`} title="Performance"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 7px", borderRadius: 6, cursor: "pointer" }}>
                          <BarChart3 size={13} color={t.textMuted} />
                        </Link>
                        {u.user_type === "expediteur" && (
                          <Link href={`/dashboard/users/${u.id}/stock`} title="Stock & produits"
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 7px", borderRadius: 6, cursor: "pointer" }}>
                            <Boxes size={13} color={t.textMuted} />
                          </Link>
                        )}
                        <IconBtn onClick={() => setDetailUser(u)} title="Voir les détails">
                          <Eye size={13} color={t.textMuted} />
                        </IconBtn>
                        {canEditUser(u) && (
                          <IconBtn onClick={() => { setEditUser(u); setStaffModal(true); }} title="Modifier">
                            <Pencil size={13} color={t.textMuted} />
                          </IconBtn>
                        )}
                        {canEditUser(u) && (
                          <IconBtn onClick={() => handleDeleteUser(u)} title="Supprimer" danger>
                            <Trash2 size={13} />
                          </IconBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Client empty state */}
              {!loading && isClientTab && filteredClients.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", padding: 52 }}>
                  <Package size={28} color={t.textFaint} style={{ display: "block", margin: "0 auto 8px" }} />
                  <p style={{ margin: 0, fontSize: 13, color: t.textFaint }}>Aucun client. Cliquez sur «Nouveau Client» pour en ajouter un.</p>
                </td></tr>
              )}

              {/* Client rows */}
              {!loading && isClientTab && filteredClients.map(c => (
                <tr key={c.id}
                  onClick={() => setDetailClient(c)}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = t.rowHover}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  style={{ cursor: "pointer", transition: "background 0.1s" }}
                >
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Avatar first={c.first_name} last={c.last_name} role="operator" size={32} />
                      <span style={{ fontWeight: 500, color: t.text }}>{c.first_name} {c.last_name}</span>
                    </div>
                  </td>
                  <td style={td}>
                    <p style={{ margin: 0 }}>{c.phone1}</p>
                    {c.phone2 && <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textFaint }}>{c.phone2}</p>}
                  </td>
                  <td style={{ ...td, fontSize: 12 }}>
                    {c.wilaya ? <>{c.wilaya.name}{c.commune ? <span style={{ color: t.textFaint }}> / {c.commune.name}</span> : null}</> : <span style={{ color: t.textFaint }}>—</span>}
                  </td>
                  <td style={{ ...td, fontSize: 12 }}>{c.stop_desk?.name ?? <span style={{ color: t.textFaint }}>—</span>}</td>
                  <td style={{ ...td, fontSize: 12 }}>
                    {c.created_by_user ? `${c.created_by_user.first_name} ${c.created_by_user.last_name}` : <span style={{ color: t.textFaint }}>—</span>}
                  </td>
                  <td style={{ ...td, fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(c.created_at)}</td>
                  <td style={{ ...td, textAlign: "right" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                      <IconBtn onClick={() => { setEditClient(c); setClientModal(true); }} title="Modifier"><Pencil size={13} color={t.textMuted} /></IconBtn>
                      <IconBtn onClick={() => handleDeleteClient(c)} title="Supprimer" danger><Trash2 size={13} /></IconBtn>
                      <IconBtn onClick={() => setDetailClient(c)} title="Voir détails"><ChevronRight size={13} color={t.textMuted} /></IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {isClientTab && clients && clients.last_page > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 16px", borderTop: `1px solid ${t.border}` }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500, border: `1.5px solid ${t.border}`, background: "transparent", color: page === 1 ? t.textFaint : t.textSub, cursor: page === 1 ? "not-allowed" : "pointer", opacity: page === 1 ? 0.45 : 1 }}>
              Précédent
            </button>
            <span style={{ fontSize: 12, color: t.textMuted }}>
              Page <strong style={{ color: t.text }}>{page}</strong> / {clients.last_page}
            </span>
            <button disabled={page === clients.last_page} onClick={() => setPage(p => p + 1)} style={{ padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500, border: `1.5px solid ${t.border}`, background: "transparent", color: page === clients.last_page ? t.textFaint : t.textSub, cursor: page === clients.last_page ? "not-allowed" : "pointer", opacity: page === clients.last_page ? 0.45 : 1 }}>
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
