"use client";

/* ════════════════════════════════════════════════════════════════════════════
 *  Rapports — SHARED CHART & LAYOUT LIBRARY
 *
 *  Reusable, typed, dark/light-aware building blocks for the 15-page Rapports
 *  section. EVERYTHING is drawn with inline SVG / CSS — NO chart npm package.
 *
 *  ── How to use ──────────────────────────────────────────────────────────────
 *    import { useIsDark, useTokens } from "../_ui";
 *    import {
 *      PageShell, ReportHeader, DemoNotice, SectionTitle, ChartCard,
 *      KpiCard, Donut, HBars, VBars, AreaLine, Gauge, SplitBar, DataTable,
 *    } from "../_charts";
 *
 *    const isDark = useIsDark();
 *    const t = useTokens(isDark);
 *    return (
 *      <PageShell t={t}>
 *        <ReportHeader t={t} icon={Truck} title="…" subtitle="…" />
 *        <DemoNotice t={t} />
 *        <ChartCard t={t} title="…"><Donut t={t} data={…} legend /></ChartCard>
 *      </PageShell>
 *    );
 *
 *  Almost every component takes `t: Tokens` (from `useTokens(isDark)`).
 *  Chart series use the shared `Segment = { label, value, color }` shape — pull
 *  ready-made series from `./_data`.
 * ════════════════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { TrendingUp, TrendingDown, Info, X, Download } from "lucide-react";
import { useIsDark, ORANGE, formatDA, type Tokens } from "../_ui";
import { C, fmt, type Segment } from "./_data";

/* Re-export the palette + formatters so pages can `import { C, fmt } from "../_charts"`. */
export { C, fmt, rainbow, type Segment } from "./_data";
/* Re-export _ui helpers a report page commonly needs alongside the charts. */
export { ORANGE, formatDA, type Tokens, Badge } from "../_ui";

/* ════════════════════════════════════════════════════════════════════════════
 *  LAYOUT
 * ════════════════════════════════════════════════════════════════════════════ */

export interface PageShellProps {
  t: Tokens;
  children: React.ReactNode;
  /** Max content width (px). Omit for full-width. */
  maxWidth?: number;
}
/** Full-page wrapper: background, padding, font. Wrap every report page in this.
 *  maxWidth is kept in the props for back-compat but intentionally IGNORED so
 *  every report page renders with the SAME full-width 24px 28px margins as the
 *  rest of the dashboard (consistent margins across all pages). */
export function PageShell({ t, children }: PageShellProps) {
  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "var(--font-jakarta, var(--font-geist-sans, sans-serif))" }}>
      <div style={{ padding: "24px 28px" }}>{children}</div>
    </div>
  );
}

export interface ReportHeaderProps {
  t: Tokens;
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  /** Right-aligned node (e.g. export buttons). */
  action?: React.ReactNode;
}
/** Page header: orange icon tile + title + subtitle, optional right-side action. */
export function ReportHeader({ t, title, subtitle, icon: Icon, action }: ReportHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
      {Icon && (
        <div style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.22)", flexShrink: 0 }}>
          <Icon size={20} style={{ color: ORANGE }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 220 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text, letterSpacing: "-0.02em" }}>{title}</h1>
        {subtitle && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: t.textMuted }}>{subtitle}</p>}
      </div>
      {action && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{action}</div>}
    </div>
  );
}

export interface SectionTitleProps {
  t: Tokens;
  title: string;
  icon?: React.ElementType;
  sub?: string;
}
/** A divider-style section heading (icon + title + trailing rule). */
export function SectionTitle({ t, title, icon: Icon, sub }: SectionTitleProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 4 }}>
      {Icon && <Icon size={17} color={ORANGE} />}
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.text }}>{title}</h2>
      {sub && <span style={{ fontSize: 12, color: t.textFaint }}>— {sub}</span>}
      <div style={{ flex: 1, height: 1, background: t.divider, marginLeft: 6 }} />
    </div>
  );
}

export interface ChartCardProps {
  t: Tokens;
  title?: string;
  icon?: React.ElementType;
  /** Small muted text on the right of the header. */
  sub?: string;
  /** Right-aligned node in the header (overrides `sub` position). */
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Remove inner body padding (e.g. for a flush table). */
  noPadding?: boolean;
}
/** Bordered card with an optional titled header. Primary container for charts. */
export function ChartCard({ t, title, icon: Icon, sub, action, children, noPadding }: ChartCardProps) {
  return (
    <div style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.border}`, boxShadow: t.shadow, overflow: "hidden" }}>
      {(title || action) && (
        <div style={{ padding: "13px 18px", borderBottom: `1px solid ${t.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
          {Icon && <Icon size={14} color={t.textMuted} />}
          {title && <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{title}</span>}
          {(sub || action) && <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            {sub && <span style={{ fontSize: 11, color: t.textFaint }}>{sub}</span>}
            {action}
          </span>}
        </div>
      )}
      <div style={{ padding: noPadding ? 0 : 18 }}>{children}</div>
    </div>
  );
}

/** Alias of {@link ChartCard} — same props. Use whichever name reads better. */
export const SectionCard = ChartCard;

/* ════════════════════════════════════════════════════════════════════════════
 *  DEMO NOTICE
 * ════════════════════════════════════════════════════════════════════════════ */

export interface DemoNoticeProps {
  t: Tokens;
  /** Override the bold heading. */
  title?: string;
  /** Override the body text. */
  message?: React.ReactNode;
  /** Hide the close button (always-on banner). Default: dismissible. */
  persistent?: boolean;
}
/**
 * Dismissible orange "Aperçu / Démo" banner. Drop near the top of every report
 * page. Manages its own open/closed state.
 */
export function DemoNotice({ t, title = "Aperçu / Démo", message, persistent }: DemoNoticeProps) {
  const isDark = useIsDark();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 16px", borderRadius: 12, marginBottom: 18,
      background: isDark ? "rgba(249,115,22,0.08)" : "rgba(249,115,22,0.07)",
      border: "1px solid rgba(249,115,22,0.35)",
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "rgba(249,115,22,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Info size={16} color={ORANGE} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#fdba74" : "#c2410c", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: t.textSub, lineHeight: 1.5 }}>
          {message ?? (
            <>Rapports définis <strong>sur mesure selon le client</strong>. Les données affichées sont des <strong>exemples illustratifs</strong> et ne reflètent aucune activité réelle.</>
          )}
        </div>
      </div>
      {!persistent && (
        <button onClick={() => setOpen(false)} title="Masquer"
          style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, display: "flex", flexShrink: 0, padding: 2 }}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  KPI / TREND
 * ════════════════════════════════════════════════════════════════════════════ */

export interface TrendChipProps {
  /** Signed variation. Positive renders an up-arrow, negative a down-arrow. */
  delta: number;
  /** Whether up is "good" (green). Default true. */
  goodWhenUp?: boolean;
  /** Unit appended after the number (e.g. "%", " pts", " j"). Default "%". */
  suffix?: string;
}
/** Small up/down delta chip, coloured green/red by whether the move is good. */
export function TrendChip({ delta, goodWhenUp = true, suffix = "%" }: TrendChipProps) {
  const up = delta >= 0;
  const good = up === goodWhenUp;
  const color = good ? C.green : C.red;
  const Arrow = up ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 99, background: `${color}15`, color }}>
      <Arrow size={11} />
      <span style={{ fontSize: 10.5, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{up ? "+" : ""}{delta}{suffix}</span>
    </span>
  );
}

export interface KpiCardProps {
  t: Tokens;
  label: string;
  value: string;
  icon: React.ElementType;
  /** Optional trend. Omit `delta` to hide the chip entirely. */
  delta?: number;
  goodWhenUp?: boolean;
  /** Unit for the trend chip (default "%"). */
  deltaSuffix?: string;
}
/** Metric tile: orange icon, label, big value, optional {@link TrendChip}. */
export function KpiCard({ t, label, value, icon: Icon, delta, goodWhenUp = true, deltaSuffix = "%" }: KpiCardProps) {
  return (
    <div style={{ background: t.card, borderRadius: 13, border: `1px solid ${t.border}`, boxShadow: t.shadow, padding: "14px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(249,115,22,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={14} color={ORANGE} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, lineHeight: 1.25 }}>{label}</span>
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, color: t.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {delta !== undefined && (
        <div style={{ marginTop: 7 }}>
          <TrendChip delta={delta} goodWhenUp={goodWhenUp} suffix={deltaSuffix} />
        </div>
      )}
    </div>
  );
}

export interface StatTileProps {
  t: Tokens;
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  /** Accent colour for the icon. Default ORANGE; pass green to flag "good". */
  accent?: string;
}
/** Compact stat card with icon tile + value + hint (good for SLA-style metrics). */
export function StatTile({ t, icon: Icon, label, value, hint, accent = ORANGE }: StatTileProps) {
  return (
    <div style={{ background: t.card, borderRadius: 13, border: `1px solid ${t.border}`, boxShadow: t.shadow, padding: "16px 17px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={15} color={accent} />
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: t.textMuted, lineHeight: 1.25 }}>{label}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: t.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: t.textFaint, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

/** Tiny centred label/value pair (used under gauges, in headers). */
export function MiniStat({ t, label, value, color }: { t: Tokens; label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: color ?? t.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  DONUT + LEGEND
 * ════════════════════════════════════════════════════════════════════════════ */

export interface DonutProps {
  t: Tokens;
  data: Segment[];
  /** Outer diameter in px. Default 172. */
  size?: number;
  /** Ring thickness in px. Default 26. */
  thickness?: number;
  /** Big centre value. Defaults to the formatted total of `data`. */
  centerValue?: string;
  /** Small centre caption below the value. */
  centerLabel?: string;
  /** Render a {@link Legend} beside the ring. Default false. */
  legend?: boolean;
  /** Format legend values as money (DA) instead of plain counts. */
  legendMoney?: boolean;
}
/** SVG donut (stroke-dasharray segments) with optional centre label + legend. */
export function Donut({ t, data, size = 172, thickness = 26, centerValue, centerLabel, legend, legendMoney }: DonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const ring = (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.divider} strokeWidth={thickness} />
          {data.map((d, i) => {
            const dash = (d.value / total) * circ;
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={d.color} strokeWidth={thickness}
                strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset} />
            );
            offset += dash;
            return el;
          })}
        </g>
      </svg>
      {(centerValue || centerLabel) && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: size > 160 ? 20 : 16, fontWeight: 800, color: t.text, fontVariantNumeric: "tabular-nums" }}>
            {centerValue ?? fmt(total)}
          </span>
          {centerLabel && <span style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600 }}>{centerLabel}</span>}
        </div>
      )}
    </div>
  );
  if (!legend) return ring;
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      {ring}
      <Legend t={t} data={data} money={legendMoney} />
    </div>
  );
}

export interface LegendProps {
  t: Tokens;
  data: Segment[];
  /** Format values as money (DA). Default false (plain counts). */
  money?: boolean;
}
/** Colour-keyed legend with value + share %. Pairs with {@link Donut}. */
export function Legend({ t, data, money }: LegendProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div style={{ flex: 1, minWidth: 150, display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: t.textSub, flex: 1 }}>{d.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums" }}>
            {money ? formatDA(d.value) : fmt(d.value)}
          </span>
          <span style={{ fontSize: 10.5, color: t.textFaint, width: 42, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {((d.value / total) * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  BARS
 * ════════════════════════════════════════════════════════════════════════════ */

export interface HBarsProps {
  t: Tokens;
  data: Segment[];
  /** Unit suffix on the value label (e.g. " colis"). Default "". */
  unit?: string;
  /** Format values as money (DA). Overrides `unit`. */
  money?: boolean;
}
/** Horizontal labelled progress bars (ranking lists). */
export function HBars({ t, data, unit = "", money }: HBarsProps) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {data.map((d) => (
        <div key={d.label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: t.textSub, fontWeight: 600 }}>{d.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontVariantNumeric: "tabular-nums" }}>
              {money ? formatDA(d.value) : `${fmt(d.value)}${unit}`}
            </span>
          </div>
          <div style={{ height: 9, borderRadius: 99, background: t.divider, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(d.value / max) * 100}%`, borderRadius: 99, background: d.color, transition: "width 0.4s" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface VBarsProps {
  t: Tokens;
  /** Bar values. */
  data: number[];
  /** X-axis labels (same length as `data`). */
  labels: string[];
  /** Bar colour. Default ORANGE. */
  color?: string;
  /** Total chart height in px. Default 200. */
  height?: number;
  /** Format the small value above each bar. Default: compact "k" thousands. */
  format?: (v: number) => string;
}
/** Vertical CSS bar chart with value caps + x labels. */
export function VBars({ t, data, labels, color = ORANGE, height = 200, format }: VBarsProps) {
  const max = Math.max(...data) || 1;
  const cap = format ?? ((v: number) => `${Math.round(v / 1000)}k`);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height }}>
        {data.map((v, i) => (
          <div key={i} title={`${labels[i]}: ${fmt(v)}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            <span style={{ fontSize: 9.5, color: t.textMuted, fontWeight: 700, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{cap(v)}</span>
            <div style={{ width: "100%", maxWidth: 38, height: `${(v / max) * 100}%`, borderRadius: "6px 6px 0 0", background: `linear-gradient(180deg, ${color} 0%, ${color}aa 100%)`, transition: "height 0.4s" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {labels.map((l, i) => <span key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: t.textMuted, fontWeight: 600 }}>{l}</span>)}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  AREA / LINE
 * ════════════════════════════════════════════════════════════════════════════ */

export interface AreaLineProps {
  t: Tokens;
  /** Series values (typically 12 points). */
  data: number[];
  /** X-axis labels (same length as `data`). */
  labels: string[];
  /** Line + gradient colour. Default ORANGE. */
  color?: string;
  /** Suffix appended in the point tooltip (e.g. " colis"). */
  suffix?: string;
  /** Chart height in px. Default 240. */
  height?: number;
}
/** Responsive SVG area+line chart with gridlines and HTML value dots. */
export function AreaLine({ t, data, labels, color = ORANGE, suffix = "", height = 240 }: AreaLineProps) {
  const W = 1000, H = height;
  const max = Math.max(...data) * 1.12 || 1;
  const stepX = W / (data.length - 1 || 1);
  const pts = data.map((v, i) => [i * stepX, H - (v / max) * H] as const);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `0,${H} ${line} ${W},${H}`;
  const gid = `areaGrad-${color.replace("#", "")}`;
  return (
    <div>
      <div style={{ position: "relative", height: H, width: "100%" }}>
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1="0" y1={H * g} x2={W} y2={H * g} stroke={t.divider} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <polygon points={area} fill={`url(#${gid})`} />
          <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {data.map((v, i) => (
          <div key={i} title={`${labels[i]}: ${fmt(v)}${suffix}`}
            style={{ position: "absolute", left: `${(i / (data.length - 1 || 1)) * 100}%`, top: `${(1 - v / max) * 100}%`, width: 8, height: 8, borderRadius: 99, background: t.card, border: `2px solid ${color}`, transform: "translate(-50%, -50%)" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
        {labels.map((l, i) => <span key={i} style={{ fontSize: 10.5, color: t.textMuted, fontWeight: 600 }}>{l}</span>)}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  GAUGE (semicircle)
 * ════════════════════════════════════════════════════════════════════════════ */

export interface GaugeProps {
  t: Tokens;
  value: number;
  total: number;
  /** Arc colour. Default green. */
  color?: string;
  /** Caption under the big percentage. */
  label?: string;
  /** Override the big centre text (defaults to the computed percentage). */
  display?: string;
}
/** Semicircle progress gauge (value / total) with centred percentage + caption. */
export function Gauge({ t, value, total, color = C.green, label = "Atteint", display }: GaugeProps) {
  const frac = Math.min(value / (total || 1), 1);
  const r = 84, cx = 100, cy = 100, pad = 16;
  const len = Math.PI * r;
  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div style={{ position: "relative", width: 200, height: cy + pad }}>
      <svg width="100%" height={cy + pad} viewBox={`0 0 ${cx * 2} ${cy + pad}`}>
        <path d={path} fill="none" stroke={t.divider} strokeWidth={18} strokeLinecap="round" />
        <path d={path} fill="none" stroke={color} strokeWidth={18} strokeLinecap="round" strokeDasharray={`${frac * len} ${len}`} />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 46, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{display ?? `${(frac * 100).toFixed(1)}%`}</div>
        <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  SPLIT BAR (stacked proportions)
 * ════════════════════════════════════════════════════════════════════════════ */

export interface SplitBarProps {
  t: Tokens;
  data: Segment[];
  /** Bar height in px. Default 28. */
  height?: number;
  /** Show the colour-keyed legend below the bar. Default true. */
  legend?: boolean;
}
/** Single horizontal stacked bar showing share %, with optional legend below. */
export function SplitBar({ t, data, height = 28, legend = true }: SplitBarProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", height, borderRadius: 8, overflow: "hidden", border: `1px solid ${t.border}` }}>
        {data.map((d) => (
          <div key={d.label} title={`${d.label}: ${fmt(d.value)}`}
            style={{ width: `${(d.value / total) * 100}%`, background: d.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff" }}>{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      {legend && (
        <div style={{ display: "flex", gap: 16, marginTop: 9, flexWrap: "wrap" }}>
          {data.map((d) => (
            <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color }} />
              <span style={{ fontSize: 11.5, color: t.textSub }}>{d.label}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: t.text }}>{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  TABLE + CELL RENDERERS
 * ════════════════════════════════════════════════════════════════════════════ */

export interface Column<Row> {
  /** Header label. */
  header: string;
  /** Cell content for a row. Return a string/number or any node. */
  render: (row: Row, index: number) => React.ReactNode;
  /** Text alignment. Default "left". */
  align?: "left" | "right" | "center";
  /** Optional fixed width (px or CSS string). */
  width?: number | string;
}

export interface DataTableProps<Row> {
  t: Tokens;
  columns: Column<Row>[];
  rows: Row[];
  /** Stable key per row. Default: array index. */
  rowKey?: (row: Row, index: number) => string | number;
  /** Message when `rows` is empty. */
  empty?: string;
}
/**
 * Generic, typed table. Define `columns` with a `render(row)` callback and pass
 * an array of `rows`. Use {@link ProgressCell}, {@link Pill} or {@link Badge}
 * inside a column's `render` for rich cells.
 *
 * @example
 *   <DataTable
 *     t={t}
 *     rows={STOP_DESKS}
 *     columns={[
 *       { header: "Stop Desk", render: (s) => <strong>{s.name}</strong> },
 *       { header: "Taux", align: "left", render: (s) => <ProgressCell t={t} value={s.taux} /> },
 *       { header: "CA", align: "right", render: (s) => formatDA(s.ca) },
 *     ]}
 *   />
 */
export function DataTable<Row>({ t, columns, rows, rowKey, empty = "Aucune donnée" }: DataTableProps<Row>) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: t.rowHover }}>
            {columns.map((c, i) => (
              <th key={i} style={{ padding: "9px 12px", textAlign: c.align ?? "left", width: c.width, fontSize: 10, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: "18px 12px", textAlign: "center", color: t.textFaint }}>{empty}</td></tr>
          ) : rows.map((row, ri) => (
            <tr key={rowKey ? rowKey(row, ri) : ri} style={{ borderTop: `1px solid ${t.divider}` }}>
              {columns.map((c, ci) => (
                <td key={ci} style={{ padding: "9px 12px", textAlign: c.align ?? "left", color: t.textSub, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{c.render(row, ri)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ProgressCellProps {
  t: Tokens;
  value: number;
  /** Scale max. Default 100. */
  max?: number;
  /**
   * Invert the colour meaning: high value = bad (red). Use for return / failure
   * rates. Default false (high value = good / green).
   */
  invert?: boolean;
  /** Suffix on the numeric label. Default "%". */
  suffix?: string;
}
/** In-cell progress bar + value, auto-coloured by thresholds. */
export function ProgressCell({ t, value, max = 100, invert, suffix = "%" }: ProgressCellProps) {
  const pct = Math.min((value / max) * 100, 100);
  const color = invert
    ? (value >= 8 ? C.red : value >= 5 ? C.amber : C.green)
    : (pct >= 85 ? C.green : pct >= 78 ? C.amber : C.red);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 99, background: t.divider, overflow: "hidden", minWidth: 56 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color, width: 40, textAlign: "right" }}>{value}{suffix}</span>
    </div>
  );
}

/** Rounded count/label pill in a single accent colour (tinted background). */
export function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{ display: "inline-block", minWidth: 24, padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 800, color, background: `${color}18`, textAlign: "center" }}>{children}</span>
  );
}

/** Signed money cell: green for ≥0, red for <0, with +/− and DA formatting. */
export function MoneyDelta({ value }: { value: number }) {
  const color = value >= 0 ? C.green : C.red;
  return (
    <span style={{ fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
      {value >= 0 ? "+" : "−"}{formatDA(Math.abs(value))}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 *  FILTER-BAR CONTROLS (visual only)
 * ════════════════════════════════════════════════════════════════════════════ */

export interface SegmentedProps {
  t: Tokens;
  value: string;
  onChange: (v: string) => void;
  /** [key, label] pairs. */
  options: [string, string][];
}
/** Pill segmented control (e.g. period switch). */
export function Segmented({ t, value, onChange, options }: SegmentedProps) {
  return (
    <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 10, background: t.bg, border: `1px solid ${t.border}` }}>
      {options.map(([key, label]) => {
        const active = value === key;
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            padding: "6px 12px", border: "none", borderRadius: 7, cursor: "pointer",
            fontSize: 12, fontWeight: 700, transition: "all 0.12s",
            background: active ? ORANGE : "transparent", color: active ? "#fff" : t.textMuted,
          }}>{label}</button>
        );
      })}
    </div>
  );
}

/** Styled native <select> with a leading icon (visual filter). */
export function SelectField({ t, icon: Icon, options }: { t: Tokens; icon: React.ElementType; options: string[] }) {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <Icon size={13} color={t.textMuted} style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
      <select style={{ appearance: "none", padding: "8px 28px 8px 30px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, cursor: "pointer" }}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

/** Outlined export button (PDF/Excel). Visual only — no real export. */
export function ExportButton({ t, icon: Icon, label, color }: { t: Tokens; icon: React.ElementType; label: string; color: string }) {
  const [hov, setHov] = useState(false);
  return (
    <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9,
        border: `1px solid ${hov ? color : t.border}`, background: hov ? `${color}12` : t.card,
        color: hov ? color : t.textSub, fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all 0.12s",
      }}>
      <Icon size={14} color={color} /> {label} <Download size={12} style={{ opacity: 0.6 }} />
    </button>
  );
}
