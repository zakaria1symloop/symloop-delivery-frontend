"use client";

import { useState, useEffect } from "react";
import { Settings2, Search, Loader2, Save, Check, Network, Building2, Store, MapPin } from "lucide-react";
import { api } from "@/lib/api";

function useIsDark() {
  const [dark, setDark] = useState(() => typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function useTokens(isDark: boolean) {
  return isDark ? {
    bg: "#0e1017", card: "#111827", border: "#1e2130", divider: "#1e2130", rowHover: "#1a1f2e",
    text: "#f0f0f5", textSub: "#d1d5db", textMuted: "#6b7280", textFaint: "#4b5563",
    shadow: "none", inp: { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
  };
}

interface SDMargin {
  id: number; name: string; code: string | null; type: string;
  sender_margin: number; receiver_margin: number;
  auto_prelevement: boolean; payment_day: number | null;
  commune?: { name: string; wilaya?: { name: string } };
}

const TYPE_CFG: Record<string, { icon: typeof Network; color: string; label: string }> = {
  hub:    { icon: Network,  color: "#10b981", label: "Hub" },
  agence: { icon: Building2, color: "#3b82f6", label: "Agence" },
  depot:  { icon: Store,    color: "#f59e0b", label: "Dépôt" },
};

export default function MarginsPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [sds, setSds] = useState<SDMargin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [edited, setEdited] = useState<Record<number, Partial<SDMargin>>>({});

  useEffect(() => {
    api<SDMargin[]>("/sd-margins").then(res => {
      if (res.success && res.data) setSds(res.data);
      setLoading(false);
    });
  }, []);

  function updateField(id: number, field: string, value: any) {
    setEdited(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveSD(id: number) {
    const changes = edited[id];
    if (!changes) return;
    const sd = sds.find(s => s.id === id);
    if (!sd) return;
    setSaving(id);
    const payload = {
      sender_margin: changes.sender_margin ?? sd.sender_margin,
      receiver_margin: changes.receiver_margin ?? sd.receiver_margin,
      auto_prelevement: changes.auto_prelevement ?? sd.auto_prelevement,
      payment_day: changes.payment_day ?? sd.payment_day,
    };
    const res = await api(`/sd-margins/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    if ((res as any).success) {
      setSds(prev => prev.map(s => s.id === id ? { ...s, ...payload } : s));
      setEdited(prev => { const n = { ...prev }; delete n[id]; return n; });
      setToast(`${sd.name} mis à jour`);
      setTimeout(() => setToast(null), 3000);
    }
    setSaving(null);
  }

  const filtered = sds.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.code ?? "").toLowerCase().includes(q)
      || (s.commune?.name ?? "").toLowerCase().includes(q) || (s.commune?.wilaya?.name ?? "").toLowerCase().includes(q);
  });

  const hubs = filtered.filter(s => s.type === "hub");
  const others = filtered.filter(s => s.type !== "hub");

  return (
    <div style={{ minHeight: "100vh", background: t.bg }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
        }}>
          <Settings2 size={20} style={{ color: "#6366f1" }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Marges & Prélèvement SD</h1>
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Configuration des marges par Stop Desk — Admin uniquement</p>
        </div>
      </div>

      {/* Search */}
      <div style={{
        background: t.card, borderRadius: 14, border: `1px solid ${t.border}`,
        boxShadow: t.shadow, overflow: "hidden",
      }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.divider}` }}>
          <div style={{ position: "relative", maxWidth: 400 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
            <input placeholder="Rechercher un SD..." value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10,
                border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
                fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Stop Desk", "Type", "Wilaya", "Marge Envoi (DA)", "Marge Réception (DA)", "Prélèvement auto", "Jour de paiement", ""].map(h => (
                <th key={h} style={{
                  padding: "10px 16px", fontSize: 10, fontWeight: 700, color: t.textFaint,
                  textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "left",
                  borderBottom: `1px solid ${t.divider}`,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: t.textMuted }}>
                <Loader2 size={16} className="animate-spin" /> Chargement...
              </td></tr>
            )}

            {!loading && [...hubs, ...others].map(sd => {
              const cfg = TYPE_CFG[sd.type] ?? TYPE_CFG.agence;
              const Icon = cfg.icon;
              const e = edited[sd.id] ?? {};
              const senderPct = e.sender_margin ?? sd.sender_margin;
              const receiverPct = e.receiver_margin ?? sd.receiver_margin;
              const autoP = e.auto_prelevement ?? sd.auto_prelevement;
              const payDay = e.payment_day ?? sd.payment_day;
              const hasChanges = !!edited[sd.id];

              return (
                <tr key={sd.id}
                  style={{ transition: "background 100ms" }}
                  onMouseEnter={e => (e.currentTarget.style.background = t.rowHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: `${cfg.color}15`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}><Icon size={13} color={cfg.color} /></div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{sd.name}</div>
                        {sd.code && <div style={{ fontSize: 10, color: t.textFaint, fontFamily: "monospace" }}>{sd.code}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: `${cfg.color}15`, padding: "2px 8px", borderRadius: 99 }}>{cfg.label}</span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: t.textMuted }}>
                    {sd.commune?.wilaya?.name ?? "—"}
                  </td>
                  {/* Marge Envoi DA */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" min="0" step="10"
                        value={senderPct} onChange={e => updateField(sd.id, "sender_margin", parseFloat(e.target.value) || 0)}
                        style={{
                          width: 80, padding: "6px 8px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                          border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: "#f97316",
                          textAlign: "right", outline: "none",
                        }}
                      />
                      <span style={{ fontSize: 11, color: t.textFaint }}>DA</span>
                    </div>
                  </td>
                  {/* Marge Réception DA */}
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="number" min="0" step="10"
                        value={receiverPct} onChange={e => updateField(sd.id, "receiver_margin", parseFloat(e.target.value) || 0)}
                        style={{
                          width: 80, padding: "6px 8px", borderRadius: 7, fontSize: 13, fontWeight: 600,
                          border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: "#3b82f6",
                          textAlign: "right", outline: "none",
                        }}
                      />
                      <span style={{ fontSize: 11, color: t.textFaint }}>DA</span>
                    </div>
                  </td>
                  {/* Toggle switch */}
                  <td style={{ padding: "12px 16px" }}>
                    <div
                      onClick={() => updateField(sd.id, "auto_prelevement", !autoP)}
                      style={{
                        width: 40, height: 22, borderRadius: 11, cursor: "pointer",
                        background: autoP ? "#16a34a" : (isDark ? "#333" : "#d1d5db"),
                        position: "relative", transition: "background 200ms",
                      }}
                    >
                      <div style={{
                        position: "absolute", top: 3,
                        left: autoP ? 21 : 3,
                        width: 16, height: 16, borderRadius: "50%", background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                        transition: "left 180ms",
                      }} />
                    </div>
                  </td>
                  {/* Jour de paiement — select */}
                  <td style={{ padding: "12px 16px" }}>
                    {!autoP ? (
                      <select
                        value={payDay ?? ""}
                        onChange={e => updateField(sd.id, "payment_day", e.target.value ? parseInt(e.target.value) : null)}
                        style={{
                          padding: "6px 10px", borderRadius: 7, fontSize: 12,
                          border: `1px solid ${t.inp.border}`, background: t.inp.bg, color: t.inp.text,
                          cursor: "pointer", outline: "none",
                        }}
                      >
                        <option value="">— Choisir —</option>
                        {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>Le {d}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>Automatique</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    {hasChanges && (
                      <button onClick={() => saveSD(sd.id)} disabled={saving === sd.id} style={{
                        padding: "6px 14px", borderRadius: 8, border: "none",
                        background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700,
                        cursor: saving === sd.id ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", gap: 4, opacity: saving === sd.id ? 0.6 : 1,
                      }}>
                        {saving === sd.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        Sauvegarder
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          background: "#16a34a", color: "#fff", padding: "12px 20px", borderRadius: 12,
          fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Check size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
