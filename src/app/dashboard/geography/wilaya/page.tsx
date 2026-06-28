"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  getWilayas, createWilaya, updateWilaya, deleteWilaya,
  getCommunes, createCommune, updateCommune, deleteCommune,
  type Wilaya, type Commune,
} from "@/lib/geography";
import {
  ChevronDown, ChevronRight, Plus, Pencil,
  Trash2, Check, X, Loader2, Search,
} from "lucide-react";

/* ── theme ───────────────────────────────────────────────── */
function useIsDark() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );
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
    card:       "#111827",
    border:     "#1e2130",
    divider:    "#1e2130",
    rowHover:   "#1a1f2e",
    text:       "#f0f0f5",
    textSub:    "#d1d5db",
    textMuted:  "#6b7280",
    textFaint:  "#4b5563",
    shadow:     "none",
    modalBg:    "#111827",
    overlay:    "rgba(0,0,0,0.6)",
    inp:        { bg: "#1e2130", border: "#2a3145", text: "#f0f0f5" },
    subPanel:   "#0f1623",
    communeRow: "#1a1f2e",
    label:      "#6b7280",
  } : {
    card:       "#ffffff",
    border:     "#e5e7eb",
    divider:    "#f3f4f6",
    rowHover:   "#f9fafb",
    text:       "#111827",
    textSub:    "#374151",
    textMuted:  "#6b7280",
    textFaint:  "#9ca3af",
    shadow:     "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
    modalBg:    "#ffffff",
    overlay:    "rgba(0,0,0,0.35)",
    inp:        { bg: "#ffffff", border: "#d1d5db", text: "#111827" },
    subPanel:   "#f9fafb",
    communeRow: "#ffffff",
    label:      "#6b7280",
  };
}

type Tokens = ReturnType<typeof useTokens>;

function inpStyle(t: Tokens): React.CSSProperties {
  return {
    width: "100%", background: t.inp.bg, border: `1px solid ${t.inp.border}`,
    borderRadius: 7, padding: "8px 11px", fontSize: 13,
    color: t.inp.text, outline: "none",
    transition: "border-color 0.15s",
  };
}

/* ── icon button ─────────────────────────────────────────── */
function IconBtn({ onClick, title, danger, disabled, children }: {
  onClick: () => void; title?: string;
  danger?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} title={title} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (danger ? "rgba(239,68,68,0.08)" : "rgba(0,0,0,0.06)") : "transparent",
        border: "none", borderRadius: 5, padding: "5px 6px",
        cursor: disabled ? "not-allowed" : "pointer",
        color: danger ? "#ef4444" : "inherit",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: disabled ? 0.4 : 1, transition: "background 0.1s",
      }}
    >{children}</button>
  );
}

/* ── status toggle badge ─────────────────────────────────── */
function StatusToggle({ active, loading, onClick, t, isDark }: {
  active: boolean; loading: boolean; onClick: () => void; t: Tokens; isDark: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={active ? "Désactiver" : "Activer"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 9px", borderRadius: 20,
        fontSize: 11, fontWeight: 700, letterSpacing: "0.02em",
        background: active ? "rgba(16,185,129,0.1)" : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"),
        color: active ? "#10b981" : t.textMuted,
        border: `1px solid ${active ? "rgba(16,185,129,0.22)" : t.border}`,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.55 : 1,
        transition: "all 0.15s", whiteSpace: "nowrap",
      }}
    >
      {loading
        ? <Loader2 size={10} className="animate-spin" />
        : <span style={{ fontSize: 7, lineHeight: 1 }}>{active ? "●" : "○"}</span>}
      {active ? "Actif" : "Inactif"}
    </button>
  );
}

/* ── modal (create + edit) ───────────────────────────────── */
interface ModalFields { name: string; code: string; lat: string; lng: string; }

function WilayaModal({
  t, isDark, initial, onClose, onSaved,
}: {
  t: Tokens; isDark: boolean;
  initial?: Wilaya;          // present → edit mode
  onClose: () => void;
  onSaved: (w: Wilaya) => void;
}) {
  const isEdit = !!initial;
  const [fields, setFields] = useState<ModalFields>({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    lat:  initial?.lat != null ? String(initial.lat) : "",
    lng:  initial?.lng != null ? String(initial.lng) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const nameRef             = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (k: keyof ModalFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(p => ({ ...p, [k]: e.target.value }));

  async function handleSave() {
    if (!fields.name.trim()) { setError("Le nom est obligatoire."); return; }
    setSaving(true); setError("");

    const r = isEdit
      ? await updateWilaya(initial!.id, {
          name: fields.name.trim(),
          code: fields.code.trim() || undefined,
          lat:  fields.lat ? parseFloat(fields.lat) : null,
          lng:  fields.lng ? parseFloat(fields.lng) : null,
          is_active: initial!.is_active,
        })
      : await createWilaya({
          name: fields.name.trim(),
          code: fields.code.trim() || undefined,
          lat:  fields.lat ? parseFloat(fields.lat) : null,
          lng:  fields.lng ? parseFloat(fields.lng) : null,
        });

    if (r.success && r.data) { onSaved(r.data); onClose(); }
    else setError(isEdit ? "Échec de la modification." : "Échec de la création de la wilaya.");
    setSaving(false);
  }

  const field = inpStyle(t);
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 500,
    color: t.label, marginBottom: 5,
  };

  return (
    /* overlay */
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: t.overlay,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      {/* panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.modalBg, border: `1px solid ${t.border}`,
          borderRadius: 12, width: "100%", maxWidth: 440,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          fontFamily: "var(--font-jakarta, sans-serif)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${t.border}`,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>
              {isEdit ? "Modifier la Wilaya" : "Nouvelle Wilaya"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>
              Remplissez les informations ci-dessous
            </p>
          </div>
          <IconBtn onClick={onClose} title="Fermer">
            <X size={16} color={t.textMuted} />
          </IconBtn>
        </div>

        {/* Body */}
        <div style={{ padding: "20px" }}>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Nom <span style={{ color: "#ef4444" }}>*</span></label>
            <input
              ref={nameRef}
              style={field}
              value={fields.name}
              onChange={set("name")}
              placeholder="ex. Alger"
              onKeyDown={e => e.key === "Enter" && handleSave()}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
              onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
            />
          </div>

          {/* Code */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Code</label>
            <input
              style={field}
              value={fields.code}
              onChange={set("code")}
              placeholder="ex. 16"
              maxLength={10}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
              onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
            />
          </div>

          {/* Lat / Lng side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
            <div>
              <label style={labelStyle}>Latitude</label>
              <input
                style={field}
                value={fields.lat}
                onChange={set("lat")}
                placeholder="e.g. 36.7538"
                type="number" step="any"
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
              />
            </div>
            <div>
              <label style={labelStyle}>Longitude</label>
              <input
                style={field}
                value={fields.lng}
                onChange={set("lng")}
                placeholder="e.g. 3.0588"
                type="number" step="any"
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#ef4444" }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "14px 20px", borderTop: `1px solid ${t.border}`,
        }}>
          <button
            onClick={onClose}
            style={{
              background: "none", border: `1px solid ${t.border}`,
              borderRadius: 7, padding: "8px 16px",
              fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer",
            }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#f97316", border: "none",
              borderRadius: 7, padding: "8px 18px",
              fontSize: 13, fontWeight: 600, color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── commune list ────────────────────────────────────────── */
function CommuneList({ wilaya, t, isDark }: { wilaya: Wilaya; t: Tokens; isDark: boolean }) {
  const field = inpStyle(t);
  const [communes, setCommunes]   = useState<Commune[]>([]);
  const [loading, setLoading]     = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [editId, setEditId]       = useState<number | null>(null);
  const [newName, setNewName]     = useState("");
  const [editName, setEditName]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [toggling, setToggling]   = useState<Set<number>>(new Set());

  useEffect(() => {
    getCommunes(wilaya.id).then(r => {
      if (r.success && r.data) setCommunes(r.data);
      setLoading(false);
    });
  }, [wilaya.id]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    const r = await createCommune({ name: newName.trim(), wilaya_id: wilaya.id });
    if (r.success && r.data) { setCommunes(p => [...p, r.data!]); setAddingNew(false); setNewName(""); }
    setSaving(false);
  }

  async function handleUpdate(id: number) {
    if (!editName.trim()) return;
    setSaving(true);
    const c = communes.find(c => c.id === id)!;
    const r = await updateCommune(id, { name: editName.trim(), is_active: c.is_active, lat: c.lat, lng: c.lng });
    if (r.success && r.data) { setCommunes(p => p.map(c => c.id === id ? r.data! : c)); setEditId(null); }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Supprimer cette commune ?")) return;
    const r = await deleteCommune(id);
    if (r.success) setCommunes(p => p.filter(c => c.id !== id));
  }

  async function handleToggleActive(c: Commune) {
    setToggling(p => new Set(p).add(c.id));
    setCommunes(p => p.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
    const r = await updateCommune(c.id, {
      name: c.name, is_active: !c.is_active,
      lat: c.lat, lng: c.lng,
      delivery_stop_desk_id: c.delivery_stop_desk_id,
    });
    if (!r.success) setCommunes(p => p.map(x => x.id === c.id ? { ...x, is_active: c.is_active } : x));
    setToggling(p => { const n = new Set(p); n.delete(c.id); return n; });
  }

  return (
    <div style={{ background: t.subPanel, borderTop: `1px solid ${t.divider}`, padding: "14px 16px 14px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Communes · {communes.length}
        </span>
        {!addingNew && (
          <button
            onClick={() => setAddingNew(true)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "none", border: `1px solid ${t.border}`,
              borderRadius: 6, padding: "4px 10px",
              fontSize: 12, fontWeight: 500, color: t.textSub, cursor: "pointer",
            }}
          >
            <Plus size={12} /> Ajouter
          </button>
        )}
      </div>

      {loading && <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>Chargement…</p>}

      {addingNew && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
          <input
            autoFocus style={{ ...field }}
            value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Nom de la commune"
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setAddingNew(false); setNewName(""); } }}
          />
          <IconBtn onClick={handleCreate} title="Enregistrer" disabled={saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} color="#10b981" />}
          </IconBtn>
          <IconBtn onClick={() => { setAddingNew(false); setNewName(""); }} title="Annuler">
            <X size={13} color={t.textMuted} />
          </IconBtn>
        </div>
      )}

      {communes.length === 0 && !loading && !addingNew && (
        <p style={{ margin: 0, fontSize: 12, color: t.textFaint }}>Aucune commune.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {communes.map(c => (
          <div
            key={c.id}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 10px", borderRadius: 6,
              background: t.communeRow, border: `1px solid ${t.divider}`,
            }}
          >
            {editId === c.id ? (
              <>
                <input
                  autoFocus style={{ ...field, flex: 1 }}
                  value={editName} onChange={e => setEditName(e.target.value)}
                  placeholder="Nom de la commune"
                  onKeyDown={e => { if (e.key === "Enter") handleUpdate(c.id); if (e.key === "Escape") setEditId(null); }}
                />
                <IconBtn onClick={() => handleUpdate(c.id)} title="Enregistrer" disabled={saving}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} color="#10b981" />}
                </IconBtn>
                <IconBtn onClick={() => setEditId(null)} title="Annuler">
                  <X size={13} color={t.textMuted} />
                </IconBtn>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 13, color: t.textSub }}>{c.name}</span>
                <StatusToggle
                  active={c.is_active}
                  loading={toggling.has(c.id)}
                  onClick={() => handleToggleActive(c)}
                  t={t} isDark={isDark}
                />
                <IconBtn onClick={() => { setEditId(c.id); setEditName(c.name); }} title="Modifier">
                  <Pencil size={12} color={t.textMuted} />
                </IconBtn>
                <IconBtn onClick={() => handleDelete(c.id)} title="Supprimer" danger>
                  <Trash2 size={12} />
                </IconBtn>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */
export default function WilayaPage() {
  const isDark = useIsDark();
  const t      = useTokens(isDark);

  const [wilayas, setWilayas]         = useState<Wilaya[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<number | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [editWilaya, setEditWilaya]   = useState<Wilaya | null>(null);
  const [search, setSearch]           = useState("");
  const [toggling, setToggling]       = useState<Set<number>>(new Set());

  useEffect(() => {
    getWilayas({ full: true }).then(r => {
      if (r.success && r.data) setWilayas(r.data);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("Supprimer cette wilaya et toutes ses communes ?")) return;
    const r = await deleteWilaya(id);
    if (r.success) setWilayas(p => p.filter(w => w.id !== id));
  }

  async function handleToggleActive(w: Wilaya) {
    setToggling(p => new Set(p).add(w.id));
    setWilayas(p => p.map(x => x.id === w.id ? { ...x, is_active: !x.is_active } : x));
    const r = await updateWilaya(w.id, {
      name: w.name, code: w.code ?? undefined,
      lat: w.lat, lng: w.lng, is_active: !w.is_active,
    });
    if (!r.success) setWilayas(p => p.map(x => x.id === w.id ? { ...x, is_active: w.is_active } : x));
    setToggling(p => { const n = new Set(p); n.delete(w.id); return n; });
  }

  const q = search.trim().toLowerCase();
  const filteredWilayas = q
    ? wilayas.filter(w => w.name.toLowerCase().includes(q) || (w.code ?? "").toLowerCase().includes(q))
    : wilayas;

  const th: React.CSSProperties = {
    padding: "10px 14px", fontSize: 11, fontWeight: 600,
    color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.07em",
    borderBottom: `1px solid ${t.border}`, textAlign: "left", background: t.card,
  };
  const td: React.CSSProperties = {
    padding: "11px 14px", fontSize: 13,
    borderBottom: `1px solid ${t.divider}`,
    verticalAlign: "middle", color: t.textSub,
  };

  return (
    <div style={{ width: "100%", fontFamily: "var(--font-jakarta, sans-serif)" }}>

      {/* Create modal */}
      {showCreate && (
        <WilayaModal
          t={t} isDark={isDark}
          onClose={() => setShowCreate(false)}
          onSaved={w => setWilayas(p => [...p, { ...w, communes_count: 0 }])}
        />
      )}

      {/* Edit modal */}
      {editWilaya && (
        <WilayaModal
          t={t} isDark={isDark} initial={editWilaya}
          onClose={() => setEditWilaya(null)}
          onSaved={updated => {
            setWilayas(p => p.map(w => w.id === updated.id
              ? { ...updated, communes_count: w.communes_count }
              : w,
            ));
            setEditWilaya(null);
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text }}>Wilayas</h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: t.textMuted }}>
            {search.trim()
              ? <>{filteredWilayas.length} résultat{filteredWilayas.length !== 1 ? "s" : ""} <span style={{ color: t.textFaint }}>/ {wilayas.length} au total</span></>
              : <>{wilayas.length} wilaya{wilayas.length !== 1 ? "s" : ""}</>}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#f97316", border: "none",
            borderRadius: 7, padding: "8px 14px",
            fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
          }}
        >
          <Plus size={14} /> Nouvelle Wilaya
        </button>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 14, maxWidth: 360 }}>
        <Search size={14} color={t.textMuted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou code…"
          style={{ ...inpStyle(t), paddingLeft: 32 }}
          onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
          onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
        />
      </div>

      {/* Table */}
      <div style={{
        background: t.card, border: `1px solid ${t.border}`,
        borderRadius: 10, boxShadow: t.shadow, overflow: "hidden",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 36 }} />
              <th style={th}>Nom</th>
              <th style={th}>Code</th>
              <th style={th}>Latitude</th>
              <th style={th}>Longitude</th>
              <th style={{ ...th, textAlign: "center" }}>Communes</th>
              <th style={{ ...th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>

            {loading && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", padding: 32, color: t.textMuted }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </div>
              </td></tr>
            )}

            {!loading && filteredWilayas.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", padding: 40, color: t.textFaint }}>
                {search.trim()
                  ? "Aucune wilaya ne correspond à votre recherche."
                  : "Aucune wilaya. Cliquez sur « Nouvelle Wilaya » pour en ajouter une."}
              </td></tr>
            )}

            {!loading && filteredWilayas.map(w => (
              <Fragment key={w.id}>
                <tr
                  style={{ background: expanded === w.id ? (isDark ? "#1a1f2e" : "#fafafa") : "transparent", transition: "background 0.1s" }}
                  onMouseEnter={e => { if (expanded !== w.id) (e.currentTarget as HTMLElement).style.background = t.rowHover; }}
                  onMouseLeave={e => { if (expanded !== w.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {/* Expand toggle */}
                  <td
                    style={{ ...td, cursor: "pointer", color: t.textMuted, width: 36, paddingRight: 0 }}
                    onClick={() => setExpanded(p => p === w.id ? null : w.id)}
                  >
                    {expanded === w.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>

                  <td style={td}>
                    <span style={{ fontWeight: 500, color: t.text }}>{w.name}</span>
                  </td>

                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12, color: t.textMuted }}>
                    {w.code ?? "—"}
                  </td>

                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12, color: t.textMuted }}>
                    {w.lat != null ? w.lat : "—"}
                  </td>

                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12, color: t.textMuted }}>
                    {w.lng != null ? w.lng : "—"}
                  </td>

                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{
                      display: "inline-block",
                      background: isDark ? "#333" : "#f3f4f6",
                      color: t.textSub, borderRadius: 4,
                      padding: "1px 8px", fontSize: 12, fontWeight: 500,
                    }}>
                      {w.communes_count ?? 0}
                    </span>
                  </td>

                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                      <StatusToggle
                        active={w.is_active}
                        loading={toggling.has(w.id)}
                        onClick={() => handleToggleActive(w)}
                        t={t} isDark={isDark}
                      />
                      <div style={{ display: "flex", gap: 2 }}>
                        <IconBtn onClick={() => setEditWilaya(w)} title="Modifier">
                          <Pencil size={13} color={t.textMuted} />
                        </IconBtn>
                        <IconBtn onClick={() => handleDelete(w.id)} title="Supprimer" danger>
                          <Trash2 size={13} />
                        </IconBtn>
                      </div>
                    </div>
                  </td>
                </tr>

                {expanded === w.id && (
                  <tr>
                    <td colSpan={7} style={{ padding: 0 }}>
                      <CommuneList wilaya={w} t={t} isDark={isDark} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
