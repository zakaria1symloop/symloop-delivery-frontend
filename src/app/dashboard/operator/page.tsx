"use client";

import { Package2, ScanLine, ClipboardList, ArrowUpRight } from "lucide-react";

export default function OperatorDashboard() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#fff" }}>Operator Dashboard</h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
          Manage packages, scanning, and daily operations.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Scan Package",      icon: ScanLine,      color: "#f59e0b" },
          { label: "Package List",      icon: Package2,      color: "#f59e0b" },
          { label: "Daily Report",      icon: ClipboardList, color: "#f59e0b" },
          { label: "Pending Pickups",   icon: ArrowUpRight,  color: "#f59e0b" },
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
