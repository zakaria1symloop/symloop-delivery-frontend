"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Building2, X, ChevronDown, Network, Store, MapPin } from "lucide-react";

export interface SDOption {
  id: number;
  name: string;
  code: string | null;
  type: string;
  parent_sd_id: number | null;
  commune?: { id: number; name: string; wilaya_id: number; wilaya?: { id: number; name: string } };
}

interface Props {
  stopDesks: SDOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ROLE_CFG: Record<string, { label: string; color: string; bg: string; Icon: typeof Network }> = {
  hub:      { label: "Hub",       color: "#10b981", bg: "rgba(16,185,129,0.1)",  Icon: Network   },
  agence:   { label: "Agence",    color: "#3b82f6", bg: "rgba(59,130,246,0.1)",  Icon: Building2 },
  depot:    { label: "Dépôt",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  Icon: Store     },
};

export default function SDSelector({ stopDesks, value, onChange, disabled, placeholder = "Sélectionner un Stop Desk..." }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [wilayaFilter, setWilayaFilter] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = stopDesks.find(sd => sd.id === value);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Unique wilayas from stop desks
  const wilayas = Array.from(
    new Map(
      stopDesks
        .filter(sd => sd.commune?.wilaya)
        .map(sd => [sd.commune!.wilaya!.id, sd.commune!.wilaya!])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Filter
  const filtered = stopDesks.filter(sd => {
    if (wilayaFilter && sd.commune?.wilaya_id?.toString() !== wilayaFilter) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      sd.name.toLowerCase().includes(s) ||
      (sd.code ?? "").toLowerCase().includes(s) ||
      (sd.commune?.name ?? "").toLowerCase().includes(s) ||
      (sd.commune?.wilaya?.name ?? "").toLowerCase().includes(s)
    );
  });

  // Group by type
  const hubs = filtered.filter(sd => sd.type === "hub");
  const others = filtered.filter(sd => sd.type !== "hub");

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const t = {
    bg: isDark ? "#111827" : "#ffffff",
    border: isDark ? "#1e2130" : "#e5e7eb",
    text: isDark ? "#f0f0f5" : "#111827",
    textMuted: isDark ? "#6b7280" : "#6b7280",
    textFaint: isDark ? "#4b5563" : "#9ca3af",
    hover: isDark ? "#1a1f2e" : "#f9fafb",
    input: isDark ? "#1e2130" : "#f3f4f6",
    shadow: isDark ? "0 8px 24px rgba(0,0,0,0.4)" : "0 8px 24px rgba(0,0,0,0.12)",
  };

  function handleSelect(sd: SDOption) {
    onChange(sd.id);
    setOpen(false);
    setSearch("");
  }

  const cfg = ROLE_CFG[selected?.type ?? "agence"] ?? ROLE_CFG.agence;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        disabled={disabled}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", borderRadius: 12, whiteSpace: "nowrap",
          border: `1.5px solid ${open ? "#f97316" : t.border}`,
          background: t.bg, cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1, transition: "border-color 150ms",
        }}
      >
        {selected ? (
          <>
            <div style={{
              width: 28, height: 28, borderRadius: 7, flexShrink: 0,
              background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <cfg.Icon size={14} color={cfg.color} strokeWidth={2} />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>
                {selected.name}
                {selected.code && <span style={{ fontWeight: 400, color: t.textFaint, marginLeft: 6, fontSize: 11 }}>({selected.code})</span>}
              </div>
              <div style={{ fontSize: 11, color: t.textMuted }}>
                {selected.commune?.wilaya?.name ?? ""}{selected.commune?.name ? ` · ${selected.commune.name}` : ""}
              </div>
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`,
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>{cfg.label}</span>
          </>
        ) : (
          <span style={{ flex: 1, textAlign: "left", fontSize: 13, color: t.textMuted }}>{placeholder}</span>
        )}
        <ChevronDown size={14} style={{ color: t.textFaint, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50, minWidth: 360,
          background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12,
          boxShadow: t.shadow, overflow: "hidden", maxHeight: 380,
          display: "flex", flexDirection: "column",
        }}>
          {/* Search */}
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${t.border}`, display: "flex", gap: 8 }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 6,
              background: t.input, borderRadius: 8, padding: "0 10px",
            }}>
              <Search size={13} style={{ color: t.textFaint, flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, code, wilaya..."
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  color: t.text, fontSize: 12, padding: "8px 0",
                }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                  <X size={12} style={{ color: t.textFaint }} />
                </button>
              )}
            </div>
            {wilayas.length > 1 && (
              <select
                value={wilayaFilter}
                onChange={e => setWilayaFilter(e.target.value)}
                style={{
                  border: `1px solid ${t.border}`, borderRadius: 8,
                  background: t.input, color: t.text, fontSize: 11, padding: "0 8px",
                  cursor: "pointer",
                }}
              >
                <option value="">Toutes wilayas</option>
                {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            )}
          </div>

          {/* Results */}
          <div style={{ overflowY: "auto", maxHeight: 300 }}>
            {filtered.length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: t.textMuted }}>
                Aucun Stop Desk trouvé
              </div>
            )}
            {hubs.length > 0 && (
              <>
                <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Hubs ({hubs.length})
                </div>
                {hubs.map(sd => <SDItem key={sd.id} sd={sd} selected={sd.id === value} t={t} onClick={() => handleSelect(sd)} />)}
              </>
            )}
            {others.length > 0 && (
              <>
                {hubs.length > 0 && (
                  <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.08em", borderTop: `1px solid ${t.border}`, marginTop: 4 }}>
                    Points ({others.length})
                  </div>
                )}
                {others.map(sd => <SDItem key={sd.id} sd={sd} selected={sd.id === value} t={t} onClick={() => handleSelect(sd)} />)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SDItem({ sd, selected, t, onClick }: { sd: SDOption; selected: boolean; t: any; onClick: () => void }) {
  const cfg = ROLE_CFG[sd.type] ?? ROLE_CFG.agence;
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "8px 14px", border: "none", cursor: "pointer",
        background: selected ? "rgba(249,115,22,0.08)" : "transparent",
        borderLeft: selected ? "3px solid #f97316" : "3px solid transparent",
        transition: "background 100ms",
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget.style.background = t.hover); }}
      onMouseLeave={e => { if (!selected) (e.currentTarget.style.background = "transparent"); }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <cfg.Icon size={12} color={cfg.color} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ fontSize: 12, fontWeight: selected ? 700 : 500, color: t.text }}>
          {sd.name}
          {sd.code && <span style={{ fontWeight: 400, color: t.textFaint, marginLeft: 4, fontSize: 10 }}>{sd.code}</span>}
        </div>
        <div style={{ fontSize: 10, color: t.textMuted }}>
          {sd.commune?.wilaya?.name ?? ""}{sd.commune?.name ? ` · ${sd.commune.name}` : ""}
        </div>
      </div>
      {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f97316", flexShrink: 0 }} />}
    </button>
  );
}
