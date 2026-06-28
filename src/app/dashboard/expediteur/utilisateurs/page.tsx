"use client";

import { useState } from "react";
import { Users, UserPlus, X, Mail, Phone, Shield, Trash2 } from "lucide-react";
import { useIsDark, useTokens, PageHeader, Badge, ORANGE } from "../_ui";

type Role = "Gestionnaire" | "Opérateur" | "Lecture seule";
interface SubUser {
  id: number; first_name: string; last_name: string; email: string; phone: string;
  role: Role; active: boolean;
}

const ROLE_COLORS: Record<Role, string> = {
  "Gestionnaire": "#8b5cf6", "Opérateur": "#3b82f6", "Lecture seule": "#6b7280",
};

const SEED: SubUser[] = [
  { id: 1, first_name: "Yacine", last_name: "Haddad", email: "yacine@maboutique.dz", phone: "0661 22 14 87", role: "Gestionnaire", active: true },
  { id: 2, first_name: "Lina", last_name: "Bouzid", email: "lina@maboutique.dz", phone: "0770 55 09 32", role: "Opérateur", active: true },
  { id: 3, first_name: "Karim", last_name: "Saïdi", email: "karim@maboutique.dz", phone: "0540 18 76 41", role: "Lecture seule", active: false },
];

export default function UtilisateursPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [users, setUsers] = useState<SubUser[]>(SEED);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", role: "Opérateur" as Role });

  function add() {
    if (!form.first_name.trim() || !form.email.trim()) return;
    setUsers((u) => [{ id: Date.now(), ...form, active: true }, ...u]);
    setForm({ first_name: "", last_name: "", email: "", phone: "", role: "Opérateur" });
    setOpen(false);
  }
  function toggle(id: number) {
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, active: !x.active } : x)));
  }
  function remove(id: number) {
    setUsers((u) => u.filter((x) => x.id !== id));
  }

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader
        title="Mes Utilisateurs"
        subtitle="Gérez les sous-comptes rattachés à votre espace expéditeur"
        icon={Users}
        t={t}
        action={
          <button onClick={() => setOpen(true)} style={primaryBtn}>
            <UserPlus size={15} /> Ajouter un utilisateur
          </button>
        }
      />

      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.divider}`, background: isDark ? "#0b0e16" : "#fafafa" }}>
                {["Utilisateur", "Contact", "Rôle", "Statut", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${t.divider}` }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: ORANGE + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: ORANGE }}>
                        {(u.first_name[0] ?? "").toUpperCase()}{(u.last_name[0] ?? "").toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: t.text }}>{u.first_name} {u.last_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: t.textSub }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}><Mail size={12} color={t.textFaint} />{u.email}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 12 }}><Phone size={12} color={t.textFaint} />{u.phone || "—"}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge color={ROLE_COLORS[u.role]} bg={ROLE_COLORS[u.role] + "18"}><Shield size={11} />{u.role}</Badge>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button onClick={() => toggle(u.id)} style={{ cursor: "pointer", border: "none", background: "none", padding: 0 }}>
                      <Badge color={u.active ? "#22c55e" : "#ef4444"} bg={(u.active ? "#22c55e" : "#ef4444") + "18"}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: u.active ? "#22c55e" : "#ef4444" }} />
                        {u.active ? "Actif" : "Suspendu"}
                      </Badge>
                    </button>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button onClick={() => remove(u.id)} title="Supprimer" style={{ cursor: "pointer", border: "none", background: "none", color: t.textFaint, padding: 6, borderRadius: 7 }}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: t.textMuted }}>Aucun sous-compte. Ajoutez votre première équipe.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal onClose={() => setOpen(false)} t={t} title="Nouvel utilisateur">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Prénom" t={t}><input style={inp(t)} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
            <Field label="Nom" t={t}><input style={inp(t)} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
            <Field label="Email" t={t} full><input style={inp(t)} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="prenom@maboutique.dz" /></Field>
            <Field label="Téléphone" t={t}><input style={inp(t)} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="06xx xx xx xx" /></Field>
            <Field label="Rôle" t={t}>
              <select style={inp(t)} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option>Gestionnaire</option><option>Opérateur</option><option>Lecture seule</option>
              </select>
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button onClick={() => setOpen(false)} style={ghostBtn(t)}>Annuler</button>
            <button onClick={add} style={primaryBtn}>Créer l'utilisateur</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9,
  background: ORANGE, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const ghostBtn = (t: ReturnType<typeof useTokens>): React.CSSProperties => ({
  padding: "9px 16px", borderRadius: 9, background: t.card, color: t.textSub,
  border: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, cursor: "pointer",
});
const inp = (t: ReturnType<typeof useTokens>): React.CSSProperties => ({
  width: "100%", padding: "9px 11px", borderRadius: 8, fontSize: 13,
  background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none",
});

function Field({ label, children, t, full }: { label: string; children: React.ReactNode; t: ReturnType<typeof useTokens>; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

export function Modal({ children, onClose, t, title }: { children: React.ReactNode; onClose: () => void; t: ReturnType<typeof useTokens>; title: string }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>{title}</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", color: t.textFaint, cursor: "pointer" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
