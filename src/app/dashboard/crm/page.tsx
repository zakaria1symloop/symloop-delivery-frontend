"use client";

import { useState } from "react";
import {
  LayoutDashboard, Zap, Users, Building2, Target, CheckSquare, BarChart3,
  Search, Plus, X, Check, Phone, Mail, Clock, PhoneCall, CalendarDays, StickyNote,
  CheckCircle2, TrendingUp, Banknote, ArrowRight, Globe, MapPin, Trophy, ChevronRight, Flame,
  MessageCircle, MessageSquare, Camera, Send,
} from "lucide-react";
import { useIsDark, useTokens, PageHeader, Badge, formatDA, ORANGE, type Tokens } from "../_ui";
import {
  STAGES, OPEN_STAGES, OWNERS, LEAD_STATUS_COLORS, MONTHLY_REVENUE, TIMELINE,
  LEADS, ACCOUNTS, CONTACTS, DEALS, ACTIVITIES, CHANNELS, CONVERSATIONS,
  type Lead, type Deal, type Activity, type StageKey, type LeadStatus, type ActStatus, type TimelineEvt,
  type Channel, type Convo,
} from "./_data";

type ModuleKey = "home" | "messaging" | "leads" | "contacts" | "accounts" | "deals" | "activities" | "reports";
const MODULES: { key: ModuleKey; label: string; icon: React.ElementType }[] = [
  { key: "home", label: "Accueil", icon: LayoutDashboard },
  { key: "messaging", label: "Messagerie", icon: MessageCircle },
  { key: "leads", label: "Leads", icon: Zap },
  { key: "contacts", label: "Contacts", icon: Users },
  { key: "accounts", label: "Comptes", icon: Building2 },
  { key: "deals", label: "Affaires", icon: Target },
  { key: "activities", label: "Activités", icon: CheckSquare },
  { key: "reports", label: "Rapports", icon: BarChart3 },
];

const CH_ICON: Record<Channel, React.ElementType> = { whatsapp: MessageCircle, facebook: MessageSquare, instagram: Camera };
const CH = (k: Channel) => CHANNELS.find((c) => c.key === k)!;

type Detail = { type: "lead" | "account" | "deal" | "contact"; id: number } | null;

export default function CrmPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);
  const [module, setModule] = useState<ModuleKey>("home");

  const [leads, setLeads] = useState<Lead[]>(LEADS);
  const [deals, setDeals] = useState<Deal[]>(DEALS);
  const [activities, setActivities] = useState<Activity[]>(ACTIVITIES);
  const [notes, setNotes] = useState<Record<string, { text: string; when: string }[]>>({});
  const [detail, setDetail] = useState<Detail>(null);

  const stageOf = (k: StageKey) => STAGES.find((s) => s.key === k)!;
  const openDeals = deals.filter((d) => OPEN_STAGES.includes(d.stage));
  const pipeline = openDeals.reduce((s, d) => s + d.amount, 0);
  const weighted = openDeals.reduce((s, d) => s + d.amount * (stageOf(d.stage).prob / 100), 0);
  const wonAmount = deals.filter((d) => d.stage === "won").reduce((s, d) => s + d.amount, 0);
  const winRate = (() => {
    const closed = deals.filter((d) => d.stage === "won" || d.stage === "lost").length;
    return closed ? Math.round((deals.filter((d) => d.stage === "won").length / closed) * 100) : 0;
  })();
  const openTasks = activities.filter((a) => a.status === "Ouverte").length;

  function moveDeal(id: number, stage: StageKey) {
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, stage } : d)));
  }
  function toggleTask(id: number) {
    setActivities((a) => a.map((x) => (x.id === id ? { ...x, status: x.status === "Ouverte" ? "Terminée" : "Ouverte" } : x)));
  }
  function convertLead(l: Lead) {
    setDeals((ds) => [{ id: Date.now(), name: `Affaire — ${l.company}`, account: l.company, contact: l.name, stage: "qualification", amount: l.value, owner: l.owner, source: l.source, closeDate: "2026-07-15" }, ...ds]);
    setLeads((ls) => ls.filter((x) => x.id !== l.id));
    setDetail(null);
    setModule("deals");
  }
  function addNote(key: string, text: string) {
    if (!text.trim()) return;
    setNotes((n) => ({ ...n, [key]: [{ text, when: "à l'instant" }, ...(n[key] ?? [])] }));
  }

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader title="CRM" subtitle="Suite commerciale — leads, affaires, comptes & activité" icon={Target} t={t} />

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <Kpi label="Pipeline pondéré" value={formatDA(Math.round(weighted))} icon={TrendingUp} accent="#8b5cf6" t={t} />
        <Kpi label="Pipeline ouvert" value={formatDA(pipeline)} icon={Banknote} accent={ORANGE} t={t} />
        <Kpi label="Affaires ouvertes" value={String(openDeals.length)} icon={Target} accent="#3b82f6" t={t} />
        <Kpi label="Nouveaux leads" value={String(leads.filter((l) => l.status === "Nouveau").length)} icon={Zap} accent="#f59e0b" t={t} />
        <Kpi label="Taux de gain" value={winRate + " %"} icon={CheckCircle2} accent="#22c55e" t={t} />
        <Kpi label="Tâches ouvertes" value={String(openTasks)} icon={CheckSquare} accent="#ec4899" t={t} />
      </div>

      {/* Module tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 22, borderBottom: `1px solid ${t.border}`, overflowX: "auto" }}>
        {MODULES.map((m) => {
          const active = module === m.key;
          return (
            <button key={m.key} onClick={() => setModule(m.key)} style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 15px", fontSize: 13.5, fontWeight: 600,
              cursor: "pointer", background: "none", border: "none", whiteSpace: "nowrap",
              color: active ? ORANGE : t.textMuted, borderBottom: `2px solid ${active ? ORANGE : "transparent"}`, marginBottom: -1,
            }}>
              <m.icon size={15} /> {m.label}
            </button>
          );
        })}
      </div>

      {module === "home" && <HomeView t={t} deals={deals} leads={leads} activities={activities} pipeline={pipeline} weighted={weighted} wonAmount={wonAmount} stageOf={stageOf} onOpenTask={() => setModule("activities")} onOpenInbox={() => setModule("messaging")} />}
      {module === "messaging" && <MessagingView t={t} />}
      {module === "leads" && <LeadsView t={t} leads={leads} onOpen={(id) => setDetail({ type: "lead", id })} onConvert={convertLead} />}
      {module === "contacts" && <ContactsView t={t} onOpen={(id) => setDetail({ type: "contact", id })} />}
      {module === "accounts" && <AccountsView t={t} onOpen={(id) => setDetail({ type: "account", id })} />}
      {module === "deals" && <DealsView t={t} deals={deals} stageOf={stageOf} pipeline={pipeline} weighted={weighted} wonAmount={wonAmount} onMove={moveDeal} onOpen={(id: number) => setDetail({ type: "deal", id })} />}
      {module === "activities" && <ActivitiesView t={t} activities={activities} onToggle={toggleTask} onAdd={(a) => setActivities((x) => [a, ...x])} />}
      {module === "reports" && <ReportsView t={t} deals={deals} leads={leads} stageOf={stageOf} />}

      {detail && <DetailDrawer t={t} detail={detail} leads={leads} deals={deals} activities={activities} notes={notes} onClose={() => setDetail(null)} onAddNote={addNote} onConvert={convertLead} stageOf={stageOf} />}
    </div>
  );
}

/* ════ HOME ════ */
function HomeView({ t, deals, leads, activities, pipeline, weighted, wonAmount, stageOf, onOpenTask, onOpenInbox }: any) {
  const funnel = OPEN_STAGES.map((k) => { const st = stageOf(k); const ds = deals.filter((d: Deal) => d.stage === k); return { label: st.label, color: st.color, count: ds.length, amount: ds.reduce((s: number, d: Deal) => s + d.amount, 0) }; });
  const maxF = Math.max(...funnel.map((f) => f.amount), 1);
  const maxRev = Math.max(...MONTHLY_REVENUE.map((m) => m.v), 1);
  const byOwner = OWNERS.map((o) => ({ o, v: deals.filter((d: Deal) => d.owner === o && d.stage === "won").reduce((s: number, d: Deal) => s + d.amount, 0) })).sort((a, b) => b.v - a.v);
  const maxOwner = Math.max(...byOwner.map((x) => x.v), 1);
  const myTasks = activities.filter((a: Activity) => a.status === "Ouverte").slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card t={t} title="Entonnoir des ventes" flex="1.3 1 380px">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {funnel.map((f, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ color: t.textSub, fontWeight: 550 }}>{f.label} <span style={{ color: t.textFaint }}>· {f.count}</span></span>
                  <span style={{ color: t.text, fontWeight: 700 }}>{formatDA(f.amount)}</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: t.divider, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(f.amount / maxF) * 100}%`, background: f.color, borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card t={t} title="Revenu mensuel" flex="1 1 280px">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150 }}>
            {MONTHLY_REVENUE.map((m, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: "100%", maxWidth: 30, height: (m.v / maxRev) * 130, background: i === MONTHLY_REVENUE.length - 1 ? ORANGE : "#3b82f6", borderRadius: "5px 5px 0 0" }} />
                <span style={{ fontSize: 11, color: t.textMuted }}>{m.m}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card t={t} title="Mes tâches à venir" flex="1 1 340px">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {myTasks.map((a: Activity, i: number) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: i < myTasks.length - 1 ? `1px solid ${t.divider}` : "none" }}>
                <ActIcon type={a.type} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{a.subject}</div>
                  <div style={{ fontSize: 11.5, color: t.textMuted }}>{a.related}</div>
                </div>
                <span style={{ fontSize: 11.5, color: t.textMuted, whiteSpace: "nowrap" }}>{a.due.slice(5)}</span>
              </div>
            ))}
          </div>
          <button onClick={onOpenTask} style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: ORANGE, background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>Voir tout <ChevronRight size={14} /></button>
        </Card>
        <Card t={t} title="Classement (gagné)" flex="1 1 280px">
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {byOwner.map((x, i) => (
              <div key={x.o}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 550, color: t.text }}>
                    {i === 0 ? <Trophy size={14} color={ORANGE} /> : <span style={{ width: 14, textAlign: "center", color: t.textFaint, fontSize: 11, fontWeight: 700 }}>{i + 1}</span>}{x.o}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: t.textSub }}>{formatDA(x.v)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: t.divider, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(x.v / maxOwner) * 100}%`, background: i === 0 ? ORANGE : "#8b5cf6", borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card t={t} title="Conversations par canal" flex="1 1 260px">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {CHANNELS.map((ch) => { const Icon = CH_ICON[ch.key]; return (
              <button key={ch.key} onClick={onOpenInbox} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: ch.color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={17} color={ch.color} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{ch.label}</div>
                  <div style={{ fontSize: 11.5, color: t.textMuted }}>{ch.convos} conversations</div>
                </div>
                {ch.unread > 0 && <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: ch.color, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px" }}>{ch.unread}</span>}
              </button>
            ); })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ════ LEADS ════ */
function LeadsView({ t, leads, onOpen, onConvert }: { t: Tokens; leads: Lead[]; onOpen: (id: number) => void; onConvert: (l: Lead) => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | LeadStatus>("all");
  const shown = leads.filter((l) => (status === "all" || l.status === status) && (!search.trim() || l.name.toLowerCase().includes(search.toLowerCase()) || l.company.toLowerCase().includes(search.toLowerCase())));
  const statuses: LeadStatus[] = ["Nouveau", "Contacté", "Qualifié", "Non qualifié"];

  return (
    <div>
      <Toolbar t={t} search={search} setSearch={setSearch} placeholder="Rechercher un lead…">
        <button onClick={() => setStatus("all")} style={chip(t, status === "all", ORANGE)}>Tous ({leads.length})</button>
        {statuses.map((s) => <button key={s} onClick={() => setStatus(s)} style={chip(t, status === s, LEAD_STATUS_COLORS[s])}>{s} ({leads.filter((l) => l.status === s).length})</button>)}
      </Toolbar>
      <TableWrap t={t} cols={["Lead", "Source", "Score", "Statut", "Propriétaire", "Valeur", ""]}>
        {shown.map((l) => (
          <tr key={l.id} style={{ borderBottom: `1px solid ${t.divider}`, cursor: "pointer" }} onClick={() => onOpen(l.id)}
            onMouseEnter={(e) => (e.currentTarget.style.background = t.rowHover)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <td style={td}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={l.name} /><div><div style={{ fontWeight: 600, color: t.text }}>{l.name}</div><div style={{ fontSize: 12, color: t.textMuted }}>{l.company} · {l.wilaya}</div></div></div></td>
            <td style={{ ...td, color: t.textSub }}>{l.source}</td>
            <td style={td}><ScoreBar score={l.score} t={t} /></td>
            <td style={td}><Badge color={LEAD_STATUS_COLORS[l.status]} bg={LEAD_STATUS_COLORS[l.status] + "18"}>{l.status}</Badge></td>
            <td style={{ ...td, color: t.textSub }}>{l.owner}</td>
            <td style={{ ...td, fontWeight: 700, color: t.text }}>{formatDA(l.value)}</td>
            <td style={{ ...td, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
              {l.status === "Qualifié"
                ? <button onClick={() => onConvert(l)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 7, border: "none", background: "#22c55e", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}><ArrowRight size={12} /> Convertir</button>
                : <button onClick={() => onOpen(l.id)} style={{ padding: "6px 11px", borderRadius: 7, border: `1px solid ${t.border}`, background: t.card, color: t.textSub, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Ouvrir</button>}
            </td>
          </tr>
        ))}
        {shown.length === 0 && <tr><td colSpan={7} style={{ ...td, textAlign: "center", padding: 40, color: t.textMuted }}>Aucun lead</td></tr>}
      </TableWrap>
    </div>
  );
}

/* ════ CONTACTS ════ */
function ContactsView({ t, onOpen }: { t: Tokens; onOpen: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const shown = CONTACTS.filter((c) => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()) || c.account.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <Toolbar t={t} search={search} setSearch={setSearch} placeholder="Rechercher un contact…" />
      <TableWrap t={t} cols={["Contact", "Fonction", "Compte", "Coordonnées", "Propriétaire"]}>
        {shown.map((c) => (
          <tr key={c.id} style={{ borderBottom: `1px solid ${t.divider}`, cursor: "pointer" }} onClick={() => onOpen(c.id)}
            onMouseEnter={(e) => (e.currentTarget.style.background = t.rowHover)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <td style={td}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={c.name} /><span style={{ fontWeight: 600, color: t.text }}>{c.name}</span></div></td>
            <td style={{ ...td, color: t.textSub }}>{c.title}</td>
            <td style={{ ...td, color: t.textSub }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Building2 size={12} color={t.textFaint} />{c.account}</span></td>
            <td style={{ ...td, color: t.textSub }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}><Mail size={11} color={t.textFaint} />{c.email}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 12 }}><Phone size={11} color={t.textFaint} />{c.phone}</div>
            </td>
            <td style={{ ...td, color: t.textSub }}>{c.owner}</td>
          </tr>
        ))}
      </TableWrap>
    </div>
  );
}

/* ════ ACCOUNTS ════ */
function AccountsView({ t, onOpen }: { t: Tokens; onOpen: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const shown = ACCOUNTS.filter((a) => !search.trim() || a.name.toLowerCase().includes(search.toLowerCase()) || a.industry.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <Toolbar t={t} search={search} setSearch={setSearch} placeholder="Rechercher un compte…" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {shown.map((a) => (
          <div key={a.id} onClick={() => onOpen(a.id)} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18, boxShadow: t.shadow, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: ORANGE + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><Building2 size={20} color={ORANGE} /></div>
              <div><div style={{ fontSize: 14.5, fontWeight: 700, color: t.text }}>{a.name}</div><div style={{ fontSize: 12, color: t.textMuted }}>{a.industry}</div></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12.5, color: t.textSub }}>
              <Line icon={<MapPin size={13} color={t.textFaint} />} v={a.wilaya} />
              <Line icon={<Globe size={13} color={t.textFaint} />} v={a.website} />
              <Line icon={<Phone size={13} color={t.textFaint} />} v={a.phone} mono />
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${t.divider}` }}>
              <Stat label="Contacts" v={String(a.contacts)} t={t} />
              <Stat label="Affaires" v={String(a.openDeals)} t={t} />
              <Stat label="CA" v={formatDA(a.revenue)} t={t} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════ DEALS (kanban + forecast) ════ */
function DealsView({ t, deals, stageOf, pipeline, weighted, wonAmount, onMove, onOpen }: any) {
  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <Forecast t={t} label="Pipeline ouvert" value={formatDA(pipeline)} color={ORANGE} />
        <Forecast t={t} label="Prévision pondérée" value={formatDA(Math.round(weighted))} color="#8b5cf6" />
        <Forecast t={t} label="Gagné" value={formatDA(wonAmount)} color="#22c55e" />
      </div>
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
        {STAGES.map((st) => {
          const ds = deals.filter((d: Deal) => d.stage === st.key);
          const sum = ds.reduce((s: number, d: Deal) => s + d.amount, 0);
          return (
            <div key={st.key} style={{ minWidth: 250, flex: "0 0 250px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 10, background: st.color + "12", marginBottom: 4 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: st.color }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: st.color }} />{st.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: st.color }}>{st.prob}%</span>
              </div>
              <div style={{ fontSize: 11, color: t.textMuted, margin: "6px 4px 10px" }}>{ds.length} · {formatDA(sum)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ds.map((d: Deal) => (
                  <div key={d.id} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 11, padding: 12, boxShadow: t.shadow, borderLeft: `3px solid ${st.color}` }}>
                    <div onClick={() => onOpen(d.id)} style={{ cursor: "pointer" }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text, marginBottom: 4 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: t.textSub, marginBottom: 8 }}>{d.account}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: st.color }}>{formatDA(d.amount)}</span>
                        <span style={{ fontSize: 11, color: t.textMuted, display: "inline-flex", alignItems: "center", gap: 4 }}><CalendarDays size={11} />{d.closeDate.slice(5)}</span>
                      </div>
                    </div>
                    <select value={d.stage} onChange={(e) => onMove(d.id, e.target.value as StageKey)}
                      style={{ width: "100%", padding: "5px 8px", borderRadius: 7, fontSize: 11.5, fontWeight: 600, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, cursor: "pointer" }}>
                      {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════ ACTIVITIES ════ */
function ActivitiesView({ t, activities, onToggle, onAdd }: { t: Tokens; activities: Activity[]; onToggle: (id: number) => void; onAdd: (a: Activity) => void }) {
  const [filter, setFilter] = useState<"all" | ActStatus>("Ouverte");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "Tâche" as Activity["type"], subject: "", related: "", due: "2026-06-15", priority: "Normale" as Activity["priority"] });
  const shown = activities.filter((a) => filter === "all" || a.status === filter);
  const PRIO: Record<string, string> = { Basse: "#6b7280", Normale: "#3b82f6", Haute: "#ef4444" };

  function add() {
    if (!form.subject.trim()) return;
    onAdd({ id: Date.now(), ...form, status: "Ouverte", owner: "Moi" as Activity["owner"] });
    setForm({ type: "Tâche", subject: "", related: "", due: "2026-06-15", priority: "Normale" });
    setOpen(false);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {(["Ouverte", "Terminée", "all"] as const).map((k) => <button key={k} onClick={() => setFilter(k)} style={chip(t, filter === k, ORANGE)}>{k === "all" ? "Toutes" : k === "Ouverte" ? "Ouvertes" : "Terminées"}</button>)}
        </div>
        <button onClick={() => setOpen(true)} style={primaryBtn}><Plus size={15} /> Nouvelle tâche</button>
      </div>
      <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: "6px 20px", boxShadow: t.shadow }}>
        {shown.map((a, i) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 0", borderBottom: i < shown.length - 1 ? `1px solid ${t.divider}` : "none", opacity: a.status === "Terminée" ? 0.55 : 1 }}>
            <button onClick={() => onToggle(a.id)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer", border: `1.5px solid ${a.status === "Terminée" ? "#22c55e" : t.border}`, background: a.status === "Terminée" ? "#22c55e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {a.status === "Terminée" && <Check size={13} color="#fff" />}
            </button>
            <ActIcon type={a.type} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text, textDecoration: a.status === "Terminée" ? "line-through" : "none" }}>{a.subject}</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>{a.related} · {a.owner}</div>
            </div>
            <Badge color={PRIO[a.priority]} bg={PRIO[a.priority] + "18"}>{a.priority}</Badge>
            <span style={{ fontSize: 12, color: t.textMuted, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}><Clock size={12} />{a.due.slice(5)}</span>
          </div>
        ))}
        {shown.length === 0 && <div style={{ padding: 30, textAlign: "center", color: t.textMuted }}>Aucune activité</div>}
      </div>

      {open && (
        <Modal t={t} title="Nouvelle activité" onClose={() => setOpen(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Type" t={t}><select style={inp(t)} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Activity["type"] })}><option>Tâche</option><option>Appel</option><option>Réunion</option><option>Email</option></select></Field>
            <Field label="Priorité" t={t}><select style={inp(t)} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Activity["priority"] })}><option>Basse</option><option>Normale</option><option>Haute</option></select></Field>
            <Field label="Sujet" t={t} full><input style={inp(t)} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
            <Field label="Lié à" t={t}><input style={inp(t)} value={form.related} onChange={(e) => setForm({ ...form, related: e.target.value })} placeholder="Compte / Affaire" /></Field>
            <Field label="Échéance" t={t}><input type="date" style={inp(t)} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}><button onClick={() => setOpen(false)} style={ghostBtn(t)}>Annuler</button><button onClick={add} style={primaryBtn}><Check size={15} /> Créer</button></div>
        </Modal>
      )}
    </div>
  );
}

/* ════ REPORTS ════ */
function ReportsView({ t, deals, leads, stageOf }: any) {
  const funnel = OPEN_STAGES.map((k) => { const st = stageOf(k); return { label: st.label, color: st.color, n: deals.filter((d: Deal) => d.stage === k).length }; });
  const maxFn = Math.max(...funnel.map((f) => f.n), 1);
  const won = deals.filter((d: Deal) => d.stage === "won").length;
  const lost = deals.filter((d: Deal) => d.stage === "lost").length;
  const sources = Array.from(new Set(leads.map((l: Lead) => l.source))) as string[];
  const bySource = sources.map((s) => ({ s, n: leads.filter((l: Lead) => l.source === s).length })).sort((a, b) => b.n - a.n);
  const maxSrc = Math.max(...bySource.map((x) => x.n), 1);
  const maxRev = Math.max(...MONTHLY_REVENUE.map((m) => m.v), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card t={t} title="Entonnoir (nombre d'affaires)" flex="1 1 320px">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {funnel.map((f, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}><span style={{ color: t.textSub }}>{f.label}</span><span style={{ color: t.text, fontWeight: 700 }}>{f.n}</span></div>
                <div style={{ height: 22, borderRadius: 6, background: t.divider, overflow: "hidden" }}><div style={{ height: "100%", width: `${(f.n / maxFn) * 100}%`, background: f.color }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card t={t} title="Ratio Gagné / Perdu" flex="1 1 220px">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 26, padding: "10px 0" }}>
            <Ring won={won} lost={lost} />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <LegendDot color="#22c55e" label={`Gagné · ${won}`} t={t} />
              <LegendDot color="#ef4444" label={`Perdu · ${lost}`} t={t} />
              <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>Taux : <b style={{ color: t.text }}>{won + lost ? Math.round((won / (won + lost)) * 100) : 0}%</b></div>
            </div>
          </div>
        </Card>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card t={t} title="Leads par source" flex="1 1 320px">
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {bySource.map((x) => (
              <div key={x.s}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}><span style={{ color: t.textSub }}>{x.s}</span><span style={{ color: t.text, fontWeight: 700 }}>{x.n}</span></div>
                <div style={{ height: 8, borderRadius: 4, background: t.divider, overflow: "hidden" }}><div style={{ height: "100%", width: `${(x.n / maxSrc) * 100}%`, background: "#8b5cf6" }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card t={t} title="Revenu mensuel" flex="1 1 320px">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150 }}>
            {MONTHLY_REVENUE.map((m, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ fontSize: 10, color: t.textMuted }}>{Math.round(m.v / 1000)}k</div>
                <div style={{ width: "100%", maxWidth: 34, height: (m.v / maxRev) * 120, background: i === MONTHLY_REVENUE.length - 1 ? ORANGE : "#3b82f6", borderRadius: "5px 5px 0 0" }} />
                <span style={{ fontSize: 11, color: t.textMuted }}>{m.m}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ════ DETAIL DRAWER (360°) ════ */
function DetailDrawer({ t, detail, leads, deals, activities, notes, onClose, onAddNote, onConvert, stageOf }: any) {
  const [tab, setTab] = useState<"apercu" | "assoc" | "chrono" | "notes">("apercu");
  const [note, setNote] = useState("");

  let title = ""; let subtitle = ""; let fields: [string, string][] = []; let name = "";
  let lead: Lead | undefined; const noteKey = `${detail.type}:${detail.id}`;

  if (detail.type === "lead") {
    lead = leads.find((l: Lead) => l.id === detail.id);
    if (lead) { name = lead.company; title = lead.name; subtitle = `${lead.company} · ${lead.wilaya}`;
      fields = [["Statut", lead.status], ["Source", lead.source], ["Score", `${lead.score}/100`], ["Valeur estimée", formatDA(lead.value)], ["Email", lead.email], ["Téléphone", lead.phone], ["Propriétaire", lead.owner]]; }
  } else if (detail.type === "deal") {
    const d: Deal | undefined = deals.find((x: Deal) => x.id === detail.id);
    if (d) { name = d.account; title = d.name; subtitle = d.account; const st = stageOf(d.stage);
      fields = [["Étape", st.label], ["Probabilité", `${st.prob}%`], ["Montant", formatDA(d.amount)], ["Prévision pondérée", formatDA(Math.round(d.amount * st.prob / 100))], ["Contact", d.contact], ["Clôture", d.closeDate], ["Propriétaire", d.owner]]; }
  } else if (detail.type === "account") {
    const a = ACCOUNTS.find((x) => x.id === detail.id);
    if (a) { name = a.name; title = a.name; subtitle = a.industry;
      fields = [["Wilaya", a.wilaya], ["Site web", a.website], ["Téléphone", a.phone], ["Contacts", String(a.contacts)], ["Affaires ouvertes", String(a.openDeals)], ["CA", formatDA(a.revenue)], ["Propriétaire", a.owner]]; }
  } else {
    const c = CONTACTS.find((x) => x.id === detail.id);
    if (c) { name = c.account; title = c.name; subtitle = `${c.title} · ${c.account}`;
      fields = [["Compte", c.account], ["Fonction", c.title], ["Email", c.email], ["Téléphone", c.phone], ["Propriétaire", c.owner]]; }
  }

  let phone = ""; let email = "";
  if (detail.type === "lead" && lead) { phone = lead.phone; email = lead.email; }
  else if (detail.type === "contact") { const c = CONTACTS.find((x) => x.id === detail.id); phone = c?.phone ?? ""; email = c?.email ?? ""; }
  else if (detail.type === "account") { const a = ACCOUNTS.find((x) => x.id === detail.id); phone = a?.phone ?? ""; }
  else if (detail.type === "deal") { const d = deals.find((x: Deal) => x.id === detail.id); const c = CONTACTS.find((x) => x.name === d?.contact); phone = c?.phone ?? ""; email = c?.email ?? ""; }
  const waDigits = phone.replace(/[^0-9]/g, "");
  const relDeals: Deal[] = deals.filter((d: Deal) => d.account === name);
  const relContacts = CONTACTS.filter((c) => c.account === name);

  const baseTimeline: TimelineEvt[] = TIMELINE[name] ?? [];
  const relatedActs = activities.filter((a: Activity) => a.related.includes(name)).map((a: Activity, i: number) => ({ id: 1000 + i, kind: a.type === "Appel" ? "call" : a.type === "Réunion" ? "meeting" : a.type === "Email" ? "email" : "note", text: `${a.type} : ${a.subject}`, who: a.owner, when: a.due.slice(5) } as TimelineEvt));
  const addedNotes = (notes[noteKey] ?? []).map((n: { text: string; when: string }, i: number) => ({ id: 2000 + i, kind: "note", text: n.text, who: "Moi", when: n.when } as TimelineEvt));
  const timeline = [...addedNotes, ...baseTimeline, ...relatedActs];

  const TL_ICON: Record<string, React.ElementType> = { note: StickyNote, call: PhoneCall, email: Mail, meeting: CalendarDays, stage: Flame, created: CheckCircle2 };
  const TL_COLOR: Record<string, string> = { note: "#6b7280", call: "#3b82f6", email: "#8b5cf6", meeting: "#f59e0b", stage: "#ec4899", created: "#22c55e" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "flex-end" }}>
      <style>{`@keyframes slideInR { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, height: "100%", background: t.card, borderLeft: `1px solid ${t.border}`, boxShadow: "-16px 0 48px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", animation: "slideInR 0.22s ease" }}>
        {/* header */}
        <div style={{ padding: "20px 22px", borderBottom: `1px solid ${t.border}`, background: `linear-gradient(135deg, ${ORANGE}12, transparent)` }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 12 }}>
              <Avatar name={title} size={46} />
              <div><div style={{ fontSize: 17, fontWeight: 750, color: t.text }}>{title}</div><div style={{ fontSize: 12.5, color: t.textMuted, marginTop: 3 }}>{subtitle}</div></div>
            </div>
            <button onClick={onClose} style={{ border: "none", background: "none", color: t.textFaint, cursor: "pointer" }}><X size={18} /></button>
          </div>
          {detail.type === "lead" && lead?.status === "Qualifié" && (
            <button onClick={() => onConvert(lead)} style={{ ...primaryBtn, marginTop: 14, background: "#22c55e" }}><ArrowRight size={14} /> Convertir en affaire</button>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <QuickAction t={t} icon={Phone} label="Appeler" href={waDigits ? `tel:${waDigits}` : undefined} color="#3b82f6" />
            <QuickAction t={t} icon={MessageCircle} label="WhatsApp" href={waDigits ? `https://wa.me/${waDigits}` : undefined} color="#25D366" />
            <QuickAction t={t} icon={Mail} label="Email" href={email ? `mailto:${email}` : undefined} color="#8b5cf6" />
          </div>
        </div>
        {/* tabs */}
        <div style={{ display: "flex", gap: 4, padding: "0 22px", borderBottom: `1px solid ${t.border}` }}>
          {([["apercu", "Aperçu"], ["assoc", "Associés"], ["chrono", "Chronologie"], ["notes", "Notes"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: "12px 12px", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer", color: tab === k ? ORANGE : t.textMuted, borderBottom: `2px solid ${tab === k ? ORANGE : "transparent"}`, marginBottom: -1 }}>{l}</button>
          ))}
        </div>
        {/* body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {tab === "apercu" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {fields.map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: i < fields.length - 1 ? `1px solid ${t.divider}` : "none" }}>
                  <span style={{ fontSize: 12.5, color: t.textMuted }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.text, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
          )}
          {tab === "assoc" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, margin: "2px 0 10px" }}>Affaires ({relDeals.length})</div>
              {relDeals.length === 0 && <div style={{ fontSize: 12.5, color: t.textFaint, marginBottom: 14 }}>Aucune affaire associée.</div>}
              {relDeals.map((d) => { const st = stageOf(d.stage); return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", border: `1px solid ${t.border}`, borderRadius: 10, marginBottom: 8 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{d.name}</div><div style={{ fontSize: 11.5, color: t.textMuted }}>{st.label} · {formatDA(d.amount)}</div></div>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
                </div>
              ); })}
              <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, margin: "16px 0 10px" }}>Contacts ({relContacts.length})</div>
              {relContacts.length === 0 && <div style={{ fontSize: 12.5, color: t.textFaint }}>Aucun contact associé.</div>}
              {relContacts.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: `1px solid ${t.border}`, borderRadius: 10, marginBottom: 8 }}>
                  <Avatar name={c.name} size={32} />
                  <div><div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.name}</div><div style={{ fontSize: 11.5, color: t.textMuted }}>{c.title}</div></div>
                </div>
              ))}
            </div>
          )}
          {tab === "chrono" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {timeline.length === 0 && <div style={{ color: t.textMuted, fontSize: 13, padding: 16, textAlign: "center" }}>Aucune activité</div>}
              {timeline.map((e: TimelineEvt, i: number) => { const Ic = TL_ICON[e.kind]; const c = TL_COLOR[e.kind]; return (
                <div key={e.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < timeline.length - 1 ? `1px solid ${t.divider}` : "none" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: c + "16", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic size={15} color={c} /></div>
                  <div><div style={{ fontSize: 13, color: t.text }}>{e.text}</div><div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>{e.who} · {e.when}</div></div>
                </div>
              ); })}
            </div>
          )}
          {tab === "notes" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter une note…" style={{ ...inp(t), flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") { onAddNote(noteKey, note); setNote(""); } }} />
                <button onClick={() => { onAddNote(noteKey, note); setNote(""); }} style={primaryBtn}><Plus size={15} /></button>
              </div>
              {(notes[noteKey] ?? []).length === 0 && <div style={{ color: t.textMuted, fontSize: 13, padding: 16, textAlign: "center" }}>Aucune note. Ajoutez la première.</div>}
              {(notes[noteKey] ?? []).map((n: { text: string; when: string }, i: number) => (
                <div key={i} style={{ background: t.sectionBg, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, color: t.text }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Moi · {n.when}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════ MESSAGING (omnichannel) ════ */
function MessagingView({ t }: { t: Tokens }) {
  const [convos, setConvos] = useState<Convo[]>(CONVERSATIONS);
  const [filter, setFilter] = useState<"all" | Channel>("all");
  const [selId, setSelId] = useState<number>(CONVERSATIONS[0].id);
  const [draft, setDraft] = useState("");

  const shown = convos.filter((c) => filter === "all" || c.channel === filter);
  const active = convos.find((c) => c.id === selId) ?? shown[0] ?? null;

  function open(id: number) {
    setSelId(id);
    setConvos((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }
  function send() {
    if (!draft.trim() || !active) return;
    const text = draft;
    setConvos((cs) => cs.map((c) => (c.id === active.id ? { ...c, messages: [...c.messages, { from: "me", text, time: "maintenant" }], last: text, unread: 0 } : c)));
    setDraft("");
  }

  return (
    <div>
      {/* Channel status cards */}
      <div style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        {CHANNELS.map((ch) => {
          const Icon = CH_ICON[ch.key];
          return (
            <div key={ch.key} style={{ flex: "1 1 0", minWidth: 220, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, boxShadow: t.shadow, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 11, background: ch.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={22} color={ch.color} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{ch.label}</div>
                <div style={{ fontSize: 11.5, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.handle}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#22c55e" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />Connecté</span>
                {ch.unread > 0 && <div style={{ marginTop: 5, fontSize: 11, fontWeight: 700, color: ch.color }}>{ch.unread} non lus</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Inbox + thread */}
      <div style={{ display: "flex", border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden", height: 540, background: t.card, boxShadow: t.shadow }}>
        {/* conversation list */}
        <div style={{ width: 320, flexShrink: 0, borderRight: `1px solid ${t.border}`, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 6, padding: 12, borderBottom: `1px solid ${t.divider}`, flexWrap: "wrap" }}>
            <button onClick={() => setFilter("all")} style={chip(t, filter === "all", ORANGE)}>Tous</button>
            {CHANNELS.map((ch) => <button key={ch.key} onClick={() => setFilter(ch.key)} style={chip(t, filter === ch.key, ch.color)}>{ch.label.split(" ")[0]}</button>)}
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {shown.map((c) => {
              const Icon = CH_ICON[c.channel]; const col = CH(c.channel).color; const sel = active?.id === c.id;
              return (
                <button key={c.id} onClick={() => open(c.id)} style={{ display: "flex", gap: 10, width: "100%", textAlign: "left", padding: "12px 14px", border: "none", borderBottom: `1px solid ${t.divider}`, cursor: "pointer", background: sel ? ORANGE + "0e" : "transparent" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <Avatar name={c.name} size={38} />
                    <span style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: col, border: `2px solid ${t.card}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={10} color="#fff" /></span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                      <span style={{ fontSize: 10.5, color: t.textFaint, flexShrink: 0 }}>{c.time}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last}</span>
                      {c.unread > 0 && <span style={{ flexShrink: 0, minWidth: 18, height: 18, borderRadius: 9, background: ORANGE, color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{c.unread}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        {/* thread */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {active ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 18px", borderBottom: `1px solid ${t.divider}` }}>
                <Avatar name={active.name} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{active.name}</div>
                  <div style={{ fontSize: 11.5, color: t.textMuted }}>{active.handle}</div>
                </div>
                {(() => { const Icon = CH_ICON[active.channel]; const col = CH(active.channel).color; return <Badge color={col} bg={col + "18"}><Icon size={12} /> {CH(active.channel).label.split(" ")[0]}</Badge>; })()}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 10, background: t.sectionBg }}>
                {active.messages.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.from === "me" ? "flex-end" : "flex-start", maxWidth: "72%" }}>
                    <div style={{ padding: "9px 13px", borderRadius: m.from === "me" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", background: m.from === "me" ? ORANGE : t.card, color: m.from === "me" ? "#fff" : t.text, fontSize: 13, border: m.from === "me" ? "none" : `1px solid ${t.border}` }}>{m.text}</div>
                    <div style={{ fontSize: 10, color: t.textFaint, marginTop: 3, textAlign: m.from === "me" ? "right" : "left" }}>{m.time}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, padding: 14, borderTop: `1px solid ${t.divider}` }}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Écrire un message…" style={{ ...inp(t), flex: 1 }} />
                <button onClick={send} style={primaryBtn}><Send size={15} /></button>
              </div>
            </>
          ) : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>Sélectionnez une conversation</div>}
        </div>
      </div>
    </div>
  );
}

/* ════ shared bits ════ */
function Kpi({ label, value, icon: Icon, accent, t }: { label: string; value: string; icon: React.ElementType; accent: string; t: Tokens }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 140, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 16px", boxShadow: t.shadow, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: accent + "16", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={15} color={accent} /></div>
        <span style={{ fontSize: 11.5, fontWeight: 500, color: t.textMuted }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{value}</div>
    </div>
  );
}
function Card({ children, t, title, flex }: { children: React.ReactNode; t: Tokens; title: string; flex?: string }) {
  return (
    <div style={{ flex: flex ?? "1 1 0", minWidth: 0, background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: "20px 22px", boxShadow: t.shadow }}>
      <div style={{ fontSize: 14, fontWeight: 650, color: t.text, marginBottom: 18 }}>{title}</div>
      {children}
    </div>
  );
}
function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const init = name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  return <div style={{ width: size, height: size, borderRadius: size * 0.28, background: ORANGE + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, color: ORANGE, flexShrink: 0 }}>{init}</div>;
}
function ScoreBar({ score, t }: { score: number; t: Tokens }) {
  const c = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 90 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: t.divider, overflow: "hidden" }}><div style={{ height: "100%", width: `${score}%`, background: c, borderRadius: 3 }} /></div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: c }}>{score}</span>
    </div>
  );
}
function ActIcon({ type }: { type: Activity["type"] }) {
  const M = { Appel: PhoneCall, Réunion: CalendarDays, Email: Mail, Tâche: CheckSquare };
  const C = { Appel: "#3b82f6", Réunion: "#f59e0b", Email: "#8b5cf6", Tâche: "#6b7280" };
  const Ic = M[type]; const c = C[type];
  return <div style={{ width: 30, height: 30, borderRadius: 8, background: c + "16", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ic size={15} color={c} /></div>;
}
function Forecast({ t, label, value, color }: { t: Tokens; label: string; value: string; color: string }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: 160, background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 18px", boxShadow: t.shadow, borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: t.text }}>{value}</div>
    </div>
  );
}
function Toolbar({ t, search, setSearch, placeholder, children }: { t: Tokens; search: string; setSearch: (v: string) => void; placeholder: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 340 }}>
        <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 12, top: 11 }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 9, fontSize: 13.5, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none" }} />
      </div>
      {children}
    </div>
  );
}
function TableWrap({ t, cols, children }: { t: Tokens; cols: string[]; children: React.ReactNode }) {
  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: t.shadow, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ borderBottom: `1px solid ${t.divider}`, background: t.sectionBg }}>{cols.map((h, i) => <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
function Line({ icon, v, mono }: { icon: React.ReactNode; v: string; mono?: boolean }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{icon}<span style={{ fontFamily: mono ? "monospace" : undefined }}>{v}</span></div>;
}
function Stat({ label, v, t }: { label: string; v: string; t: Tokens }) {
  return <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: t.textMuted, marginBottom: 2 }}>{label}</div><div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{v}</div></div>;
}
function LegendDot({ color, label, t }: { color: string; label: string; t: Tokens }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, color: t.textSub }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{label}</span>;
}
function Ring({ won, lost }: { won: number; lost: number }) {
  const total = won + lost || 1; const pct = (won / total) * 100;
  return <div style={{ width: 92, height: 92, borderRadius: "50%", background: `conic-gradient(#22c55e ${pct}%, #ef4444 0)`, display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ width: 58, height: 58, borderRadius: "50%", background: "var(--ring-hole, #fff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#22c55e", backdropFilter: "blur(2px)" }}>{Math.round(pct)}%</div></div>;
}
function Modal({ children, onClose, t, title }: { children: React.ReactNode; onClose: () => void; t: Tokens; title: string }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}><h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>{title}</h3><button onClick={onClose} style={{ border: "none", background: "none", color: t.textFaint, cursor: "pointer" }}><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children, t, full }: { label: string; children: React.ReactNode; t: Tokens; full?: boolean }) {
  return <div style={{ gridColumn: full ? "1 / -1" : undefined }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>{label}</label>{children}</div>;
}
function QuickAction({ t, icon: Icon, label, href, color }: { t: Tokens; icon: React.ElementType; label: string; href?: string; color: string }) {
  const style: React.CSSProperties = { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, border: `1px solid ${href ? color + "44" : t.border}`, background: href ? color + "12" : t.card, color: href ? color : t.textFaint, textDecoration: "none", cursor: href ? "pointer" : "not-allowed" };
  if (!href) return <span style={style}><Icon size={14} /> {label}</span>;
  return <a href={href} target="_blank" rel="noreferrer" style={style}><Icon size={14} /> {label}</a>;
}
const td: React.CSSProperties = { padding: "12px 16px" };
const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, background: ORANGE, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghostBtn = (t: Tokens): React.CSSProperties => ({ padding: "9px 16px", borderRadius: 9, background: t.card, color: t.textSub, border: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, cursor: "pointer" });
const inp = (t: Tokens): React.CSSProperties => ({ width: "100%", padding: "9px 11px", borderRadius: 8, fontSize: 13, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none", fontFamily: "inherit" });
const chip = (t: Tokens, active: boolean, color: string): React.CSSProperties => ({ padding: "7px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? color : t.border}`, background: active ? color + "14" : t.card, color: active ? color : t.textSub });
