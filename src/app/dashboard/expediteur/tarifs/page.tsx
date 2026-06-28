"use client";

import { useMemo, useState } from "react";
import { Receipt, Search, Home, Store, RotateCcw, Clock } from "lucide-react";
import { useIsDark, useTokens, PageHeader, Badge, ORANGE } from "../_ui";
import { DZ_TARIFS, ZONE_LABELS } from "@/lib/dz-demo";

const ZONE_COLORS: Record<string, string> = {
  A: "#22c55e", B: "#3b82f6", C: "#f59e0b", D: "#f97316", E: "#ef4444",
};

function DA(n: number) {
  return n.toLocaleString("fr-DZ") + " DA";
}

export default function TarifsPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState<string>("all");

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return DZ_TARIFS.filter((r) =>
      (zone === "all" || r.zone === zone) &&
      (!s || r.name.toLowerCase().includes(s) || r.code.includes(s)),
    );
  }, [search, zone]);

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader
        title="Grille tarifaire"
        subtitle="Tarifs de livraison par wilaya — domicile & stop desk (TTC)"
        icon={Receipt}
        t={t}
      />

      {/* Zone filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {[["all", "Toutes les zones"], ...Object.entries(ZONE_LABELS)].map(([k, label]) => {
          const active = zone === k;
          const c = k === "all" ? ORANGE : ZONE_COLORS[k];
          return (
            <button
              key={k}
              onClick={() => setZone(k)}
              style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                cursor: "pointer", transition: "all .15s",
                border: `1px solid ${active ? c : t.border}`,
                background: active ? c + "14" : t.card,
                color: active ? c : t.textSub,
              }}
            >
              {label as string}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 360, marginBottom: 18 }}>
        <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 12, top: 11 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une wilaya…"
          style={{
            width: "100%", padding: "9px 12px 9px 34px", borderRadius: 9, fontSize: 13.5,
            background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none",
          }}
        />
      </div>

      {/* Table */}
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.divider}`, background: isDark ? "#0b0e16" : "#fafafa" }}>
                {[
                  ["Code", "left"], ["Wilaya", "left"], ["Zone", "left"],
                  ["Domicile", "right"], ["Stop Desk", "right"], ["Retour", "right"], ["Délai", "right"],
                ].map(([h, al]) => (
                  <th key={h as string} style={{
                    padding: "12px 16px", textAlign: al as "left" | "right",
                    fontSize: 11, fontWeight: 700, color: t.textMuted,
                    textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code}
                  style={{ borderBottom: `1px solid ${t.divider}`, transition: "background .1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = t.rowHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "11px 16px", fontFamily: "monospace", fontWeight: 700, color: ORANGE }}>{r.code}</td>
                  <td style={{ padding: "11px 16px", fontWeight: 600, color: t.text }}>{r.name}</td>
                  <td style={{ padding: "11px 16px" }}>
                    <Badge color={ZONE_COLORS[r.zone]} bg={ZONE_COLORS[r.zone] + "18"}>{ZONE_LABELS[r.zone]}</Badge>
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "right", fontWeight: 700, color: t.text }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      <Home size={13} color={t.textFaint} />{DA(r.domicile)}
                    </span>
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "right", fontWeight: 600, color: t.textSub }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      <Store size={13} color={t.textFaint} />{DA(r.stopdesk)}
                    </span>
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "right", color: t.textMuted }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      <RotateCcw size={13} color={t.textFaint} />{DA(r.retour)}
                    </span>
                  </td>
                  <td style={{ padding: "11px 16px", textAlign: "right", color: t.textMuted, whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      <Clock size={13} color={t.textFaint} />{r.delai}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: t.textMuted }}>Aucune wilaya trouvée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: t.textFaint, marginTop: 14 }}>
        {rows.length} wilaya(s) affichée(s) · Tarifs indicatifs — configurables par expéditeur depuis votre espace commercial.
      </p>
    </div>
  );
}
