"use client";

import type { ElementType } from "react";
import { ORANGE, type Tokens } from "../../../_ui";

/** Lightweight card used by the foundation-phase tab stubs. The Tabs phase
 *  replaces each tab body with its real content. */
export function TabPlaceholder({ t, icon: Icon, title }: { t: Tokens; icon: ElementType; title: string }) {
  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
      boxShadow: t.shadow, padding: 28,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: ORANGE + "14",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon size={18} color={ORANGE} />
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 750, color: t.text, letterSpacing: -0.3 }}>{title}</h2>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
        Section « {title} » — sera complétée lors de la phase Tabs.
      </p>
    </div>
  );
}
