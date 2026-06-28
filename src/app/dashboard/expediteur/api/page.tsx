"use client";

import { useState } from "react";
import { Code2, Copy, Check, Eye, EyeOff, KeyRound, Webhook, Zap } from "lucide-react";
import { useIsDark, useTokens, PageHeader, ORANGE } from "../_ui";

const BASE_URL = "https://api.delivery.dz/v1";
const API_KEY = "sk_live_7f3c9a21b8e54d06a1f29c4e8b7d3201";

const METHOD_COLORS: Record<string, string> = {
  GET: "#22c55e", POST: "#3b82f6", PUT: "#f59e0b", DELETE: "#ef4444",
};

interface Endpoint {
  method: string; path: string; title: string; desc: string;
  req?: string; res: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST", path: "/colis", title: "Créer un colis", desc: "Crée un nouvel envoi et retourne le numéro de suivi.",
    req: `{
  "recipient_name": "Ali Benali",
  "recipient_phone": "0555123456",
  "wilaya": "Alger",
  "commune": "Bab El Oued",
  "address": "12 Rue Didouche Mourad",
  "delivery_type": "home_delivery",
  "cod_amount": 4500,
  "content": "Vêtements",
  "product_sku": "TS-NOIR-L"
}`,
    res: `{
  "success": true,
  "data": {
    "tracking_number": "DLV-20260611-A3F9C2",
    "status": "en_attente",
    "shipping_cost": 450,
    "cod_amount": 4500,
    "label_url": "https://api.../labels/DLV-20260611-A3F9C2.pdf"
  }
}`,
  },
  {
    method: "GET", path: "/colis/{tracking}", title: "Suivi d'un colis", desc: "Récupère l'état et l'historique d'un colis.",
    res: `{
  "success": true,
  "data": {
    "tracking_number": "DLV-20260611-A3F9C2",
    "status": "en_cours_livraison",
    "history": [
      { "status": "en_attente",         "at": "2026-06-11T09:02:00Z" },
      { "status": "en_transit",          "at": "2026-06-11T14:20:00Z" },
      { "status": "en_cours_livraison",  "at": "2026-06-12T08:10:00Z" }
    ]
  }
}`,
  },
  {
    method: "GET", path: "/wilayas", title: "Liste des wilayas", desc: "Les 58 wilayas desservies avec leurs communes.",
    res: `{
  "success": true,
  "data": [
    { "code": "16", "name": "Alger",       "communes": 57 },
    { "code": "31", "name": "Oran",        "communes": 26 },
    { "code": "25", "name": "Constantine", "communes": 12 }
  ]
}`,
  },
  {
    method: "GET", path: "/tarifs?wilaya=16", title: "Tarifs par wilaya", desc: "Tarifs domicile / stop desk pour une destination.",
    res: `{
  "success": true,
  "data": { "wilaya": "Alger", "domicile": 450, "stop_desk": 300, "delai": "24 – 48h" }
}`,
  },
  {
    method: "DELETE", path: "/colis/{tracking}", title: "Annuler un colis", desc: "Annule un colis non encore expédié.",
    res: `{ "success": true, "message": "Colis annulé." }`,
  },
];

function Code({ children, t }: { children: string; t: ReturnType<typeof useTokens> }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div style={{ position: "relative" }}>
      <button onClick={copy} style={{
        position: "absolute", top: 8, right: 8, zIndex: 1,
        display: "flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7,
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
        color: copied ? "#22c55e" : "#cbd5e1", fontSize: 11, fontWeight: 600, cursor: "pointer",
      }}>
        {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copié" : "Copier"}
      </button>
      <pre style={{
        margin: 0, padding: "14px 16px", borderRadius: 10, overflowX: "auto",
        background: t.codeBg, border: `1px solid ${t.codeBorder}`,
        color: "#e2e8f0", fontSize: 12.5, lineHeight: 1.6, fontFamily: "ui-monospace, Menlo, monospace",
      }}>{children}</pre>
    </div>
  );
}

export default function ApiRestPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [sel, setSel] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const ep = ENDPOINTS[sel];

  function copyKey() {
    navigator.clipboard?.writeText(API_KEY);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1400);
  }

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader
        title="API REST"
        subtitle="Intégrez la livraison à votre boutique en ligne"
        icon={Code2}
        t={t}
      />

      {/* API key + base URL */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ flex: "1 1 420px", background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18, boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: t.text, fontWeight: 700, fontSize: 13.5 }}>
            <KeyRound size={16} color={ORANGE} /> Votre clé API
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{
              flex: 1, padding: "10px 12px", borderRadius: 9, background: t.codeBg, color: "#e2e8f0",
              fontSize: 12.5, fontFamily: "monospace", overflowX: "auto", whiteSpace: "nowrap",
            }}>
              {reveal ? API_KEY : "sk_live_" + "•".repeat(32)}
            </code>
            <IconBtn onClick={() => setReveal((v) => !v)} t={t}>{reveal ? <EyeOff size={15} /> : <Eye size={15} />}</IconBtn>
            <IconBtn onClick={copyKey} t={t}>{copiedKey ? <Check size={15} color="#22c55e" /> : <Copy size={15} />}</IconBtn>
          </div>
          <p style={{ fontSize: 11.5, color: t.textFaint, marginTop: 10 }}>
            Authentifiez chaque requête avec l'en-tête <code style={{ color: ORANGE }}>Authorization: Bearer &lt;clé&gt;</code>
          </p>
        </div>

        <div style={{ flex: "1 1 280px", background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18, boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: t.text, fontWeight: 700, fontSize: 13.5 }}>
            <Zap size={16} color={ORANGE} /> URL de base
          </div>
          <code style={{ display: "block", padding: "10px 12px", borderRadius: 9, background: t.codeBg, color: "#e2e8f0", fontSize: 12.5, fontFamily: "monospace", overflowX: "auto" }}>
            {BASE_URL}
          </code>
          <p style={{ fontSize: 11.5, color: t.textFaint, marginTop: 10 }}>Toutes les réponses sont en JSON · HTTPS uniquement.</p>
        </div>
      </div>

      {/* Endpoints explorer */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 280px", maxWidth: 360, display: "flex", flexDirection: "column", gap: 8 }}>
          {ENDPOINTS.map((e, i) => {
            const active = i === sel;
            const mc = METHOD_COLORS[e.method];
            return (
              <button key={e.path + i} onClick={() => setSel(i)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", borderRadius: 11, cursor: "pointer",
                textAlign: "left", transition: "all .15s",
                background: active ? ORANGE + "0e" : t.card,
                border: `1px solid ${active ? ORANGE + "55" : t.border}`,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, color: mc, background: mc + "18",
                  padding: "3px 7px", borderRadius: 6, minWidth: 48, textAlign: "center", letterSpacing: 0.3,
                }}>{e.method}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 650, color: t.text }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.path}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ flex: "2 1 420px", minWidth: 0, background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, boxShadow: t.shadow }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: METHOD_COLORS[ep.method], background: METHOD_COLORS[ep.method] + "18", padding: "4px 9px", borderRadius: 6 }}>{ep.method}</span>
            <code style={{ fontSize: 13.5, color: t.text, fontWeight: 600, fontFamily: "monospace" }}>{ep.path}</code>
          </div>
          <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 16px" }}>{ep.desc}</p>

          {ep.req && (
            <>
              <Label t={t}>Requête</Label>
              <Code t={t}>{`curl -X ${ep.method} ${BASE_URL}${ep.path} \\
  -H "Authorization: Bearer sk_live_…" \\
  -H "Content-Type: application/json" \\
  -d '${ep.req}'`}</Code>
              <div style={{ height: 14 }} />
            </>
          )}
          <Label t={t}>Réponse</Label>
          <Code t={t}>{ep.res}</Code>
        </div>
      </div>

      {/* Webhooks */}
      <div style={{ marginTop: 22, background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, boxShadow: t.shadow }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: t.text, fontWeight: 700, fontSize: 14 }}>
          <Webhook size={17} color={ORANGE} /> Webhooks
        </div>
        <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 14px" }}>
          Recevez une notification HTTP à chaque changement de statut (livré, échec, retour…).
        </p>
        <Code t={t}>{`POST  https://votre-boutique.dz/webhooks/delivery
{
  "event": "package.delivered",
  "tracking_number": "DLV-20260611-A3F9C2",
  "cod_collected": 4500,
  "at": "2026-06-12T11:42:00Z"
}`}</Code>
      </div>
    </div>
  );
}

function Label({ children, t }: { children: React.ReactNode; t: ReturnType<typeof useTokens> }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>{children}</div>;
}

function IconBtn({ children, onClick, t }: { children: React.ReactNode; onClick: () => void; t: ReturnType<typeof useTokens> }) {
  return (
    <button onClick={onClick} style={{
      width: 38, height: 38, borderRadius: 9, flexShrink: 0, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: t.card, border: `1px solid ${t.border}`, color: t.textSub,
    }}>{children}</button>
  );
}
