"use client";

import { Globe, Sparkles, LayoutTemplate, ShoppingBag, CreditCard, Palette, Rocket, BellRing } from "lucide-react";
import { useIsDark, useTokens, PageHeader, Badge, ORANGE, type Tokens } from "../_ui";

const FEATURES = [
  { icon: LayoutTemplate, title: "Builder par glisser-déposer", desc: "Composez votre boutique sans code — sections, blocs, thèmes prêts à l'emploi." },
  { icon: ShoppingBag, title: "Catalogue synchronisé", desc: "Vos produits & stock se synchronisent automatiquement avec la livraison." },
  { icon: CreditCard, title: "Paiement & COD", desc: "Paiement à la livraison et en ligne (CIB / Edahabia) intégrés nativement." },
  { icon: Palette, title: "Thèmes algériens", desc: "Modèles localisés (RTL, DA, wilayas) optimisés pour le marché local." },
  { icon: Rocket, title: "Commandes → Colis", desc: "Chaque commande crée un colis automatiquement, déduit du stock." },
  { icon: Sparkles, title: "Visuels par IA", desc: "Générez fiches produits et bannières à partir d'un simple texte." },
];

export default function EcommercePage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader title="E-commerce" subtitle="Créez votre boutique en ligne connectée à la livraison" icon={Globe} t={t} />

      {/* Hero */}
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: 18, padding: "48px 36px", marginBottom: 26,
        background: `linear-gradient(135deg, ${ORANGE}14, ${isDark ? "#1e2130" : "#fff7ed"})`,
        border: `1px solid ${t.border}`, textAlign: "center",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", background: ORANGE + "22", filter: "blur(40px)" }} />
        <div style={{ position: "relative" }}>
          <Badge color={ORANGE} bg={ORANGE + "1e"}><BellRing size={12} /> Bientôt disponible</Badge>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: t.text, margin: "16px 0 10px", letterSpacing: -0.5 }}>
            Votre boutique, livrée clé en main
          </h2>
          <p style={{ fontSize: 15, color: t.textMuted, maxWidth: 560, margin: "0 auto 24px", lineHeight: 1.6 }}>
            Un constructeur de site e-commerce intégré à votre système de livraison : créez, vendez,
            et chaque commande devient automatiquement un colis. <b style={{ color: t.text }}>En cours de développement.</b>
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button disabled style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 11, background: ORANGE, color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "not-allowed", opacity: 0.6 }}>
              <Rocket size={16} /> Lancer le builder
            </button>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 11, background: t.card, color: t.textSub, border: `1px solid ${t.border}`, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              <BellRing size={16} /> Me prévenir au lancement
            </button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {FEATURES.map((f) => (
          <div key={f.title} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 20, boxShadow: t.shadow, position: "relative" }}>
            <span style={{ position: "absolute", top: 14, right: 14, fontSize: 9.5, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: 0.6, border: `1px solid ${t.border}`, padding: "2px 7px", borderRadius: 20 }}>Bientôt</span>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: ORANGE + "14", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <f.icon size={22} color={ORANGE} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.55 }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
