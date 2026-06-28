"use client";

import { useState } from "react";
import {
  Target, Users, Banknote, TrendingUp, CheckCircle2, Plus, X, Check, Pencil, Trash2,
  Phone, MessageCircle, MessageSquare, Camera, LayoutTemplate, ShoppingBag,
} from "lucide-react";
import { useIsDark, useTokens, PageHeader, formatDA, ORANGE, type Tokens } from "../_ui";

/* ── pipeline stages (e-commerce order flow) ── */
type Stage = "nouveau" | "contacte" | "commande" | "gagne";
const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "nouveau", label: "Nouveau", color: "#3b82f6" },
  { key: "contacte", label: "Contacté", color: "#f59e0b" },
  { key: "commande", label: "Commande confirmée", color: "#8b5cf6" },
  { key: "gagne", label: "Livré / Gagné", color: "#22c55e" },
];

/* ── lead sources (where a prospect comes from) ── */
type LeadSource = "whatsapp" | "facebook" | "instagram" | "landing" | "boutique" | "manuel";
const SOURCE_META: Record<LeadSource, { label: string; color: string; icon: React.ElementType }> = {
  whatsapp:  { label: "WhatsApp",          color: "#25D366", icon: MessageCircle },
  facebook:  { label: "Facebook",          color: "#1877F2", icon: MessageSquare },
  instagram: { label: "Instagram",         color: "#E1306C", icon: Camera },
  landing:   { label: "Landing page",      color: "#8b5cf6", icon: LayoutTemplate },
  boutique:  { label: "Boutique en ligne", color: "#f97316", icon: ShoppingBag },
  manuel:    { label: "Manuel",            color: "#6b7280", icon: Pencil },
};
const SOURCE_KEYS = Object.keys(SOURCE_META) as LeadSource[];

interface Prospect { id: number; name: string; source: LeadSource; phone: string; value: number; stage: Stage; city: string; }
const SEED_PROSPECTS: Prospect[] = [
  { id: 1, name: "Amira Bensalem", source: "instagram", phone: "0661 22 90 14", value: 8500, stage: "nouveau", city: "Alger" },
  { id: 2, name: "Walid Cheref", source: "whatsapp", phone: "0770 41 88 02", value: 12000, stage: "nouveau", city: "Oran" },
  { id: 3, name: "Sounia Lateb", source: "landing", phone: "0540 19 67 33", value: 6400, stage: "nouveau", city: "Béjaïa" },
  { id: 4, name: "Nadir Hamlaoui", source: "facebook", phone: "0661 70 22 18", value: 21000, stage: "contacte", city: "Sétif" },
  { id: 5, name: "Yousra Drici", source: "boutique", phone: "0772 33 11 09", value: 4800, stage: "contacte", city: "Constantine" },
  { id: 6, name: "Ramzi Ould Ali", source: "manuel", phone: "0550 88 47 21", value: 15600, stage: "commande", city: "Blida" },
  { id: 7, name: "Feriel Saoudi", source: "whatsapp", phone: "0663 12 05 88", value: 9300, stage: "gagne", city: "Tizi Ouzou" },
  { id: 8, name: "Bilal Merabet", source: "boutique", phone: "0540 66 21 47", value: 18200, stage: "gagne", city: "Annaba" },
];

type Editing = Prospect | "new" | null;

export default function ExpediteurCrmPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [prospects, setProspects] = useState<Prospect[]>(SEED_PROSPECTS);
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState({ name: "", source: "manuel" as LeadSource, phone: "", value: "", city: "", stage: "nouveau" as Stage });

  const active = prospects.filter((p) => p.stage !== "gagne");
  const won = prospects.filter((p) => p.stage === "gagne");
  const pipeline = active.reduce((s, p) => s + p.value, 0);
  const conv = prospects.length ? Math.round((won.length / prospects.length) * 100) : 0;

  function move(id: number, stage: Stage) { setProspects((ps) => ps.map((p) => (p.id === id ? { ...p, stage } : p))); }
  function del(id: number) { setProspects((ps) => ps.filter((p) => p.id !== id)); }
  function openNew() { setForm({ name: "", source: "manuel", phone: "", value: "", city: "", stage: "nouveau" }); setEditing("new"); }
  function openEdit(p: Prospect) { setForm({ name: p.name, source: p.source, phone: p.phone, value: String(p.value), city: p.city, stage: p.stage }); setEditing(p); }
  function save() {
    if (!form.name.trim()) return;
    const data = { name: form.name, source: form.source, phone: form.phone, value: Number(form.value) || 0, city: form.city, stage: form.stage };
    if (editing === "new") setProspects((ps) => [{ id: Date.now(), ...data }, ...ps]);
    else if (editing) { const id = editing.id; setProspects((ps) => ps.map((p) => (p.id === id ? { ...p, ...data } : p))); }
    setEditing(null);
  }

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader
        title="CRM — Prospects"
        subtitle="Suivez vos prospects, de la première prise de contact à la vente"
        icon={Target}
        t={t}
        action={<button onClick={openNew} style={primaryBtn}><Plus size={15} /> Nouveau prospect</button>}
      />

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
        <Kpi label="Prospects actifs" value={String(active.length)} icon={Users} accent="#3b82f6" t={t} />
        <Kpi label="Valeur pipeline" value={formatDA(pipeline)} icon={Banknote} accent="#8b5cf6" t={t} />
        <Kpi label="Gagnés" value={String(won.length)} icon={CheckCircle2} accent="#22c55e" t={t} />
        <Kpi label="Taux de conversion" value={conv + " %"} icon={TrendingUp} accent={ORANGE} t={t} />
      </div>

      {/* Pipeline */}
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
        {STAGES.map((st) => {
          const ps = prospects.filter((p) => p.stage === st.key);
          const sum = ps.reduce((s, p) => s + p.value, 0);
          return (
            <div key={st.key} style={{ minWidth: 256, flex: "1 1 256px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: st.color + "12", marginBottom: 4 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: st.color }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />{st.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{ps.length}</span>
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, margin: "6px 4px 10px" }}>{formatDA(sum)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ps.map((p) => { const sm = SOURCE_META[p.source]; const Icon = sm.icon; const col = sm.color; return (
                  <div key={p.id} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 11, padding: 12, boxShadow: t.shadow, borderLeft: `3px solid ${st.color}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 7, background: col + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} title={sm.label}><Icon size={14} color={col} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: t.textMuted }}>{p.city} · {sm.label}</div>
                      </div>
                      <button onClick={() => openEdit(p)} title="Modifier" style={cardIconBtn(t)}><Pencil size={13} /></button>
                      <button onClick={() => del(p.id)} title="Supprimer" style={{ ...cardIconBtn(t), color: "#ef4444" }}><Trash2 size={13} /></button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: st.color }}>{formatDA(p.value)}</span>
                      <a href={`tel:${p.phone.replace(/[^0-9]/g, "")}`} style={{ fontSize: 11, color: t.textMuted, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", fontFamily: "monospace" }}><Phone size={11} />{p.phone}</a>
                    </div>
                    <select value={p.stage} onChange={(e) => move(p.id, e.target.value as Stage)} style={{ width: "100%", padding: "5px 8px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, cursor: "pointer" }}>
                      {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                ); })}
                {ps.length === 0 && <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: t.textFaint, border: `1px dashed ${t.border}`, borderRadius: 10 }}>—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {editing !== null && (
        <div onClick={() => setEditing(null)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 470, background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>{editing === "new" ? "Nouveau prospect" : "Modifier le prospect"}</h3>
              <button onClick={() => setEditing(null)} style={{ border: "none", background: "none", color: t.textFaint, cursor: "pointer" }}><X size={18} /></button>
            </div>

            {/* Source picker */}
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 8 }}>Source du prospect</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {SOURCE_KEYS.map((k) => { const m = SOURCE_META[k]; const Icon = m.icon; const sel = form.source === k; return (
                <button key={k} onClick={() => setForm({ ...form, source: k })} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${sel ? m.color : t.border}`, background: sel ? m.color + "14" : t.card, color: sel ? m.color : t.textSub }}>
                  <Icon size={13} /> {m.label}
                </button>
              ); })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Nom" t={t} full><input style={inp(t)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Téléphone" t={t}><input style={inp(t)} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="06xx xx xx xx" /></Field>
              <Field label="Valeur estimée (DA)" t={t}><input type="number" style={inp(t)} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></Field>
              <Field label="Ville" t={t}><input style={inp(t)} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="Étape" t={t}>
                <select style={inp(t)} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}>
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditing(null)} style={ghostBtn(t)}>Annuler</button>
              <button onClick={save} style={primaryBtn}><Check size={15} /> {editing === "new" ? "Ajouter" : "Enregistrer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── shared bits ── */
function Kpi({ label, value, icon: Icon, accent, t }: { label: string; value: string; icon: React.ElementType; accent: string; t: Tokens }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 150, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 18px", boxShadow: t.shadow, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: accent + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={17} color={accent} /></div>
        <span style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{value}</div>
    </div>
  );
}
function Field({ label, children, t, full }: { label: string; children: React.ReactNode; t: Tokens; full?: boolean }) {
  return <div style={{ gridColumn: full ? "1 / -1" : undefined }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>{label}</label>{children}</div>;
}
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, background: ORANGE, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghostBtn = (t: Tokens): React.CSSProperties => ({ padding: "9px 16px", borderRadius: 9, background: t.card, color: t.textSub, border: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, cursor: "pointer" });
const cardIconBtn = (t: Tokens): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 7, background: "transparent", color: t.textMuted, border: `1px solid ${t.border}`, cursor: "pointer", flexShrink: 0 });
const inp = (t: Tokens): React.CSSProperties => ({ width: "100%", padding: "9px 11px", borderRadius: 8, fontSize: 13, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none", fontFamily: "inherit" });
