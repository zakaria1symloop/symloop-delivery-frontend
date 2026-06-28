"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldCheck, Loader2, Plus, Pencil, Trash2, X, Check,
  AlertCircle, Users, FileText, KeySquare, Lock,
} from "lucide-react";
import { getStoredUser } from "@/lib/api";
import {
  getRoles, createRole, updateRole, deleteRole, getRolesRegistry,
  type Role, type RolesRegistry,
} from "@/lib/roles";

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
    modalBg: "#111827", overlay: "rgba(0,0,0,0.7)",
  } : {
    bg: "#ffffff", card: "#ffffff", border: "#e5e7eb", divider: "#f3f4f6", rowHover: "#f9fafb",
    text: "#111827", textSub: "#374151", textMuted: "#6b7280", textFaint: "#9ca3af",
    shadow: "0 1px 2px rgba(0,0,0,0.06)", inp: { bg: "#ffffff", border: "#d1d5db", text: "#111827" }, sectionBg: "#f9fafb",
    modalBg: "#ffffff", overlay: "rgba(0,0,0,0.4)",
  };
}
type T = ReturnType<typeof useTokens>;

const ACCENT = "#f97316";

/* ── checkbox primitive ──────────────────────────────────── */
function CheckRow({ t, checked, onToggle, title, subtitle }: {
  t: T; checked: boolean; onToggle: () => void; title: string; subtitle?: string;
}) {
  return (
    <button type="button" onClick={onToggle}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10, width: "100%", textAlign: "left",
        padding: "9px 11px", borderRadius: 9, cursor: "pointer",
        background: checked ? `${ACCENT}10` : t.sectionBg,
        border: `1.5px solid ${checked ? `${ACCENT}55` : t.border}`,
        transition: "all 0.12s",
      }}
    >
      <span style={{
        width: 17, height: 17, borderRadius: 5, flexShrink: 0, marginTop: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: checked ? ACCENT : "transparent",
        border: `1.5px solid ${checked ? ACCENT : t.inp.border}`,
        transition: "all 0.12s",
      }}>
        {checked && <Check size={12} color="#fff" strokeWidth={3} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: checked ? (t.text) : t.textSub }}>{title}</span>
        {subtitle && <span style={{ display: "block", fontSize: 11, color: t.textMuted, marginTop: 1, lineHeight: 1.4 }}>{subtitle}</span>}
      </span>
    </button>
  );
}

/* ── role create/edit modal ──────────────────────────────── */
function RoleModal({ t, editing, registry, registryLoading, onClose, onSaved }: {
  t: T; editing: Role | null; registry: RolesRegistry | null; registryLoading: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [pages, setPages] = useState<Set<string>>(new Set(editing?.pages ?? []));
  const [permissions, setPermissions] = useState<Set<string>>(new Set(editing?.permissions ?? []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  // Group registry pages by their `group`.
  const grouped = useMemo(() => {
    const map = new Map<string, RolesRegistry["pages"]>();
    for (const p of registry?.pages ?? []) {
      const arr = map.get(p.group) ?? [];
      arr.push(p);
      map.set(p.group, arr);
    }
    return Array.from(map.entries());
  }, [registry]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  }

  async function save() {
    if (!name.trim()) { setError("Le nom du rôle est requis."); return; }
    setSaving(true); setError("");
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      pages: Array.from(pages),
      permissions: Array.from(permissions),
    };
    const res = editing
      ? await updateRole(editing.id, payload)
      : await createRole(payload);
    setSaving(false);
    if (res.success) { onSaved(); onClose(); }
    else setError(res.message || "Échec de l'enregistrement.");
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: t.inp.bg,
    border: `1.5px solid ${t.inp.border}`, borderRadius: 9, padding: "10px 13px",
    fontSize: 13, color: t.inp.text, outline: "none", minHeight: 42,
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50, background: t.overlay,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, backdropFilter: "blur(3px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: t.modalBg, border: `1px solid ${t.border}`, borderRadius: 16,
        width: "100%", maxWidth: 640, maxHeight: "calc(100vh - 40px)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.22)", display: "flex", flexDirection: "column",
        overflow: "hidden", fontFamily: "var(--font-jakarta, sans-serif)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px", borderBottom: `1px solid ${t.border}`, flexShrink: 0,
          background: `linear-gradient(135deg, ${ACCENT}14 0%, ${ACCENT}06 100%)`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 3, height: 18, borderRadius: 2, background: ACCENT }} />
            <ShieldCheck size={16} style={{ color: ACCENT }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
              {editing ? "Modifier le rôle" : "Nouveau rôle"}
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, display: "flex", padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 9, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#ef4444" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          {/* Name + description */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, display: "block", marginBottom: 5 }}>
                Nom <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Caissier" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: t.textMuted, display: "block", marginBottom: 5 }}>
                Description
              </label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Courte description du rôle" style={inputStyle} />
            </div>
          </div>

          {registryLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 24, color: t.textMuted, fontSize: 13 }}>
              <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> Chargement du registre…
            </div>
          ) : (
            <>
              {/* Pages */}
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                  <FileText size={14} style={{ color: ACCENT }} />
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.text }}>Pages accessibles</h3>
                  <span style={{ fontSize: 11, color: t.textMuted }}>· {pages.size} sélectionnée(s)</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {grouped.length === 0 && (
                    <p style={{ margin: 0, fontSize: 12, color: t.textFaint }}>Aucune page dans le registre.</p>
                  )}
                  {grouped.map(([group, items]) => (
                    <div key={group}>
                      <p style={{ margin: "0 0 7px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textFaint }}>
                        {group}
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                        {items.map((p) => (
                          <CheckRow key={p.key} t={t} checked={pages.has(p.key)} title={p.label}
                            onToggle={() => toggle(pages, setPages, p.key)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Permissions */}
              <section>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                  <KeySquare size={14} style={{ color: ACCENT }} />
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.text }}>Permissions</h3>
                  <span style={{ fontSize: 11, color: t.textMuted }}>· {permissions.size} sélectionnée(s)</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {(registry?.permissions ?? []).length === 0 && (
                    <p style={{ margin: 0, fontSize: 12, color: t.textFaint }}>Aucune permission dans le registre.</p>
                  )}
                  {(registry?.permissions ?? []).map((p) => (
                    <CheckRow key={p.key} t={t} checked={permissions.has(p.key)} title={p.label} subtitle={p.description}
                      onToggle={() => toggle(permissions, setPermissions, p.key)} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "none", border: `1.5px solid ${t.border}`, borderRadius: 9, padding: "9px 16px", fontSize: 12.5, fontWeight: 500, color: t.textSub, cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={save} disabled={saving} style={{
            display: "flex", alignItems: "center", gap: 7, background: saving ? `${ACCENT}99` : ACCENT,
            border: "none", borderRadius: 9, padding: "9px 20px", fontSize: 12.5, fontWeight: 600,
            color: "#fff", cursor: saving ? "not-allowed" : "pointer", minWidth: 130, justifyContent: "center",
          }}>
            {saving && <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />}
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── role card ───────────────────────────────────────────── */
function RoleCard({ t, role, onEdit, onDelete }: {
  t: T; role: Role; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: "16px 18px", boxShadow: t.shadow }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${ACCENT}14`, border: `1px solid ${ACCENT}33` }}>
            <ShieldCheck size={18} style={{ color: ACCENT }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>{role.name}</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {role.description || "Aucune description"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button onClick={onEdit} title="Modifier" style={{ background: "none", border: "none", borderRadius: 7, padding: "7px 8px", cursor: "pointer", color: t.textMuted, display: "flex" }}>
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} title="Supprimer" style={{ background: "none", border: "none", borderRadius: 7, padding: "7px 8px", cursor: "pointer", color: "#ef4444", display: "flex" }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {[
          { Icon: FileText, label: "pages", value: role.pages.length },
          { Icon: KeySquare, label: "permissions", value: role.permissions.length },
          { Icon: Users, label: "utilisateurs", value: role.users_count },
        ].map(({ Icon, label, value }) => (
          <span key={label} style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8,
            background: t.sectionBg, border: `1px solid ${t.divider}`, fontSize: 11.5, color: t.textSub, fontWeight: 600,
          }}>
            <Icon size={12} style={{ color: t.textMuted }} />
            {value} <span style={{ color: t.textMuted, fontWeight: 500 }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────── */
export default function RolesPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const isAdmin = (getStoredUser()?.user_type ?? "") === "admin";

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [registry, setRegistry] = useState<RolesRegistry | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getRoles();
    setRoles(res.success && Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  // Lazy-load registry the first time the modal is opened.
  const ensureRegistry = useCallback(async () => {
    if (registry || registryLoading) return;
    setRegistryLoading(true);
    const res = await getRolesRegistry();
    if (res.success && res.data) setRegistry(res.data);
    setRegistryLoading(false);
  }, [registry, registryLoading]);

  function openCreate() { setEditing(null); setModalOpen(true); ensureRegistry(); }
  function openEdit(role: Role) { setEditing(role); setModalOpen(true); ensureRegistry(); }

  async function handleDelete(role: Role) {
    if (!confirm(`Supprimer le rôle « ${role.name} » ?${role.users_count > 0 ? `\n${role.users_count} utilisateur(s) y sont rattaché(s).` : ""}`)) return;
    const res = await deleteRole(role.id);
    if (res.success) load();
    else alert(res.message || "Échec de la suppression.");
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderRadius: 12, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <Lock size={16} style={{ color: "#ef4444" }} />
          <p style={{ margin: 0, fontSize: 13, color: t.textSub }}>Accès réservé aux administrateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", minHeight: "100vh", background: t.bg, fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: `${ACCENT}1a`, border: `1px solid ${ACCENT}33` }}>
            <ShieldCheck size={20} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: t.text }}>Rôles &amp; Permissions</h1>
            <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
              Définissez des rôles personnalisés et leurs accès — Admin uniquement
            </p>
          </div>
        </div>
        <button onClick={openCreate} style={{
          display: "flex", alignItems: "center", gap: 7, background: ACCENT, border: "none",
          borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
        }}>
          <Plus size={15} /> Nouveau rôle
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 40, color: t.textMuted, fontSize: 13 }}>
          <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} /> Chargement…
        </div>
      ) : roles.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 0", border: `1px dashed ${t.border}`, borderRadius: 14 }}>
          <ShieldCheck size={30} color={t.textFaint} style={{ display: "block", margin: "0 auto 10px" }} />
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: t.textSub }}>Aucun rôle défini</p>
          <p style={{ margin: 0, fontSize: 12.5, color: t.textMuted }}>Cliquez sur « Nouveau rôle » pour en créer un.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {roles.map((role) => (
            <RoleCard key={role.id} t={t} role={role} onEdit={() => openEdit(role)} onDelete={() => handleDelete(role)} />
          ))}
        </div>
      )}

      {modalOpen && (
        <RoleModal
          t={t}
          editing={editing}
          registry={registry}
          registryLoading={registryLoading}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}
