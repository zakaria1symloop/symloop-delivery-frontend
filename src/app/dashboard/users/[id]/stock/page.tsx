"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Boxes, Plus, Search, Package, Layers, Wallet, AlertTriangle, X, Check, Minus, Trash2, ScanBarcode,
} from "lucide-react";
import { useIsDark, useTokens, PageHeader, BackButton, Badge, Barcode, formatDA, ORANGE, type Tokens } from "../../../_ui";

interface StockItem { id: number; name: string; sku: string; price: number; stock: number; }

const SEED: StockItem[] = [
  { id: 1, name: "T-shirt coton premium", sku: "AND-TS-001", price: 2500, stock: 48 },
  { id: 2, name: "Sweat à capuche", sku: "AND-SW-014", price: 4200, stock: 12 },
  { id: 3, name: "Casquette brodée", sku: "AND-CP-007", price: 1500, stock: 3 },
  { id: 4, name: "Sac à dos urbain", sku: "AND-BG-022", price: 6800, stock: 27 },
  { id: 5, name: "Montre connectée", sku: "AND-WT-103", price: 12900, stock: 0 },
  { id: 6, name: "Écouteurs sans fil", sku: "AND-EP-056", price: 3900, stock: 64 },
];

export default function UserStockPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [items, setItems] = useState<StockItem[]>(SEED);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", sku: "", price: "", stock: "" });

  const shown = items.filter((i) => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase()));
  const totalUnits = items.reduce((s, i) => s + i.stock, 0);
  const stockValue = items.reduce((s, i) => s + i.stock * i.price, 0);
  const lowCount = items.filter((i) => i.stock > 0 && i.stock <= 5).length;

  function add() {
    if (!form.name.trim()) return;
    const sku = form.sku.trim() || `AND-${(items.length + 1).toString().padStart(3, "0")}`;
    setItems((x) => [{ id: Date.now(), name: form.name, sku, price: Number(form.price) || 0, stock: parseInt(form.stock) || 0 }, ...x]);
    setForm({ name: "", sku: "", price: "", stock: "" });
    setOpen(false);
  }
  function adjust(id: number, d: number) {
    setItems((x) => x.map((i) => (i.id === id ? { ...i, stock: Math.max(0, i.stock + d) } : i)));
  }
  function remove(id: number) { setItems((x) => x.filter((i) => i.id !== id)); }

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <BackButton t={t} href="/dashboard/users" label="Retour aux utilisateurs" />

      <PageHeader
        title="Stock & Produits"
        subtitle={`Gestion du stock de l'utilisateur #${id}`}
        icon={Boxes}
        t={t}
        action={<button onClick={() => setOpen(true)} style={primaryBtn}><Plus size={15} /> Ajouter au stock</button>}
      />

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <Kpi label="Produits" value={String(items.length)} icon={Package} accent={ORANGE} t={t} />
        <Kpi label="Unités en stock" value={String(totalUnits)} icon={Layers} accent="#3b82f6" t={t} />
        <Kpi label="Valeur du stock" value={formatDA(stockValue)} icon={Wallet} accent="#16a34a" t={t} />
        <Kpi label="Stock faible" value={String(lowCount)} icon={AlertTriangle} accent="#f59e0b" t={t} />
      </div>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 360, marginBottom: 18 }}>
        <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 12, top: 11 }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit ou SKU…"
          style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 9, fontSize: 13.5, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none" }} />
      </div>

      {/* Cards with barcode */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 16 }}>
        {shown.map((i) => {
          const out = i.stock <= 0; const low = i.stock > 0 && i.stock <= 5;
          return (
            <div key={i.id} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16, boxShadow: t.shadow }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: t.text, lineHeight: 1.25 }}>{i.name}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: ORANGE, marginTop: 4 }}>{formatDA(i.price)}</div>
                </div>
                <Badge color={out ? "#ef4444" : low ? "#f59e0b" : "#22c55e"} bg={(out ? "#ef4444" : low ? "#f59e0b" : "#22c55e") + "18"}>
                  {out ? "Rupture" : `${i.stock} u.`}
                </Badge>
              </div>

              {/* Barcode panel */}
              <div style={{ background: "#fff", borderRadius: 10, padding: "8px 6px", display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <Barcode value={i.sku} height={42} />
              </div>

              {/* Stock controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => adjust(i.id, -1)} disabled={out} style={{ ...stepBtn(t), opacity: out ? 0.4 : 1 }}><Minus size={15} /></button>
                <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 700, color: t.text }}>{i.stock} <span style={{ fontWeight: 500, color: t.textMuted, fontSize: 11.5 }}>en stock</span></div>
                <button onClick={() => adjust(i.id, +1)} style={stepBtn(t)}><Plus size={15} /></button>
                <button onClick={() => remove(i.id)} title="Retirer" style={{ ...stepBtn(t), color: "#ef4444", borderColor: "#ef444444" }}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div style={{ gridColumn: "1/-1", padding: 44, textAlign: "center", color: t.textMuted, background: t.card, border: `1px dashed ${t.border}`, borderRadius: 14 }}>
            <ScanBarcode size={30} color={t.textFaint} style={{ marginBottom: 8 }} />
            <div>Aucun produit en stock.</div>
          </div>
        )}
      </div>

      {open && (
        <Shell t={t} title="Ajouter au stock" onClose={() => setOpen(false)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Nom du produit" t={t} full><input style={inp(t)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom du produit" /></Field>
            <Field label="SKU / Code-barres" t={t}><input style={{ ...inp(t), fontFamily: "monospace" }} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="auto si vide" /></Field>
            <Field label="Prix (DA)" t={t}><input type="number" style={inp(t)} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="2500" /></Field>
            <Field label="Quantité en stock" t={t} full><input type="number" style={inp(t)} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="50" /></Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button onClick={() => setOpen(false)} style={ghostBtn(t)}>Annuler</button>
            <button onClick={add} style={primaryBtn}><Check size={15} /> Ajouter</button>
          </div>
        </Shell>
      )}
    </div>
  );
}

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

function Shell({ children, onClose, t, title }: { children: React.ReactNode; onClose: () => void; t: Tokens; title: string }) {
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

function Field({ label, children, t, full }: { label: string; children: React.ReactNode; t: Tokens; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, background: ORANGE, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghostBtn = (t: Tokens): React.CSSProperties => ({ padding: "9px 16px", borderRadius: 9, background: t.card, color: t.textSub, border: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, cursor: "pointer" });
const stepBtn = (t: Tokens): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, background: "transparent", color: t.textSub, border: `1px solid ${t.border}`, cursor: "pointer" });
const inp = (t: Tokens): React.CSSProperties => ({ width: "100%", padding: "9px 11px", borderRadius: 8, fontSize: 13, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none", fontFamily: "inherit" });
