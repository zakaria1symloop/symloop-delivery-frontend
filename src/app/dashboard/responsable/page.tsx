"use client";

import { MapPin, Users, TrendingUp, ArrowUpRight } from "lucide-react";

export default function ResponsableDashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#fff" }}>Responsable Dashboard</h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
          Oversee selling points, operators, and regional logistics.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Selling Points", icon: MapPin,      color: "#10b981" },
          { label: "Operators",      icon: Users,       color: "#10b981" },
          { label: "Performance",    icon: TrendingUp,  color: "#10b981" },
          { label: "Region Report",  icon: ArrowUpRight,color: "#10b981" },
        ].map(({ label, icon: Icon, color }) => (
          <div
            key={label}
            style={{
              background: "#0b0e17",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "20px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "rgba(255,255,255,0.6)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <div style={{ padding: 8, borderRadius: 8, background: `${color}18` }}>
              <Icon size={16} color={color} />
            </div>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
