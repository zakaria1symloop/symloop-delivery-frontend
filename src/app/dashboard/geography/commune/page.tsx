"use client";

import { useEffect, useRef, useState } from "react";
import {
  getWilayas, getCommunes, createCommune, updateCommune, deleteCommune,
  type Wilaya, type Commune, type StopDesk,
} from "@/lib/geography";
import { api } from "@/lib/api";
import {
  Plus, Pencil,
  Trash2, X, Loader2, Search,
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
    subRow:     "#1a1f2e",
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
    subRow:     "#ffffff",
    label:      "#6b7280",
  };
}

type Tokens = ReturnType<typeof useTokens>;

function inpStyle(t: Tokens): React.CSSProperties {
  return {
    width: "100%", background: t.inp.bg, border: `1px solid ${t.inp.border}`,
    borderRadius: 7, padding: "8px 11px", fontSize: 13,
    color: t.inp.text, outline: "none", transition: "border-color 0.15s",
  };
}

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

/* ── commune modal (create + edit) ───────────────────────── */
function CommuneModal({
  t, wilayas, initial, onClose, onSaved,
}: {
  t: Tokens;
  wilayas: Wilaya[];
  initial?: Commune;           // present → edit mode
  onClose: () => void;
  onSaved: (c: Commune) => void;
}) {
  const isEdit = !!initial;
  const [wilayaId, setWilayaId] = useState<string>(
    initial ? initial.wilaya_id.toString() : (wilayas[0]?.id.toString() ?? ""),
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [lat, setLat]   = useState(initial?.lat != null ? String(initial.lat) : "");
  const [lng, setLng]   = useState(initial?.lng != null ? String(initial.lng) : "");
  const [deliverySDId, setDeliverySDId] = useState<string>(initial?.delivery_stop_desk_id ? String(initial.delivery_stop_desk_id) : "");
  const [communeStopDesks, setCommuneStopDesks] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const nameRef             = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Load stop desks for this commune (edit mode)
  useEffect(() => {
    if (!isEdit || !initial) return;
    api<StopDesk[]>(`/communes/${initial.id}/stop-desks`).then(res => {
      if (res.success && res.data) setCommuneStopDesks(res.data.map(sd => ({ id: sd.id, name: sd.name })));
    });
  }, [isEdit, initial]);

  async function handleSave() {
    if (!name.trim()) { setError("Le nom est obligatoire."); return; }
    setSaving(true); setError("");

    const r = isEdit
      ? await updateCommune(initial!.id, {
          name: name.trim(),
          is_active: initial!.is_active,
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
          delivery_stop_desk_id: deliverySDId ? parseInt(deliverySDId) : null,
        })
      : await createCommune({
          name: name.trim(),
          wilaya_id: parseInt(wilayaId),
          lat: lat ? parseFloat(lat) : null,
          lng: lng ? parseFloat(lng) : null,
        });

    if (r.success && r.data) { onSaved(r.data); onClose(); }
    else setError(isEdit ? "Échec de la modification." : "Échec de la création.");
    setSaving(false);
  }

  const field = inpStyle(t);
  const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 500, color: t.label, marginBottom: 5 };

  /* find the wilaya name for display in edit mode */
  const wilayaName = isEdit
    ? (initial!.wilaya?.name ?? wilayas.find(w => w.id === initial!.wilaya_id)?.name ?? "—")
    : null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50, background: t.overlay,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.modalBg, border: `1px solid ${t.border}`,
        borderRadius: 12, width: "100%", maxWidth: 440,
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        fontFamily: "var(--font-jakarta, sans-serif)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${t.border}`,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: t.text }}>
              {isEdit ? "Modifier la Commune" : "Nouvelle Commune"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>
              Remplissez les informations ci-dessous
            </p>
          </div>
          <IconBtn onClick={onClose} title="Fermer"><X size={16} color={t.textMuted} /></IconBtn>
        </div>

        {/* Body */}
        <div style={{ padding: "20px" }}>
          {/* Wilaya — selector for create, read-only badge for edit */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Wilaya {!isEdit && <span style={{ color: "#ef4444" }}>*</span>}</label>
            {isEdit ? (
              <div style={{
                padding: "8px 11px", borderRadius: 7, fontSize: 13,
                background: t.inp.bg, border: `1px solid ${t.inp.border}`,
                color: t.textMuted,
              }}>
                {wilayaName}
              </div>
            ) : (
              <select value={wilayaId} onChange={e => setWilayaId(e.target.value)}
                style={{ ...field, appearance: "auto", background: t.inp.bg, color: t.inp.text }}>
                {wilayas.map(w => (
                  <option key={w.id} value={w.id}>{w.name}{w.code ? ` (${w.code})` : ""}</option>
                ))}
              </select>
            )}
          </div>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Nom <span style={{ color: "#ef4444" }}>*</span></label>
            <input ref={nameRef} style={field} value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex. Hussein Dey"
              onKeyDown={e => e.key === "Enter" && handleSave()}
              onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
              onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
            />
          </div>

          {/* Lat / Lng */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
            <div>
              <label style={lbl}>Latitude</label>
              <input style={field} value={lat} onChange={e => setLat(e.target.value)}
                placeholder="ex. 36.7538" type="number" step="any"
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
              />
            </div>
            <div>
              <label style={lbl}>Longitude</label>
              <input style={field} value={lng} onChange={e => setLng(e.target.value)}
                placeholder="ex. 3.0588" type="number" step="any"
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = "#f97316"}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = t.inp.border}
              />
            </div>
          </div>

          {/* Delivery SD assignment (edit only) */}
          {isEdit && communeStopDesks.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <label style={lbl}>SD Livraison (assignation manuelle)</label>
              <select
                value={deliverySDId}
                onChange={e => setDeliverySDId(e.target.value)}
                style={{ ...field, appearance: "auto", background: t.inp.bg, color: t.inp.text }}
              >
                <option value="">Automatique (round-robin)</option>
                {communeStopDesks.map(sd => (
                  <option key={sd.id} value={sd.id}>{sd.name}</option>
                ))}
              </select>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: t.textFaint }}>
                Si vide, les colis seront distribués équitablement entre les SDs de cette commune.
              </p>
            </div>
          )}

          {error && <p style={{ margin: "10px 0 0", fontSize: 12, color: "#ef4444" }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: `1px solid ${t.border}` }}>
          <button onClick={onClose} style={{
            background: "none", border: `1px solid ${t.border}`, borderRadius: 7,
            padding: "8px 16px", fontSize: 13, fontWeight: 500, color: t.textSub, cursor: "pointer",
          }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#f97316", border: "none", borderRadius: 7,
            padding: "8px 18px", fontSize: 13, fontWeight: 600, color: "#fff",
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
          }}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */
export default function CommunePage() {
  const isDark = useIsDark();
  const t      = useTokens(isDark);

  const [wilayas, setWilayas]         = useState<Wilaya[]>([]);
  const [communes, setCommunes]       = useState<Commune[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filterWilaya, setFilter]     = useState<string>("all");
  const [showCreate, setShowCreate]   = useState(false);
  const [editCommune, setEditCommune] = useState<Commune | null>(null);
  const [search, setSearch]           = useState("");
  const [toggling, setToggling]       = useState<Set<number>>(new Set());

  // Load wilayas once
  useEffect(() => {
    getWilayas({ full: true }).then(r => { if (r.success && r.data) setWilayas(r.data); });
  }, []);

  // Load communes whenever wilaya filter or wilayas list changes
  useEffect(() => {
    if (wilayas.length === 0) return;
    const targets = filterWilaya === "all" ? wilayas : wilayas.filter(w => w.id.toString() === filterWilaya);
    setLoading(true);
    Promise.all(targets.map(w => getCommunes(w.id))).then(results => {
      const all: Commune[] = [];
      results.forEach((r, i) => {
        if (r.success && r.data) {
          r.data.forEach(c => all.push({ ...c, wilaya: { id: targets[i].id, name: targets[i].name, code: targets[i].code } }));
        }
      });
      all.sort((a, b) => a.name.localeCompare(b.name));
      setCommunes(all);
      setLoading(false);
    });
  }, [wilayas, filterWilaya]);

  async function handleDelete(id: number) {
    if (!confirm("Supprimer cette commune et tous ses stop desks ?")) return;
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

  const q = search.trim().toLowerCase();
  const filteredCommunes = q
    ? communes.filter(c => c.name.toLowerCase().includes(q))
    : communes;

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
        <CommuneModal
          t={t} wilayas={wilayas}
          onClose={() => setShowCreate(false)}
          onSaved={c => {
            const w = wilayas.find(w => w.id === c.wilaya_id);
            const enriched = { ...c, wilaya: w ? { id: w.id, name: w.name, code: w.code } : undefined };
            if (filterWilaya === "all" || c.wilaya_id.toString() === filterWilaya) {
              setCommunes(p => [...p, enriched].sort((a, b) => a.name.localeCompare(b.name)));
            }
          }}
        />
      )}

      {/* Edit modal */}
      {editCommune && (
        <CommuneModal
          t={t} wilayas={wilayas} initial={editCommune}
          onClose={() => setEditCommune(null)}
          onSaved={updated => {
            setCommunes(p => p.map(c => c.id === updated.id
              ? { ...updated, wilaya: c.wilaya }
              : c,
            ));
            setEditCommune(null);
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: t.text }}>Communes</h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: t.textMuted }}>
            {search.trim()
              ? <>{filteredCommunes.length} résultat{filteredCommunes.length !== 1 ? "s" : ""} <span style={{ color: t.textFaint }}>/ {communes.length} au total</span></>
              : <>{communes.length} commune{communes.length !== 1 ? "s" : ""}</>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select
            value={filterWilaya}
            onChange={e => setFilter(e.target.value)}
            style={{
              background: t.inp.bg, border: `1px solid ${t.inp.border}`,
              borderRadius: 7, padding: "7px 11px", fontSize: 13,
              color: t.inp.text, outline: "none", cursor: "pointer",
            }}
          >
            <option value="all">Toutes les wilayas</option>
            {wilayas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#f97316", border: "none",
              borderRadius: 7, padding: "8px 14px",
              fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
            }}
          >
            <Plus size={14} /> Nouvelle Commune
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 14, maxWidth: 360 }}>
        <Search size={14} color={t.textMuted} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom…"
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
              <th style={th}>Nom</th>
              <th style={th}>Wilaya</th>
              <th style={th}>SD Livraison</th>
              <th style={th}>Latitude</th>
              <th style={th}>Longitude</th>
              <th style={{ ...th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>

            {loading && (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", padding: 32, color: t.textMuted }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Loader2 size={14} className="animate-spin" /> Chargement…
                </div>
              </td></tr>
            )}

            {!loading && filteredCommunes.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", padding: 40, color: t.textFaint }}>
                {search.trim()
                  ? "Aucune commune ne correspond à votre recherche."
                  : "Aucune commune. Cliquez sur « Nouvelle Commune » pour en ajouter une."}
              </td></tr>
            )}

            {!loading && filteredCommunes.map(c => (
              <tr
                key={c.id}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = t.rowHover}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                style={{ transition: "background 0.1s" }}
              >
                  {/* Name */}
                  <td style={td}>
                    <span style={{ fontWeight: 500, color: t.text }}>{c.name}</span>
                  </td>

                  {/* Wilaya */}
                  <td style={{ ...td, color: t.textMuted, fontSize: 12 }}>
                    {c.wilaya?.name ?? "—"}
                    {c.wilaya?.code && (
                      <span style={{ marginLeft: 6, fontFamily: "monospace", fontSize: 11, color: t.textFaint }}>
                        {c.wilaya.code}
                      </span>
                    )}
                  </td>

                  {/* SD Livraison */}
                  <td style={{ ...td, fontSize: 12 }}>
                    {c.delivery_stop_desk ? (
                      <span style={{
                        padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                        background: "rgba(249,115,22,0.1)", color: "#ea580c",
                      }}>
                        {c.delivery_stop_desk.name}
                      </span>
                    ) : (
                      <span style={{ color: t.textFaint, fontSize: 11 }}>Auto</span>
                    )}
                  </td>

                  {/* Lat */}
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12, color: t.textMuted }}>
                    {c.lat != null ? c.lat : "—"}
                  </td>

                  {/* Lng */}
                  <td style={{ ...td, fontFamily: "monospace", fontSize: 12, color: t.textMuted }}>
                    {c.lng != null ? c.lng : "—"}
                  </td>

                  {/* Actions */}
                  <td style={{ ...td, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                      <StatusToggle
                        active={c.is_active}
                        loading={toggling.has(c.id)}
                        onClick={() => handleToggleActive(c)}
                        t={t} isDark={isDark}
                      />
                      <div style={{ display: "flex", gap: 2 }}>
                        <IconBtn onClick={() => setEditCommune(c)} title="Modifier">
                          <Pencil size={13} color={t.textMuted} />
                        </IconBtn>
                        <IconBtn onClick={() => handleDelete(c.id)} title="Supprimer" danger>
                          <Trash2 size={13} />
                        </IconBtn>
                      </div>
                    </div>
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
