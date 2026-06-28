"use client";

import { useState, useEffect, useCallback } from "react";
import {
  KeyRound, Loader2, Save, Check, AlertCircle, ShieldCheck,
  MapPin, Sparkles, Bot, Eye, EyeOff, Lock, CloudSun,
  Mail, MessageSquare, Server, Hash, AtSign, Send,
  Plug, CheckCircle2, Circle,
} from "lucide-react";
import {
  getSystemConfigs, setSystemConfig,
  SYSTEM_CONFIG_KEYS, type SystemConfig,
} from "@/lib/system-configs";

/* ── dark-mode hook ──────────────────────────────────────── */
function useIsDark() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

/* ── design tokens ───────────────────────────────────────── */
function useTokens(isDark: boolean) {
  return isDark ? {
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130", rowHover: "#1a1f2e",
    text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280", textFaint: "#4b5563",
    shadow: "none", inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" }, sectionBg: "#0f1623",
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" }, sectionBg: "#f9fafb",
  };
}
type T = ReturnType<typeof useTokens>;

/* ── helpers ─────────────────────────────────────────────── */
/** Mask a stored secret, revealing only the last 4 characters. */
function maskValue(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "Non configurée";
  if (v.length <= 4) return "••••" + v;
  return "••••••••" + v.slice(-4);
}

interface KeyDef {
  key: string;
  title: string;
  Icon: typeof KeyRound;
  color: string;
  description: string;
  placeholder: string;
}

/* ── single key editor card (masked secret) ──────────────── */
function KeyCard({ t, def, current, onSaved }: {
  t: T; def: KeyDef; current: SystemConfig | undefined; onSaved: (cfg: SystemConfig) => void;
}) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const stored = current?.value ?? null;
  const isSet = !!(stored ?? "").trim();

  async function save() {
    const trimmed = value.trim();
    // Only PUT when the user actually entered a new value — never overwrite with the mask.
    if (!trimmed) {
      setFeedback({ kind: "err", msg: "Saisissez une nouvelle clé avant d'enregistrer." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    const res = await setSystemConfig(def.key, trimmed, "string");
    setSaving(false);
    if (res.success && res.data) {
      onSaved(res.data);
      setValue("");
      setReveal(false);
      setFeedback({ kind: "ok", msg: "Clé enregistrée." });
      setTimeout(() => setFeedback(null), 3500);
    } else {
      setFeedback({ kind: "err", msg: res.message || "Échec de l'enregistrement." });
    }
  }

  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
      padding: "18px 20px", boxShadow: t.shadow,
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${def.color}14`, border: `1px solid ${def.color}33`,
        }}>
          <def.Icon size={18} style={{ color: def.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 7 }}>
            {def.title}
            {isSet
              ? <CheckCircle2 size={14} style={{ color: "#16a34a", flexShrink: 0 }} />
              : <Circle size={13} style={{ color: t.textFaint, flexShrink: 0 }} />}
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 11.5, color: t.textMuted, lineHeight: 1.4 }}>{def.description}</p>
        </div>
      </div>

      {/* current (masked) value */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
        padding: "8px 12px", borderRadius: 9, background: t.sectionBg, border: `1px solid ${t.divider}`,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Actuelle
        </span>
        <code style={{
          flex: 1, fontSize: 12.5, fontWeight: 600, fontFamily: "monospace",
          color: stored ? t.textSub : t.textFaint, letterSpacing: stored ? "0.05em" : "normal",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {maskValue(stored)}
        </code>
      </div>

      {/* input + save */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type={reveal ? "text" : "password"}
            value={value}
            autoComplete="off"
            spellCheck={false}
            onChange={e => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={def.placeholder}
            style={{
              width: "100%", boxSizing: "border-box",
              background: t.inp.bg,
              border: `1.5px solid ${focused ? def.color : t.inp.border}`,
              borderRadius: 9, padding: "10px 38px 10px 13px", fontSize: 13,
              color: t.inp.text, outline: "none", minHeight: 42,
              fontFamily: "monospace",
              transition: "border-color 0.15s, box-shadow 0.15s",
              boxShadow: focused ? `0 0 0 3px ${def.color}1f` : "none",
            }}
          />
          <button type="button" onClick={() => setReveal(r => !r)}
            title={reveal ? "Masquer" : "Afficher"}
            style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", padding: 6,
              color: t.textFaint, display: "flex", alignItems: "center",
            }}
          >
            {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        <button onClick={save} disabled={saving || !value.trim()}
          style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            background: (saving || !value.trim()) ? t.textFaint : def.color,
            border: "none", borderRadius: 9, padding: "10px 18px",
            fontSize: 13, fontWeight: 600, color: "#fff", minHeight: 42,
            cursor: (saving || !value.trim()) ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={14} />}
          Enregistrer
        </button>
      </div>

      {/* feedback */}
      {feedback && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 10,
          fontSize: 12, fontWeight: 600,
          color: feedback.kind === "ok" ? "#16a34a" : "#ef4444",
        }}>
          {feedback.kind === "ok" ? <Check size={13} /> : <AlertCircle size={13} />}
          {feedback.msg}
        </div>
      )}
    </div>
  );
}

/* ── plain text field card (host, port, user, from, provider, sender…) ──────── */
function TextFieldCard({ t, def, current, onSaved }: {
  t: T; def: KeyDef; current: SystemConfig | undefined; onSaved: (cfg: SystemConfig) => void;
}) {
  const stored = current?.value ?? "";
  // Cards mount only after configs have loaded (parent gates on `loading`), so the
  // initial state already reflects the stored value; it changes only via this card's save.
  const [value, setValue] = useState(stored);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const dirty = value.trim() !== stored.trim();
  const isSet = !!stored.trim();

  async function save() {
    setSaving(true);
    setFeedback(null);
    const res = await setSystemConfig(def.key, value.trim(), "string");
    setSaving(false);
    if (res.success && res.data) {
      onSaved(res.data);
      setFeedback({ kind: "ok", msg: "Enregistré." });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ kind: "err", msg: res.message || "Échec de l'enregistrement." });
    }
  }

  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
      padding: "16px 18px", boxShadow: t.shadow,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${def.color}14`, border: `1px solid ${def.color}33`,
        }}>
          <def.Icon size={16} style={{ color: def.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", gap: 7 }}>
            {def.title}
            {isSet
              ? <CheckCircle2 size={13} style={{ color: "#16a34a", flexShrink: 0 }} />
              : <Circle size={12} style={{ color: t.textFaint, flexShrink: 0 }} />}
          </h3>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>{def.description}</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={def.placeholder}
          style={{
            flex: 1, minWidth: 0, boxSizing: "border-box",
            background: t.inp.bg,
            border: `1.5px solid ${focused ? def.color : t.inp.border}`,
            borderRadius: 9, padding: "10px 13px", fontSize: 13,
            color: t.inp.text, outline: "none", minHeight: 42,
            transition: "border-color 0.15s, box-shadow 0.15s",
            boxShadow: focused ? `0 0 0 3px ${def.color}1f` : "none",
          }}
        />
        <button onClick={save} disabled={saving || !dirty}
          style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            background: (saving || !dirty) ? t.textFaint : def.color,
            border: "none", borderRadius: 9, padding: "10px 16px",
            fontSize: 13, fontWeight: 600, color: "#fff", minHeight: 42,
            cursor: (saving || !dirty) ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {saving ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={14} />}
          Enregistrer
        </button>
      </div>

      {feedback && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 9,
          fontSize: 12, fontWeight: 600,
          color: feedback.kind === "ok" ? "#16a34a" : "#ef4444",
        }}>
          {feedback.kind === "ok" ? <Check size={13} /> : <AlertCircle size={13} />}
          {feedback.msg}
        </div>
      )}
    </div>
  );
}

/* ── boolean toggle card (smtp secure…) ─────────────────────── */
function ToggleFieldCard({ t, def, current, onSaved }: {
  t: T; def: KeyDef; current: SystemConfig | undefined; onSaved: (cfg: SystemConfig) => void;
}) {
  const on = (current?.value ?? "").toLowerCase() === "true";
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  async function toggle() {
    setSaving(true);
    setFeedback(null);
    const res = await setSystemConfig(def.key, on ? "false" : "true", "boolean");
    setSaving(false);
    if (res.success && res.data) {
      onSaved(res.data);
    } else {
      setFeedback({ kind: "err", msg: res.message || "Échec de l'enregistrement." });
    }
  }

  return (
    <div style={{
      background: t.card, border: `1px solid ${t.border}`, borderRadius: 14,
      padding: "16px 18px", boxShadow: t.shadow,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${def.color}14`, border: `1px solid ${def.color}33`,
      }}>
        <def.Icon size={16} style={{ color: def.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.text }}>{def.title}</h3>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>
          {feedback?.kind === "err" ? <span style={{ color: "#ef4444" }}>{feedback.msg}</span> : def.description}
        </p>
      </div>
      <button onClick={toggle} disabled={saving} title={on ? "Activé" : "Désactivé"}
        style={{
          position: "relative", width: 46, height: 26, borderRadius: 999, flexShrink: 0,
          border: "none", cursor: saving ? "wait" : "pointer",
          background: on ? def.color : t.textFaint, transition: "background 0.15s",
        }}
      >
        <span style={{
          position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%",
          background: "#fff", transition: "left 0.15s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {saving && <Loader2 size={11} style={{ animation: "spin 0.8s linear infinite", color: t.textMuted }} />}
        </span>
      </button>
    </div>
  );
}

/* ── light sub-group label inside a section ──────────────── */
function SecLabel({ t, color, children }: { t: T; color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0" }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{
        fontSize: 10.5, fontWeight: 700, color: t.textMuted,
        textTransform: "uppercase", letterSpacing: "0.07em",
      }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: t.divider }} />
    </div>
  );
}

/* ── status pill (per section: Configuré / Partiel / Non configuré) ── */
type Status = { state: "complete" | "partial" | "empty"; label: string };

function StatusPill({ t, status, color }: { t: T; status: Status; color: string }) {
  const map = {
    complete: { bg: `${color}18`, fg: color, dot: color, hollow: false },
    partial:  { bg: "rgba(245,158,11,0.12)", fg: "#b45309", dot: "#f59e0b", hollow: false },
    empty:    { bg: t.sectionBg, fg: t.textFaint, dot: t.textFaint, hollow: true },
  }[status.state];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: map.bg, color: map.fg,
    }}>
      {map.hollow
        ? <Circle size={9} style={{ color: map.dot }} />
        : <span style={{ width: 6, height: 6, borderRadius: "50%", background: map.dot }} />}
      {status.label}
    </span>
  );
}

/* ── section header + body (standard stacked section) ─────── */
function Section({ t, Icon, color, title, subtitle, status, children }: {
  t: T; Icon: typeof KeyRound; color: string; title: string; subtitle: string;
  status: Status; children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: `${color}14`, border: `1px solid ${color}33`,
        }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text, letterSpacing: "-0.01em" }}>{title}</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>{subtitle}</p>
        </div>
        <StatusPill t={t} status={status} color={color} />
      </div>
      {children}
    </section>
  );
}

/* ── definitions ─────────────────────────────────────────── */
const SERVICE_KEYS: KeyDef[] = [
  {
    key: SYSTEM_CONFIG_KEYS.googleMaps,
    title: "Google Maps",
    Icon: MapPin,
    color: "#10b981",
    description: "Routage des navettes, géocodage et affichage des cartes.",
    placeholder: "AIza… (clé API Google Maps)",
  },
  {
    key: SYSTEM_CONFIG_KEYS.weather,
    title: "Weather (OpenWeatherMap)",
    Icon: CloudSun,
    color: "#f59e0b",
    description: "Données météo (OpenWeatherMap) pour la planification des tournées.",
    placeholder: "Clé API OpenWeatherMap",
  },
];

const LLM_KEYS: KeyDef[] = [
  {
    key: SYSTEM_CONFIG_KEYS.openai,
    title: "OpenAI (GPT)",
    Icon: Sparkles,
    color: "#0ea5e9",
    description: "Modèles GPT pour les fonctionnalités d'IA côté serveur.",
    placeholder: "sk-… (clé API OpenAI)",
  },
  {
    key: SYSTEM_CONFIG_KEYS.claude,
    title: "Claude (Anthropic)",
    Icon: Bot,
    color: "#f97316",
    description: "Modèles Claude d'Anthropic pour les fonctionnalités d'IA côté serveur.",
    placeholder: "sk-ant-… (clé API Anthropic)",
  },
];

/* ── Email (SMTP) — text fields, one masked secret, one toggle ─────────────── */
const SMTP_EMAIL = "#3b82f6";
const SMTP_TEXT_FIELDS: KeyDef[] = [
  { key: "smtp_host", title: "Serveur SMTP (host)", Icon: Server, color: SMTP_EMAIL,
    description: "Adresse du serveur sortant.", placeholder: "smtp.gmail.com" },
  { key: "smtp_port", title: "Port", Icon: Hash, color: SMTP_EMAIL,
    description: "587 (STARTTLS) ou 465 (SSL).", placeholder: "587" },
  { key: "smtp_user", title: "Utilisateur", Icon: AtSign, color: SMTP_EMAIL,
    description: "Identifiant d'authentification SMTP.", placeholder: "no-reply@symloop.com" },
  { key: "smtp_from", title: "Expéditeur (from)", Icon: Mail, color: SMTP_EMAIL,
    description: "Adresse affichée comme expéditeur.", placeholder: "Symloop <no-reply@symloop.com>" },
];
const SMTP_PASS_FIELD: KeyDef = {
  key: "smtp_pass", title: "Mot de passe SMTP", Icon: Lock, color: SMTP_EMAIL,
  description: "Mot de passe / clé d'application — stocké côté serveur.", placeholder: "Mot de passe d'application",
};
const SMTP_SECURE_FIELD: KeyDef = {
  key: "smtp_secure", title: "Connexion sécurisée (SSL/TLS)", Icon: ShieldCheck, color: SMTP_EMAIL,
  description: "Activer pour le port 465 (SSL implicite).", placeholder: "",
};

/* ── SMS — provider + sender (text), api key (masked) ─────────────────────── */
const SMS_GREEN = "#10b981";
const SMS_TEXT_FIELDS: KeyDef[] = [
  { key: "sms_provider", title: "Fournisseur SMS", Icon: MessageSquare, color: SMS_GREEN,
    description: "Identifiant du fournisseur (ex. twilio, generic).", placeholder: "generic" },
  { key: "sms_sender", title: "Expéditeur (sender)", Icon: Send, color: SMS_GREEN,
    description: "Nom ou numéro affiché à la réception.", placeholder: "SYMLOOP" },
];
const SMS_KEY_FIELD: KeyDef = {
  key: "sms_api_key", title: "Clé API SMS", Icon: KeyRound, color: SMS_GREEN,
  description: "Clé du fournisseur SMS — rend le canal SMS opérationnel.", placeholder: "Clé API du fournisseur SMS",
};

/* responsive card grid — one column on narrow, multi-column when there's room */
const cardGrid: React.CSSProperties = {
  display: "grid", gap: 14,
  gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
};

export default function ApiKeysPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [configs, setConfigs] = useState<Record<string, SystemConfig>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getSystemConfigs();
    // The endpoint may 404 until the backend Settings module is deployed —
    // treat any missing/error response as "no configs set yet".
    if (res.success && Array.isArray(res.data)) {
      const map: Record<string, SystemConfig> = {};
      for (const c of res.data) map[c.key] = c;
      setConfigs(map);
    } else {
      setConfigs({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSaved = useCallback((cfg: SystemConfig) => {
    setConfigs(prev => ({ ...prev, [cfg.key]: cfg }));
  }, []);

  /* completeness — read the live (masked) configs map; any non-empty stored value = set */
  const isSet = useCallback((key: string) => !!(configs[key]?.value ?? "").trim(), [configs]);

  const groupStatus = useCallback((keys: string[]): Status => {
    const n = keys.filter(isSet).length;
    if (n === keys.length) return { state: "complete", label: "Configuré" };
    if (n > 0) return { state: "partial", label: `${n}/${keys.length}` };
    return { state: "empty", label: "Non configuré" };
  }, [isSet]);

  const emailStatus = useCallback((): Status => {
    const required = ["smtp_host", "smtp_user", "smtp_pass"];
    const n = required.filter(isSet).length;
    if (n === required.length) return { state: "complete", label: "Configuré" };
    if (n > 0) return { state: "partial", label: "Partiel" };
    return { state: "empty", label: "Non configuré" };
  }, [isSet]);

  const smsStatus = useCallback((): Status => (
    isSet("sms_api_key")
      ? { state: "complete", label: "Configuré" }
      : { state: "empty", label: "Non configuré" }
  ), [isSet]);

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg, fontFamily: "var(--font-jakarta, sans-serif)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", flexShrink: 0,
        }}>
          <Plug size={20} style={{ color: "#f97316" }} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Intégrations &amp; Paramètres</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
            Connectez les services externes — Cartes, IA, Email &amp; SMS · Admin uniquement
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: 60, color: t.textMuted, fontSize: 13,
        }}>
          <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Chargement…
        </div>
      ) : (
        <>
          {/* Cartes & Météo */}
          <Section t={t} Icon={MapPin} color="#10b981"
            title="Cartes & Météo" subtitle="Géolocalisation, routage et météo"
            status={groupStatus([SYSTEM_CONFIG_KEYS.googleMaps, SYSTEM_CONFIG_KEYS.weather])}>
            <div style={cardGrid}>
              {SERVICE_KEYS.map(def => (
                <KeyCard key={def.key} t={t} def={def} current={configs[def.key]} onSaved={onSaved} />
              ))}
            </div>
          </Section>

          {/* Intelligence Artificielle */}
          <Section t={t} Icon={Sparkles} color="#0ea5e9"
            title="Intelligence Artificielle" subtitle="Clés des modèles de langage, usage serveur"
            status={groupStatus([SYSTEM_CONFIG_KEYS.openai, SYSTEM_CONFIG_KEYS.claude])}>
            <div style={cardGrid}>
              {LLM_KEYS.map(def => (
                <KeyCard key={def.key} t={t} def={def} current={configs[def.key]} onSaved={onSaved} />
              ))}
            </div>
          </Section>

          {/* Email (SMTP) */}
          <Section t={t} Icon={Mail} color={SMTP_EMAIL}
            title="Email (SMTP)" subtitle="Serveur d'envoi des notifications par email"
            status={emailStatus()}>
            <div style={cardGrid}>
              {SMTP_TEXT_FIELDS.map(def => (
                <TextFieldCard key={def.key} t={t} def={def} current={configs[def.key]} onSaved={onSaved} />
              ))}
            </div>
            <div style={{ margin: "16px 0 12px" }}>
              <SecLabel t={t} color={SMTP_EMAIL}>Authentification & Sécurité</SecLabel>
            </div>
            <div style={cardGrid}>
              <KeyCard t={t} def={SMTP_PASS_FIELD} current={configs[SMTP_PASS_FIELD.key]} onSaved={onSaved} />
              <ToggleFieldCard t={t} def={SMTP_SECURE_FIELD} current={configs[SMTP_SECURE_FIELD.key]} onSaved={onSaved} />
            </div>
          </Section>

          {/* SMS */}
          <Section t={t} Icon={MessageSquare} color={SMS_GREEN}
            title="SMS" subtitle="Fournisseur d'envoi des notifications par SMS"
            status={smsStatus()}>
            <div style={cardGrid}>
              {SMS_TEXT_FIELDS.map(def => (
                <TextFieldCard key={def.key} t={t} def={def} current={configs[def.key]} onSaved={onSaved} />
              ))}
            </div>
            <div style={{ margin: "16px 0 12px" }}>
              <SecLabel t={t} color={SMS_GREEN}>Authentification</SecLabel>
            </div>
            <div style={cardGrid}>
              <KeyCard t={t} def={SMS_KEY_FIELD} current={configs[SMS_KEY_FIELD.key]} onSaved={onSaved} />
            </div>
          </Section>

          {/* security footer */}
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "10px 14px", borderRadius: 12,
            background: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.06)",
            border: "1px solid rgba(99,102,241,0.2)",
          }}>
            <ShieldCheck size={14} style={{ color: "#6366f1", flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 11.5, color: t.textSub, lineHeight: 1.5 }}>
              Les clés sont stockées côté serveur et utilisées uniquement par le backend. Elles ne sont
              jamais renvoyées en clair : seuls les 4 derniers caractères sont affichés. Laissez un champ
              vide pour conserver la clé existante.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
