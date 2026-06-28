"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown, Truck, MapPin, Package2, Phone } from "lucide-react";
import type { DriverKPIs } from "@/lib/drivers";

interface Props {
  drivers: DriverKPIs[];
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

const VEHICLE_LABELS: Record<string, string> = {
  moto: "Moto", voiture: "Voiture", camionette: "Camionette", camion: "Camion",
};

export default function DriverSelector({ drivers, value, onChange, disabled, placeholder = "Choisir un chauffeur..." }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = drivers.find(d => d.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = drivers.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${d.first_name} ${d.last_name}`.toLowerCase().includes(q) ||
      (d.phone ?? "").includes(q) ||
      (d.vehicle_plate ?? "").toLowerCase().includes(q)
    );
  });

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const tk = isDark
    ? { bg: "#111827", border: "#1e2130", text: "#f0f0f5", sub: "#9ca3af", muted: "#6b7280", hover: "#1a1f2e", inp: "#1e2130" }
    : { bg: "#ffffff", border: "#e5e7eb", text: "#111827", sub: "#6b7280", muted: "#9ca3af", hover: "#f9fafb", inp: "#ffffff" };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", borderRadius: 12,
          border: `1.5px solid ${open ? "#f97316" : tk.border}`,
          background: tk.bg, cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1, textAlign: "left",
          transition: "border-color 0.15s",
        }}
      >
        {selected ? (
          <>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#0ea5e9",
            }}>
              {selected.first_name[0]}{selected.last_name[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: tk.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selected.first_name} {selected.last_name}
              </div>
              <div style={{ fontSize: 11, color: tk.sub, display: "flex", alignItems: "center", gap: 6 }}>
                {selected.phone && <span>{selected.phone}</span>}
                {selected.vehicle_type && <span>· {VEHICLE_LABELS[selected.vehicle_type] ?? selected.vehicle_type}</span>}
                {selected.current_packages > 0 && (
                  <span style={{ color: "#f97316", fontWeight: 600 }}>· {selected.current_packages} en cours</span>
                )}
              </div>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); onChange(null); setSearch(""); }}
              onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); onChange(null); setSearch(""); } }}
              style={{ background: "transparent", border: "none", padding: 4, cursor: "pointer", borderRadius: 6, display: "inline-flex" }}
            >
              <X size={14} color={tk.muted} />
            </span>
          </>
        ) : (
          <>
            <Truck size={16} color={tk.muted} />
            <span style={{ flex: 1, fontSize: 13, color: tk.muted }}>{placeholder}</span>
            <ChevronDown size={14} color={tk.muted} style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 100,
          background: tk.bg, border: `1.5px solid ${tk.border}`, borderRadius: 14,
          boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(0,0,0,0.12)",
          overflow: "hidden",
        }}>
          {/* Search */}
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${tk.border}` }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: tk.muted }} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom, téléphone..."
                style={{
                  width: "100%", padding: "8px 10px 8px 32px", borderRadius: 8,
                  border: `1px solid ${tk.border}`, background: tk.inp, color: tk.text,
                  fontSize: 12, outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Results */}
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "20px 16px", textAlign: "center", color: tk.muted, fontSize: 12 }}>
                Aucun chauffeur trouvé
              </div>
            ) : (
              filtered.map(d => {
                const active = d.id === value;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => { onChange(d.id); setOpen(false); setSearch(""); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", border: "none", cursor: "pointer",
                      textAlign: "left",
                      background: active ? "rgba(14,165,233,0.08)" : "transparent",
                      borderLeft: active ? "3px solid #0ea5e9" : "3px solid transparent",
                      borderBottom: `1px solid ${tk.border}`,
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = tk.hover; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                      background: active ? "rgba(14,165,233,0.15)" : (isDark ? "rgba(255,255,255,0.06)" : "#f3f4f6"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: active ? "#0ea5e9" : tk.sub,
                    }}>
                      {d.first_name[0]}{d.last_name[0]}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: tk.text }}>
                        {d.first_name} {d.last_name}
                      </div>
                      <div style={{ fontSize: 11, color: tk.sub, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        {d.phone && <span style={{ display: "flex", alignItems: "center", gap: 2 }}><Phone size={9} /> {d.phone}</span>}
                        {d.vehicle_type && <span>· {VEHICLE_LABELS[d.vehicle_type] ?? d.vehicle_type}</span>}
                        {d.vehicle_plate && <span style={{ fontFamily: "monospace", fontSize: 10 }}>· {d.vehicle_plate}</span>}
                      </div>
                    </div>

                    {/* Right side: stats */}
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {d.current_packages > 0 && (
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: "#f97316",
                          background: "rgba(249,115,22,0.1)", padding: "2px 8px", borderRadius: 99,
                          marginBottom: 2,
                        }}>
                          {d.current_packages} en cours
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: tk.muted }}>
                        {d.communes.length} commune{d.communes.length !== 1 ? "s" : ""}
                      </div>
                      {d.total_assigned > 0 && (
                        <div style={{
                          fontSize: 10, fontWeight: 600,
                          color: d.delivery_rate >= 80 ? "#16a34a" : d.delivery_rate >= 50 ? "#f59e0b" : "#ef4444",
                        }}>
                          {d.delivery_rate}% taux
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
