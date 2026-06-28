"use client";

import { Package2, Truck, DollarSign, ArrowUpRight } from "lucide-react";

export default function ProfessionalDashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#fff" }}>Professional Dashboard</h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
          Manage shipments, track packages, and view financials.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "My Shipments",   icon: Package2,     color: "#a78bfa" },
          { label: "Track Package",  icon: Truck,        color: "#a78bfa" },
          { label: "Financials",     icon: DollarSign,   color: "#a78bfa" },
          { label: "New Shipment",   icon: ArrowUpRight, color: "#a78bfa" },
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
