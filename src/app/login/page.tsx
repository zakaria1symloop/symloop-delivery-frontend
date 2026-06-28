"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login, setAuth } from "@/lib/api";
import { Loader2, Package2, CheckCircle2, Mail, Lock, ArrowRight } from "lucide-react";

const quickLogins = [
  { label: "Admin",       email: "admin@delivery.test",       color: "#3b82f6", bg: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)"  },
  { label: "Operator",    email: "operator@delivery.test",    color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.2)"  },
  { label: "Responsable", email: "responsable@delivery.test", color: "#10b981", bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.2)"  },
  { label: "Expéditeur",  email: "expediteur@delivery.test",  color: "#f43f5e", bg: "rgba(244,63,94,0.08)",   border: "rgba(244,63,94,0.2)"   },
];

const features = [
  "Suivi des colis en temps réel sur 58 wilayas",
  "Gestion des chauffeurs et optimisation des routes",
  "Rapports financiers complets",
  "Accès multi-rôles : admin, opérateur, chauffeur",
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusField, setFocusField] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  async function handleLogin(e?: React.FormEvent, overrideEmail?: string) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    const res = await login(overrideEmail ?? email, overrideEmail ? "password" : password);
    if (res.success && res.data) {
      setAuth(res.data.token, res.data.user);
      router.push(res.data.redirect);
    } else {
      setError(res.message || "Identifiants incorrects");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      background: "#060810",
      fontFamily: "'Segoe UI', -apple-system, sans-serif",
    }}>

      {/* ── Left: Branding ── */}
      <aside style={{
        width: "44%", display: "flex", flexDirection: "column",
        padding: "48px 56px", position: "relative", overflow: "hidden",
      }} className="hidden lg:flex">

        {/* Background glow */}
        <div style={{
          position: "absolute", top: -120, right: -120,
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -80, left: -80,
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(249,115,22,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Grid pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
          backgroundSize: "56px 56px",
        }} />

        {/* Top accent */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.5), transparent)",
        }} />

        {/* Logo */}
        <div style={{ position: "relative", zIndex: 1, lineHeight: 1 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
            Sym<span style={{ color: "#f97316" }}>loop</span>
          </span>
          <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.34em", marginTop: 6 }}>
            logistique
          </div>
        </div>

        {/* Main copy */}
        <div style={{ marginTop: "auto", marginBottom: "auto", position: "relative", zIndex: 1 }}>
          <p style={{
            fontSize: 11, fontWeight: 700, color: "#f97316",
            textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 16,
          }}>
            Plateforme logistique
          </p>
          <h1 style={{
            fontSize: 36, fontWeight: 800, color: "#fff",
            lineHeight: 1.15, letterSpacing: -0.5, margin: 0,
          }}>
            Tout ce dont vous avez
            <br />
            besoin pour gérer vos
            <br />
            <span style={{ color: "#f97316" }}>livraisons.</span>
          </h1>
          <p style={{
            fontSize: 14, color: "rgba(255,255,255,0.35)", lineHeight: 1.7,
            marginTop: 20, maxWidth: 320,
          }}>
            Une plateforme pour les colis, les chauffeurs, les routes et les finances — conçue pour la logistique algérienne.
          </p>

          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 14 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <CheckCircle2 size={15} style={{ color: "rgba(249,115,22,0.7)", marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Tous les systèmes opérationnels</span>
        </div>
      </aside>

      {/* ── Right: Form ── */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 24px",
        background: "#0a0e1a",
      }}>

        {/* Mobile logo — only visible when left panel is hidden */}
        <div className="flex lg:hidden" style={{ flexDirection: "column", marginBottom: 40, alignSelf: "flex-start", lineHeight: 1 }}>
          <span style={{ fontSize: 23, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>
            Sym<span style={{ color: "#f97316" }}>loop</span>
          </span>
          <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.32em", marginTop: 5 }}>
            logistique
          </div>
        </div>

        <div style={{ width: "100%", maxWidth: 380 }}>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: "#f5f5f5", margin: 0, letterSpacing: -0.5 }}>
              Connexion
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>
              Connectez-vous à votre compte pour continuer
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 7 }}>
                Adresse email
              </label>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "#111827", borderRadius: 10,
                border: `1.5px solid ${focusField === "email" ? "#f97316" : "#1e2130"}`,
                padding: "0 14px", transition: "border-color 200ms",
              }}>
                <Mail size={15} style={{ color: focusField === "email" ? "#f97316" : "#4b5563", flexShrink: 0, transition: "color 200ms" }} />
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="nom@entreprise.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocusField("email")}
                  onBlur={() => setFocusField(null)}
                  required
                  style={{
                    flex: 1, border: "none", outline: "none", background: "transparent",
                    color: "#f0f0f5", fontSize: 14, padding: "13px 0",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#9ca3af", marginBottom: 7 }}>
                Mot de passe
              </label>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "#111827", borderRadius: 10,
                border: `1.5px solid ${focusField === "password" ? "#f97316" : "#1e2130"}`,
                padding: "0 14px", transition: "border-color 200ms",
              }}>
                <Lock size={15} style={{ color: focusField === "password" ? "#f97316" : "#4b5563", flexShrink: 0, transition: "color 200ms" }} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocusField("password")}
                  onBlur={() => setFocusField(null)}
                  required
                  style={{
                    flex: 1, border: "none", outline: "none", background: "transparent",
                    color: "#f0f0f5", fontSize: 14, padding: "13px 0",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                fontSize: 13, color: "#ef4444", background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10,
                padding: "10px 14px", fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
                background: loading ? "#c2410c" : "linear-gradient(135deg, #f97316, #ea580c)",
                color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 4px 16px rgba(249,115,22,0.25)",
                transition: "all 200ms",
                marginTop: 4,
              }}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Connexion en cours...</>
              ) : (
                <><span>Se connecter</span><ArrowRight size={15} /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ position: "relative", margin: "28px 0" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}>
              <div style={{ width: "100%", height: 1, background: "#1e2130" }} />
            </div>
            <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
              <span style={{
                background: "#0a0e1a", padding: "0 14px",
                fontSize: 10, fontWeight: 700, color: "#4b5563",
                textTransform: "uppercase", letterSpacing: "0.12em",
              }}>
                Comptes de développement
              </span>
            </div>
          </div>

          {/* Quick logins */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {quickLogins.map(q => (
              <button
                key={q.email}
                type="button"
                disabled={loading}
                onClick={() => handleLogin(undefined, q.email)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = q.color; e.currentTarget.style.background = q.bg; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e2130"; e.currentTarget.style.background = "transparent"; }}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "11px 14px", borderRadius: 10,
                  border: "1.5px solid #1e2130", background: "transparent",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1, transition: "all 200ms",
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: q.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#d1d5db" }}>{q.label}</span>
              </button>
            ))}
          </div>

          <p style={{
            fontSize: 11, color: "#4b5563", textAlign: "center", marginTop: 14,
          }}>
            Mot de passe : <code style={{
              fontFamily: "monospace", color: "#6b7280",
              background: "#111827", padding: "2px 7px", borderRadius: 5, fontSize: 11,
            }}>password</code>
          </p>
        </div>
      </main>
    </div>
  );
}
