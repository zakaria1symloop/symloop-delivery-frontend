"use client";

import { useMemo, useState } from "react";
import { Building2, Search, MapPin, Phone, Clock, Warehouse } from "lucide-react";
import { useIsDark, useTokens, PageHeader, Badge, ORANGE } from "../_ui";
import { DZ_BUREAUX } from "@/lib/dz-demo";

export default function BureauxPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "HUB" | "Agence">("all");

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return DZ_BUREAUX.filter((b) =>
      (type === "all" || b.type === type) &&
      (!s || b.name.toLowerCase().includes(s) || b.wilaya.toLowerCase().includes(s) || b.commune.toLowerCase().includes(s)),
    );
  }, [search, type]);

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader
        title="Nos Bureaux"
        subtitle={`${DZ_BUREAUX.length} points de service à travers l'Algérie`}
        icon={Building2}
        t={t}
      />

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 360 }}>
          <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 12, top: 11 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par bureau, wilaya, commune…"
            style={{
              width: "100%", padding: "9px 12px 9px 34px", borderRadius: 9, fontSize: 13.5,
              background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["all", "HUB", "Agence"] as const).map((k) => {
            const active = type === k;
            return (
              <button key={k} onClick={() => setType(k)}
                style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${active ? ORANGE : t.border}`,
                  background: active ? ORANGE + "14" : t.card,
                  color: active ? ORANGE : t.textSub,
                }}>
                {k === "all" ? "Tous" : k === "HUB" ? "Hubs" : "Agences"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {rows.map((b) => {
          const isHub = b.type === "HUB";
          const accent = isHub ? ORANGE : "#3b82f6";
          return (
            <div key={b.id} style={{
              background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
              padding: 18, boxShadow: t.shadow, position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 11, background: accent + "14",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {isHub ? <Warehouse size={20} color={accent} /> : <Building2 size={20} color={accent} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>{b.name}</div>
                    <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>{b.wilaya} · {b.commune}</div>
                  </div>
                </div>
                <Badge color={accent} bg={accent + "18"}>{b.type}</Badge>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 12.5 }}>
                <Row icon={<MapPin size={14} color={t.textFaint} />} text={`${b.address}`} t={t} />
                <Row icon={<Phone size={14} color={t.textFaint} />} text={b.phone} t={t} mono />
                <Row icon={<Clock size={14} color={t.textFaint} />} text={b.hours} t={t} />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: t.textMuted }}>Aucun bureau trouvé</div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, text, t, mono }: { icon: React.ReactNode; text: string; t: ReturnType<typeof useTokens>; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ color: t.textSub, fontFamily: mono ? "monospace" : undefined }}>{text}</span>
    </div>
  );
}
