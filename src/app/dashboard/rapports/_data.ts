/* ────────────────────────────────────────────────────────────────────────────
 *  Rapports — SHARED MOCK DATA  (foundation for the 15-page Rapports section)
 *
 *  ⚠️  Everything here is HARDCODED & purely illustrative — an Algerian delivery
 *  network. No API calls. Pages import what they need from this single module so
 *  numbers stay consistent across the whole Rapports section.
 *
 *  Convention:
 *    • `Segment`  = { label, value, color }   → feeds Donut / HBars / SplitBar / Legend.
 *    • Money is a raw number of DA            → format with `formatDA` from ../_ui.
 *    • Plain counts                            → format with `fmt` (fr-DZ thousands).
 * ──────────────────────────────────────────────────────────────────────────── */

import type { ElementType } from "react";
import {
  Package, PackageCheck, Truck, RotateCcw, XCircle, Percent, Coins, Banknote,
  Wallet, Clock, Activity, TrendingUp,
} from "lucide-react";

/* ── Chart palette ────────────────────────────────────────────────────────── */
export const C = {
  blue: "#3b82f6", green: "#16a34a", amber: "#f59e0b", red: "#ef4444",
  violet: "#8b5cf6", cyan: "#06b6d4", pink: "#ec4899", teal: "#14b8a6",
  indigo: "#6366f1", orange: "#f97316", slate: "#64748b", lime: "#84cc16",
} as const;

/** Ordered palette for auto-coloured series (e.g. one colour per wilaya). */
export const PALETTE: string[] = [
  C.orange, C.blue, C.violet, C.green, C.amber, C.cyan,
  C.pink, C.indigo, C.teal, C.red, C.lime, C.slate,
];

/** Stable colour for index `i` (cycles through PALETTE). */
export function rainbow(i: number): string {
  return PALETTE[i % PALETTE.length];
}

/* ── Formatters ───────────────────────────────────────────────────────────── */
/** Thousands-separated integer in fr-DZ (no currency). Use `formatDA` for money. */
export const fmt = (n: number): string => Math.round(n).toLocaleString("fr-DZ");

/** Compact money-ish label: 4 820 000 → "4.8M", 612 000 → "612k". */
export const fmtCompact = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1_000) return Math.round(n / 1_000) + "k";
  return String(Math.round(n));
};

/* ── Time axis (shared 12-month axis) ─────────────────────────────────────── */
export const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
export const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/* ── Generic chart segment ────────────────────────────────────────────────── */
export type Segment = { label: string; value: number; color: string };

/* ══════════════════════════════════════════════════════════════════════════
 *  KPIs (global headline figures)
 * ════════════════════════════════════════════════════════════════════════ */
export interface Kpi {
  label: string;
  value: string;
  /** Variation vs previous period (signed). */
  delta: number;
  /** Whether an upward delta is "good" (green) or "bad" (red). */
  goodWhenUp: boolean;
  icon: ElementType;
  /** Optional unit appended to the trend chip ("%", " pts", " j"…). */
  deltaSuffix?: string;
}

export const GLOBAL_KPIS: Kpi[] = [
  { label: "Total colis",             value: fmt(18432),         delta: 12.4, goodWhenUp: true,  icon: Package,      deltaSuffix: "%" },
  { label: "Colis livrés",            value: fmt(15108),         delta: 9.8,  goodWhenUp: true,  icon: PackageCheck, deltaSuffix: "%" },
  { label: "Taux de livraison",       value: "82.0 %",           delta: 1.6,  goodWhenUp: true,  icon: Percent,      deltaSuffix: " pts" },
  { label: "En cours",                value: fmt(2140),          delta: -4.2, goodWhenUp: false, icon: Truck,        deltaSuffix: "%" },
  { label: "Retours",                 value: fmt(894),           delta: -2.1, goodWhenUp: false, icon: RotateCcw,    deltaSuffix: "%" },
  { label: "Échecs",                  value: fmt(290),           delta: 0.8,  goodWhenUp: false, icon: XCircle,      deltaSuffix: "%" },
  { label: "Chiffre d'affaires",      value: "4 820 000 DA",     delta: 14.2, goodWhenUp: true,  icon: TrendingUp,   deltaSuffix: "%" },
  { label: "COD collecté",            value: "38 540 000 DA",    delta: 11.5, goodWhenUp: true,  icon: Coins,        deltaSuffix: "%" },
  { label: "Frais encaissés",         value: "4 210 000 DA",     delta: 13.0, goodWhenUp: true,  icon: Banknote,     deltaSuffix: "%" },
  { label: "Prélèvement total",       value: "612 000 DA",       delta: 6.4,  goodWhenUp: true,  icon: Wallet,       deltaSuffix: "%" },
  { label: "Délai moyen de livraison", value: "2.4 j",           delta: -0.3, goodWhenUp: false, icon: Clock,        deltaSuffix: " j" },
  { label: "Colis / jour",            value: fmt(614),           delta: 8.1,  goodWhenUp: true,  icon: Activity,     deltaSuffix: "%" },
];

/* ══════════════════════════════════════════════════════════════════════════
 *  PACKAGE STATUSES — single source of truth (label + colour)
 * ════════════════════════════════════════════════════════════════════════ */
export interface PackageStatus { key: string; label: string; color: string; }

export const PACKAGE_STATUSES: PackageStatus[] = [
  { key: "pending",     label: "En attente",   color: C.slate },
  { key: "accepted",    label: "Accepté",      color: C.blue },
  { key: "bagged",      label: "En sac",       color: C.indigo },
  { key: "transit",     label: "En transit",   color: C.violet },
  { key: "delivering",  label: "En livraison", color: C.cyan },
  { key: "delivered",   label: "Livré",        color: C.green },
  { key: "returned",    label: "Retour",       color: C.amber },
  { key: "failed",      label: "Échec",        color: C.red },
];

/** Status distribution (counts). Ready to drop into a Donut/HBars. */
export const STATUS_DIST: Segment[] = [
  { label: "En attente",   value: 360,   color: C.slate },
  { label: "Accepté",      value: 280,   color: C.blue },
  { label: "En sac",       value: 470,   color: C.indigo },
  { label: "En transit",   value: 640,   color: C.violet },
  { label: "En livraison", value: 390,   color: C.cyan },
  { label: "Livré",        value: 15108, color: C.green },
  { label: "Retour",       value: 894,   color: C.amber },
  { label: "Échec",        value: 290,   color: C.red },
];

/** Service / package type breakdown. */
export const SERVICE_TYPES: Segment[] = [
  { label: "Livraison",    value: 13820, color: C.green },
  { label: "Recouvrement", value: 2180,  color: C.violet },
  { label: "Échange",      value: 1240,  color: C.blue },
  { label: "Ramassage",    value: 1192,  color: C.amber },
];

/** Home vs Stop-Desk delivery split. */
export const DELIVERY_MODES: Segment[] = [
  { label: "À domicile", value: 11540, color: C.orange },
  { label: "Stop Desk",  value: 6892,  color: C.indigo },
];

/* ══════════════════════════════════════════════════════════════════════════
 *  TIME-SERIES (12 points, aligned to MONTHS)
 * ════════════════════════════════════════════════════════════════════════ */
export const DELIVERIES_TREND = [920, 1040, 1180, 1260, 1340, 1420, 1510, 1180, 1390, 1560, 1720, 1588];
export const PACKAGES_TREND   = [1120, 1280, 1420, 1510, 1620, 1710, 1820, 1460, 1680, 1880, 2040, 1872];
export const REVENUE_TREND    = [286000, 312000, 348000, 372000, 398000, 421000, 446000, 352000, 412000, 458000, 502000, 478000];
export const COD_TREND        = [2_410_000, 2_680_000, 2_940_000, 3_120_000, 3_280_000, 3_410_000, 3_560_000, 2_980_000, 3_240_000, 3_620_000, 3_910_000, 3_780_000];
export const RETURNS_TREND    = [62, 71, 68, 74, 81, 78, 84, 96, 88, 79, 73, 70];
export const RECLAM_TREND     = [18, 22, 19, 24, 28, 26, 31, 38, 33, 27, 23, 21];

/* ══════════════════════════════════════════════════════════════════════════
 *  WILAYAS (geography)
 * ════════════════════════════════════════════════════════════════════════ */
export interface WilayaRow {
  code: number; name: string; colis: number; livres: number;
  retours: number; taux: number; ca: number; communes: number;
}

export const WILAYAS: WilayaRow[] = [
  { code: 16, name: "Alger",      colis: 5840, livres: 4920, retours: 286, taux: 84, ca: 1560000, communes: 57 },
  { code: 31, name: "Oran",       colis: 3210, livres: 2640, retours: 198, taux: 82, ca: 862000,  communes: 26 },
  { code: 25, name: "Constantine", colis: 2480, livres: 1980, retours: 162, taux: 80, ca: 668000,  communes: 12 },
  { code: 9,  name: "Blida",      colis: 1920, livres: 1640, retours: 96,  taux: 85, ca: 512000,  communes: 25 },
  { code: 19, name: "Sétif",      colis: 1540, livres: 1310, retours: 78,  taux: 85, ca: 408000,  communes: 60 },
  { code: 23, name: "Annaba",     colis: 1180, livres: 920,  retours: 104, taux: 78, ca: 312000,  communes: 12 },
  { code: 5,  name: "Batna",      colis: 980,  livres: 760,  retours: 92,  taux: 78, ca: 256000,  communes: 61 },
  { code: 15, name: "Tizi Ouzou", colis: 870,  livres: 730,  retours: 54,  taux: 84, ca: 232000,  communes: 67 },
  { code: 6,  name: "Béjaïa",     colis: 740,  livres: 600,  retours: 62,  taux: 81, ca: 196000,  communes: 52 },
  { code: 30, name: "Ouargla",    colis: 520,  livres: 410,  retours: 48,  taux: 79, ca: 138000,  communes: 21 },
  { code: 13, name: "Tlemcen",    colis: 460,  livres: 372,  retours: 38,  taux: 81, ca: 121000,  communes: 53 },
  { code: 17, name: "Djelfa",     colis: 410,  livres: 318,  retours: 41,  taux: 78, ca: 104000,  communes: 36 },
  { code: 21, name: "Skikda",     colis: 380,  livres: 304,  retours: 32,  taux: 80, ca: 98000,   communes: 38 },
  { code: 7,  name: "Biskra",     colis: 340,  livres: 268,  retours: 34,  taux: 79, ca: 86000,   communes: 33 },
];

/* ══════════════════════════════════════════════════════════════════════════
 *  STOP DESKS (hub + sub-SD network)
 * ════════════════════════════════════════════════════════════════════════ */
export interface StopDeskRow {
  name: string; wilaya: string; colis: number; taux: number; delai: number;
  ca: number; prel: number; solde: number; staff: number;
}

export const STOP_DESKS: StopDeskRow[] = [
  { name: "Hub Alger",       wilaya: "Alger",      colis: 5420, taux: 86, delai: 2.1, ca: 1420000, prel: 184000, solde: 1240000, staff: 14 },
  { name: "SD Oran Centre",  wilaya: "Oran",       colis: 3140, taux: 81, delai: 2.6, ca: 840000,  prel: 102000, solde: 680000,  staff: 9 },
  { name: "SD Constantine",  wilaya: "Constantine", colis: 2460, taux: 79, delai: 2.8, ca: 690000,  prel: 86000,  solde: -210000, staff: 7 },
  { name: "SD Bab El Oued",  wilaya: "Alger",      colis: 2180, taux: 83, delai: 2.3, ca: 612000,  prel: 78000,  solde: 142000,  staff: 6 },
  { name: "SD Blida",        wilaya: "Blida",      colis: 1840, taux: 85, delai: 2.2, ca: 498000,  prel: 64000,  solde: 320000,  staff: 6 },
  { name: "SD El Hadjeb",    wilaya: "Biskra",     colis: 1520, taux: 84, delai: 2.4, ca: 410000,  prel: 52000,  solde: 148000,  staff: 5 },
  { name: "SD Annaba",       wilaya: "Annaba",     colis: 1180, taux: 78, delai: 3.0, ca: 320000,  prel: 41000,  solde: -86000,  staff: 5 },
  { name: "SD Sétif",        wilaya: "Sétif",      colis: 980,  taux: 85, delai: 2.3, ca: 268000,  prel: 34000,  solde: 96000,   staff: 4 },
  { name: "SD Béjaïa",       wilaya: "Béjaïa",     colis: 692,  taux: 80, delai: 2.9, ca: 188000,  prel: 24000,  solde: 42000,   staff: 4 },
  { name: "SD Batna",        wilaya: "Batna",      colis: 540,  taux: 77, delai: 3.1, ca: 146000,  prel: 19000,  solde: -32000,  staff: 3 },
];

/** Stop-desk soldes (signed) — quick feed for caisse / owing views. */
export const SD_SOLDES = STOP_DESKS.map((s) => ({ sd: s.name, solde: s.solde }));

/* ══════════════════════════════════════════════════════════════════════════
 *  DRIVERS / CHAUFFEURS
 * ════════════════════════════════════════════════════════════════════════ */
export interface DriverRow {
  name: string; sd: string; liv: number; taux: number;
  cod: number; comm: number; retards: number;
}

export const DRIVERS: DriverRow[] = [
  { name: "Karim Benali",    sd: "Hub Alger",      liv: 1240, taux: 91, cod: 3820000, comm: 124000, retards: 18 },
  { name: "Riad Boudjema",   sd: "Hub Alger",      liv: 1150, taux: 90, cod: 3410000, comm: 115000, retards: 20 },
  { name: "Sofiane Meziane", sd: "SD Oran Centre", liv: 1080, taux: 88, cod: 3140000, comm: 108000, retards: 24 },
  { name: "Nabil Saïdi",     sd: "SD Blida",       liv: 1020, taux: 89, cod: 2980000, comm: 102000, retards: 22 },
  { name: "Yacine Haddad",   sd: "SD Constantine", liv: 980,  taux: 86, cod: 2760000, comm: 96000,  retards: 31 },
  { name: "Mohamed Chérif",  sd: "SD Annaba",      liv: 870,  taux: 84, cod: 2380000, comm: 84000,  retards: 38 },
  { name: "Amine Khelifi",   sd: "SD Bab El Oued", liv: 760,  taux: 83, cod: 2010000, comm: 72000,  retards: 42 },
  { name: "Walid Brahimi",   sd: "SD Sétif",       liv: 690,  taux: 87, cod: 1840000, comm: 64000,  retards: 19 },
];

/* ══════════════════════════════════════════════════════════════════════════
 *  MERCHANTS / EXPÉDITEURS
 * ════════════════════════════════════════════════════════════════════════ */
export interface MerchantRow {
  name: string; category: string; colis: number; ca: number;
  retour: number; solde: number;
}

export const MERCHANTS: MerchantRow[] = [
  { name: "Boutique Electronique", category: "Électronique", colis: 3420, ca: 1240000, retour: 6.2, solde: 482000 },
  { name: "Mode Dz",               category: "Mode",         colis: 2980, ca: 1020000, retour: 9.4, solde: 318000 },
  { name: "Cosmétique Plus",       category: "Beauté",       colis: 2140, ca: 760000,  retour: 4.8, solde: 212000 },
  { name: "Tech Store DZ",         category: "Électronique", colis: 1860, ca: 690000,  retour: 7.1, solde: 176000 },
  { name: "Maison & Déco",         category: "Maison",       colis: 1420, ca: 510000,  retour: 5.6, solde: 98000 },
  { name: "Sport Zone",            category: "Sport",        colis: 1180, ca: 420000,  retour: 8.3, solde: 64000 },
  { name: "Bébé Confort",          category: "Puériculture", colis: 980,  ca: 340000,  retour: 3.9, solde: 52000 },
  { name: "Parfum Élégance",       category: "Beauté",       colis: 820,  ca: 296000,  retour: 5.1, solde: 38000 },
];

/* ══════════════════════════════════════════════════════════════════════════
 *  FINANCE — prélèvements, caisses, COD
 * ════════════════════════════════════════════════════════════════════════ */
export const PREL_SPLIT: Segment[] = [
  { label: "Prélèvement expéditeur",   value: 372000, color: C.violet },
  { label: "Prélèvement destinataire", value: 240000, color: C.pink },
];

export const FINANCE_SUMMARY = {
  ca: 4820000,
  codCollected: 38540000,
  codRemitted: 31820000,
  codPending: 6720000,
  feesCollected: 4210000,
  prelevementTotal: 612000,
  marginNet: 3680000,
};

export const CAISSE_SUMMARY = {
  global: 8640000,
  sdOweUs: 2388000,
  weOweSd: 296000,
};

/** COD recovery breakdown (collected vs remitted vs pending). */
export const COD_SPLIT: Segment[] = [
  { label: "Remis à l'expéditeur", value: 31820000, color: C.green },
  { label: "En attente de remise", value: 6720000,  color: C.amber },
];

/* ══════════════════════════════════════════════════════════════════════════
 *  RETURNS
 * ════════════════════════════════════════════════════════════════════════ */
export const RETURN_REASONS: Segment[] = [
  { label: "Client absent",       value: 312, color: C.amber },
  { label: "Client a refusé",     value: 198, color: C.red },
  { label: "Adresse incorrecte",  value: 156, color: C.blue },
  { label: "Annulé par client",   value: 128, color: C.violet },
  { label: "Colis endommagé",     value: 62,  color: C.pink },
  { label: "Hors zone",           value: 38,  color: C.slate },
];

/* ══════════════════════════════════════════════════════════════════════════
 *  NAVETTES (line-hauls between SDs)
 * ════════════════════════════════════════════════════════════════════════ */
export interface NavetteRow {
  route: string; depart: string; arrivee: string;
  ponctualite: number; retards: number; colis: number; sacs: number;
}

export const NAVETTES: NavetteRow[] = [
  { route: "Alger → Oran",        depart: "06:00", arrivee: "13:20", ponctualite: 92, retards: 4,  colis: 1240, sacs: 38 },
  { route: "Alger → Constantine", depart: "05:30", arrivee: "12:10", ponctualite: 88, retards: 6,  colis: 980,  sacs: 31 },
  { route: "Alger → Sétif",       depart: "06:15", arrivee: "10:40", ponctualite: 94, retards: 3,  colis: 760,  sacs: 24 },
  { route: "Oran → Tlemcen",      depart: "07:00", arrivee: "09:30", ponctualite: 90, retards: 5,  colis: 420,  sacs: 14 },
  { route: "Alger → Annaba",      depart: "05:00", arrivee: "13:50", ponctualite: 81, retards: 11, colis: 540,  sacs: 18 },
  { route: "Alger → Blida",       depart: "08:00", arrivee: "08:55", ponctualite: 97, retards: 1,  colis: 1120, sacs: 34 },
  { route: "Constantine → Batna", depart: "07:30", arrivee: "09:10", ponctualite: 86, retards: 7,  colis: 380,  sacs: 12 },
];

/* ══════════════════════════════════════════════════════════════════════════
 *  RÉCLAMATIONS
 * ════════════════════════════════════════════════════════════════════════ */
export const RECLAM_STATUS: Segment[] = [
  { label: "Résolue",  value: 184, color: C.green },
  { label: "Ouverte",  value: 42,  color: C.amber },
  { label: "En cours", value: 28,  color: C.blue },
  { label: "Rejetée",  value: 16,  color: C.red },
];

export const RECLAM_TYPES: Segment[] = [
  { label: "Retard de livraison", value: 88, color: C.amber },
  { label: "Colis endommagé",     value: 64, color: C.red },
  { label: "Erreur d'adresse",    value: 54, color: C.blue },
  { label: "Litige COD",          value: 42, color: C.violet },
  { label: "Colis perdu",         value: 22, color: C.slate },
];

export const SLA_SUMMARY = {
  avgResolution: "1.8 j",
  resolvedInTime: "91.4 %",
  open: 70,
  satisfaction: "94.2 %",
};

/* ══════════════════════════════════════════════════════════════════════════
 *  ACTIVITY / AUDIT LOG
 * ════════════════════════════════════════════════════════════════════════ */
export interface ActivityRow {
  user: string; role: string; action: string; target: string;
  time: string; type: "create" | "update" | "delete" | "login" | "scan" | "finance";
}

export const ACTIVITY_LOG: ActivityRow[] = [
  { user: "Karim Benali",    role: "chauffeur", action: "Colis livré",            target: "DHD-204815", time: "il y a 4 min",  type: "update" },
  { user: "Amine Khelifi",   role: "operator",  action: "Sac scanné (réception)", target: "SAC-00231",  time: "il y a 12 min", type: "scan" },
  { user: "Sara Bensalem",   role: "admin",     action: "Caisse clôturée",        target: "Hub Alger",  time: "il y a 26 min", type: "finance" },
  { user: "Mode Dz",         role: "expediteur", action: "Colis créé",            target: "DHD-204902", time: "il y a 38 min", type: "create" },
  { user: "Riad Boudjema",   role: "chauffeur", action: "Ramassage confirmé",     target: "12 colis",   time: "il y a 51 min", type: "update" },
  { user: "Yacine Haddad",   role: "operator",  action: "Connexion",              target: "SD Constantine", time: "il y a 1 h", type: "login" },
  { user: "Sara Bensalem",   role: "admin",     action: "Réclamation résolue",    target: "RC-1187",    time: "il y a 1 h",   type: "update" },
  { user: "Cosmétique Plus", role: "expediteur", action: "Retour récupéré",       target: "DHD-203440", time: "il y a 2 h",   type: "update" },
  { user: "Nabil Saïdi",     role: "chauffeur", action: "COD collecté",           target: "84 200 DA",  time: "il y a 2 h",   type: "finance" },
  { user: "Walid Brahimi",   role: "operator",  action: "Colis supprimé",         target: "DHD-202118", time: "il y a 3 h",   type: "delete" },
];

/** Actions per user (small bar feed for the audit page). */
export const ACTIONS_PER_USER: Segment[] = [
  { label: "Sara Bensalem",  value: 412, color: C.blue },
  { label: "Amine Khelifi",  value: 318, color: C.indigo },
  { label: "Karim Benali",   value: 286, color: C.green },
  { label: "Yacine Haddad",  value: 214, color: C.violet },
  { label: "Walid Brahimi",  value: 168, color: C.amber },
];

/* ══════════════════════════════════════════════════════════════════════════
 *  FILTER OPTIONS (for visual-only filter bars)
 * ════════════════════════════════════════════════════════════════════════ */
export const PERIOD_OPTIONS: [string, string][] = [
  ["aujourdhui", "Aujourd'hui"], ["7j", "7 jours"], ["30j", "30 jours"],
  ["mois", "Ce mois"], ["annee", "Cette année"],
];
export const SD_FILTER_OPTIONS = ["Tous les Stop Desks", ...STOP_DESKS.map((s) => s.name)];
export const WILAYA_FILTER_OPTIONS = ["Toutes les wilayas", ...WILAYAS.map((w) => w.name)];
export const SERVICE_FILTER_OPTIONS = ["Tous les services", "Livraison", "Échange", "Recouvrement", "Ramassage"];
