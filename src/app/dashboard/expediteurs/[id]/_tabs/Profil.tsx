"use client";

import { useEffect, useState, type ElementType } from "react";
import Link from "next/link";
import {
  Building2, Mail, Phone, UserRound, BadgeCheck, CalendarDays,
  MapPin, Warehouse, ShieldCheck, ShieldOff, KeyRound,
  FileText, ExternalLink, Pencil, Loader2, AlertCircle, Inbox, Hash,
} from "lucide-react";
import { ORANGE, type Tokens } from "../../../_ui";
import { API_BASE_URL, getStoredUser } from "@/lib/api";
import { getUser, updateUser, type StaffUser } from "@/lib/users";
import type { ExpTabProps } from "./types";

/* ─────────────────────────────────────────────────────────────────────────────
 * "Profil & Documents" tab — the merchant identity sheet for the ERP fiche.
 *
 * Self-contained: re-fetches the full user via getUser(userId) so it stays fresh
 * after edits (incl. the inline Accès API toggle below). The Accès API toggle
 * resends the FULL profile + api_enabled via updateUser — never a partial — so
 * the backend can't null company / document fields that aren't in the payload
 * (same contract as the shell page.tsx::toggleApi).
 * ─────────────────────────────────────────────────────────────────────────── */

// API_BASE_URL ends with the API prefix (/api or /api/v1); strip it to the bare
// backend origin so uploaded documents resolve at /storage/<path> (Laravel
// parity — mirrors src/lib/reclamations.ts::attachmentUrl).
const API_ORIGIN = API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/, "");
const fileUrl = (p: string): string => `${API_ORIGIN}/storage/${p}`;

// Account lifecycle status → badge palette. (Package STATUS_LABELS/COLORS from
// src/lib/packages.ts are colis-lifecycle states and don't apply to a merchant
// account, so this tab uses the account-status palette shared with the shell.)
const ACCOUNT_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  active:    { label: "Actif",    bg: "rgba(34,197,94,0.12)",   text: "#16a34a" },
  inactive:  { label: "Inactif",  bg: "rgba(107,114,128,0.14)", text: "#6b7280" },
  suspended: { label: "Suspendu", bg: "rgba(239,68,68,0.12)",   text: "#dc2626" },
};

function formatDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-DZ", { day: "2-digit", month: "long", year: "numeric" });
}

export default function Profil({ userId, user, t }: ExpTabProps) {
  // Seed the local copy from the prop so there's no flash, but always re-fetch
  // to pick up document uploads / edits made elsewhere.
  const [data, setData] = useState<StaffUser | null>(user ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toggling, setToggling] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const isAdmin = getStoredUser()?.user_type === "admin";

  /* ── Load (keyed on userId, alive-guarded) ── */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getUser(userId).then((res) => {
      if (!alive) return;
      if (res.success && res.data) setData(res.data);
      else setError(res.message || "Impossible de charger le profil de cet expéditeur.");
      setLoading(false);
    });
    return () => { alive = false; };
  }, [userId]);

  /* ── Accès API toggle (admin only) — resend the FULL profile + api_enabled ── */
  async function toggleApi() {
    if (!isAdmin || !data || toggling) return;
    const next = !(data.api_enabled ?? true);
    setToggling(true);
    setApiError(null);
    const res = await updateUser(data.id, {
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      user_type: data.user_type,
      status: data.status,
      api_enabled: next,
      wilaya_id: data.wilaya_id,
      stop_desk_id: data.stop_desk_id,
      company_name: data.company_name ?? null,
      registre_commerce: data.registre_commerce ?? null,
      nif: data.nif ?? null,
      nis: data.nis ?? null,
    });
    setToggling(false);
    if (res.success) setData((prev) => (prev ? { ...prev, api_enabled: next } : prev));
    else setApiError(res.message || "Échec de la mise à jour de l'accès API.");
  }

  /* ── States ── */
  if (loading && !data) {
    return (
      <Shell t={t}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 56, color: t.textMuted, fontSize: 14 }}>
          <Loader2 size={17} style={{ animation: "spin 0.8s linear infinite" }} /> Chargement du profil…
        </div>
      </Shell>
    );
  }
  if (error && !data) {
    return (
      <Shell t={t}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 20px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#dc2626", fontSize: 13.5, fontWeight: 600 }}>
          <AlertCircle size={17} /> {error}
        </div>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell t={t}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 56, color: t.textFaint, fontSize: 14 }}>
          <Inbox size={17} /> Aucune donnée de profil.
        </div>
      </Shell>
    );
  }

  const u = data;
  const st = ACCOUNT_STATUS[u.status] ?? { label: u.status, bg: "rgba(107,114,128,0.14)", text: "#6b7280" };
  const apiEnabled = u.api_enabled ?? true;
  const docCount = [u.rc_file, u.nif_file, u.nis_file].filter(Boolean).length;

  const editBtn = (
    <Link href="/dashboard/users?tab=expediteur" style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9,
      border: `1px solid ${ORANGE}`, background: ORANGE + "12", color: ORANGE,
      fontSize: 12.5, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap",
    }}>
      <Pencil size={13} /> Modifier
    </Link>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Row 1: Identité (left) + Localisation & Accès API (right) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>

        {/* Identité */}
        <SectionCard t={t} icon={UserRound} title="Identité" action={editBtn}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <Field t={t} icon={UserRound} label="Nom complet" value={`${u.first_name} ${u.last_name}`} />
            <Field t={t} icon={Building2} label="Société" value={u.company_name || <Muted t={t}>Non renseignée</Muted>} />
            <Field t={t} icon={Mail} label="Email" value={u.email} />
            <Field t={t} icon={Phone} label="Téléphone" value={u.phone || <Muted t={t}>—</Muted>} />
            <Field t={t} icon={BadgeCheck} label="Statut du compte" value={
              <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11.5, fontWeight: 700, padding: "3px 11px", borderRadius: 999, background: st.bg, color: st.text }}>{st.label}</span>
            } />
            <Field t={t} icon={CalendarDays} label="Date de création" value={formatDate(u.created_at)} />
          </div>
        </SectionCard>

        {/* Right column: Localisation + Accès API stacked */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard t={t} icon={MapPin} title="Localisation">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
              <Field t={t} icon={MapPin} label="Wilaya" value={u.wilaya?.name || <Muted t={t}>Non renseignée</Muted>} />
              <Field t={t} icon={Warehouse} label="Stop desk" value={u.stop_desk?.name || <Muted t={t}>Aucun</Muted>} />
            </div>
          </SectionCard>

          <SectionCard t={t} icon={KeyRound} title="Accès API">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11, minWidth: 0 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: apiEnabled ? "rgba(34,197,94,0.12)" : "rgba(107,114,128,0.14)",
                  color: apiEnabled ? "#16a34a" : "#6b7280",
                }}>
                  {apiEnabled ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>
                    Accès programmatique {apiEnabled ? "activé" : "désactivé"}
                  </div>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: t.textMuted, lineHeight: 1.5, maxWidth: 280 }}>
                    {apiEnabled
                      ? "Cet expéditeur peut générer des clés et créer des colis via l'API."
                      : "L'accès aux endpoints API est bloqué pour cet expéditeur."}
                  </p>
                </div>
              </div>

              {isAdmin ? (
                <button
                  onClick={toggleApi}
                  disabled={toggling}
                  role="switch"
                  aria-checked={apiEnabled}
                  aria-label="Basculer l'accès API"
                  title="Activer / désactiver l'accès API"
                  style={{
                    position: "relative", width: 52, height: 30, borderRadius: 999, border: "none", padding: 0, flexShrink: 0,
                    cursor: toggling ? "default" : "pointer", opacity: toggling ? 0.7 : 1,
                    background: apiEnabled ? ORANGE : t.inp.border, transition: "background 160ms",
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: apiEnabled ? 25 : 3, width: 24, height: 24, borderRadius: "50%",
                    background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 160ms",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {toggling && <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} color={ORANGE} />}
                  </span>
                </button>
              ) : (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, flexShrink: 0,
                  background: apiEnabled ? "rgba(34,197,94,0.1)" : "rgba(107,114,128,0.14)",
                  color: apiEnabled ? "#16a34a" : "#6b7280",
                }}>
                  <KeyRound size={13} /> {apiEnabled ? "Activée" : "Désactivée"}
                </span>
              )}
            </div>
            {apiError && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: 12, fontWeight: 600, color: "#dc2626" }}>
                <AlertCircle size={13} /> {apiError}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Documents légaux (full width) ── */}
      <SectionCard
        t={t}
        icon={FileText}
        title="Documents légaux"
        subtitle="Pièces justificatives de l'entreprise expéditrice"
        action={
          <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, background: t.sectionBg, border: `1px solid ${t.border}`, color: t.textMuted }}>
            {docCount}/3 fichier{docCount > 1 ? "s" : ""}
          </span>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <DocRow t={t} label="Registre de Commerce" value={u.registre_commerce} file={u.rc_file} />
          <DocRow t={t} label="NIF" value={u.nif} file={u.nif_file} />
          <DocRow t={t} label="NIS" value={u.nis} file={u.nis_file} />
        </div>
      </SectionCard>
    </div>
  );
}

/* ── Card shell used by every section + the loading/error states ── */
function Shell({ t, children }: { t: Tokens; children: React.ReactNode }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, boxShadow: t.shadow, padding: 20 }}>
      {children}
    </div>
  );
}

function SectionCard({ t, icon: Icon, title, subtitle, action, children }: {
  t: Tokens; icon: ElementType; title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Shell t={t}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: ORANGE + "14", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={18} color={ORANGE} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 750, color: t.text, letterSpacing: -0.3 }}>{title}</h2>
            {subtitle && <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textMuted }}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Shell>
  );
}

function Field({ t, icon: Icon, label, value }: {
  t: Tokens; icon: ElementType; label: string; value: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: t.sectionBg, border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} color={t.textMuted} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginTop: 3, wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}

function DocRow({ t, label, value, file }: {
  t: Tokens; label: string; value?: string | null; file?: string | null;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "12px 14px", borderRadius: 12, background: t.sectionBg, border: `1px solid ${t.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: ORANGE + "14" }}>
          <Hash size={15} color={ORANGE} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
          <div style={{
            fontSize: 13.5, fontWeight: 700, marginTop: 2, color: value ? t.text : t.textFaint,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {value || "Non renseigné"}
          </div>
        </div>
      </div>
      {file ? (
        <a
          href={fileUrl(file)} target="_blank" rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, flexShrink: 0,
            border: `1px solid ${t.border}`, background: t.card, color: ORANGE, fontSize: 12, fontWeight: 700, textDecoration: "none",
          }}
        >
          <ExternalLink size={12} /> Voir
        </a>
      ) : (
        <span style={{ fontSize: 11.5, fontWeight: 600, color: t.textFaint, flexShrink: 0 }}>Aucun fichier</span>
      )}
    </div>
  );
}

function Muted({ t, children }: { t: Tokens; children: React.ReactNode }) {
  return <span style={{ color: t.textFaint, fontWeight: 600 }}>{children}</span>;
}
