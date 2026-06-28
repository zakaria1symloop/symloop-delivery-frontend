"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import JsBarcode from "jsbarcode";

/* ── Dark-mode sync ── */
export function useIsDark() {
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

export function useTokens(isDark: boolean) {
  return isDark ? {
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130", rowHover: "#1a1f2e",
    text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280", textFaint: "#4b5563",
    shadow: "none", codeBg: "#0b0e16", codeBorder: "#1e2130", sectionBg: "#0f1623",
    inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", codeBg: "#0f172a", codeBorder: "#1e293b", sectionBg: "#f9fafb",
    inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

export type Tokens = ReturnType<typeof useTokens>;

export const ORANGE = "#f97316";

export function formatDA(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString("fr-DZ") + " DA";
}

/* ── Page header ── */
export function PageHeader({
  title, subtitle, icon: Icon, t, action,
}: {
  title: string; subtitle?: string;
  icon?: React.ElementType; t: Tokens;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 26, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {Icon && (
          <div style={{ width: 44, height: 44, borderRadius: 12, background: ORANGE + "14", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={22} color={ORANGE} />
          </div>
        )}
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 750, color: t.text, margin: 0, letterSpacing: -0.5 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 13, color: t.textMuted, margin: "4px 0 0" }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color, background: bg, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

/* ── Back button ── */
export function BackButton({ t, label = "Retour", href }: { t: Tokens; label?: string; href?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (href ? router.push(href) : router.back())}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9,
        background: t.card, border: `1px solid ${t.border}`, color: t.textSub,
        fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 18,
      }}
    >
      <ArrowLeft size={15} /> {label}
    </button>
  );
}

/* ── Barcode (CODE128) — always rendered dark-on-white for scannability ── */
export function Barcode({ value, height = 46, width = 1.4, fontSize = 12 }: { value: string; height?: number; width?: number; fontSize?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128", width, height, displayValue: true,
          fontSize, font: "monospace", textMargin: 2, margin: 4,
          background: "#ffffff", lineColor: "#000000",
        });
      } catch { /* ignore */ }
    }
  }, [value, height, width, fontSize]);
  return <svg ref={ref} style={{ maxWidth: "100%" }} />;
}
