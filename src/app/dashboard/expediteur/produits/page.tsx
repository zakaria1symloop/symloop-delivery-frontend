"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Boxes, Plus, Search, ShoppingCart, Sparkles, Globe, Pencil, Trash2, X,
  Loader2, Check, Coins, RefreshCw, Package, Layers, Wallet, ExternalLink, ImageIcon,
} from "lucide-react";
import { useIsDark, useTokens, PageHeader, formatDA, ORANGE } from "../_ui";
import {
  getProducts, createProduct, updateProduct, deleteProduct, sellProduct, type Product, type ProductSummary,
} from "@/lib/products";

type OrderMode = "stock" | "save";

export default function ProduitsPage() {
  const isDark = useIsDark();
  const t = useTokens(isDark);

  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<ProductSummary>({ total_products: 0, in_stock: 0, out_of_stock: 0, total_units: 0, stock_value: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  // demo-only client state
  const [credits, setCredits] = useState(12);
  const [images, setImages] = useState<Record<number, string>>({});       // productId -> gradient seed
  const [orderModes, setOrderModes] = useState<Record<number, OrderMode>>({});

  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [aiFor, setAiFor] = useState<Product | null>(null);
  const [landingFor, setLandingFor] = useState<Product | null>(null);

  const load = useCallback(async (s?: string) => {
    setLoading(true); setError("");
    try {
      const res = await getProducts(s);
      if (res.success && res.data) { setProducts(res.data.products); setSummary(res.data.summary); }
      else setError(res.message || "Erreur de chargement");
    } catch { setError("Erreur de connexion"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSell(p: Product) {
    setBusy(p.id);
    const res = await sellProduct(p.id, 1);
    if (res.success) await load(search);
    else setError(res.message || "Stock insuffisant");
    setBusy(null);
  }
  async function handleDelete(p: Product) {
    setBusy(p.id);
    await deleteProduct(p.id);
    await load(search);
    setBusy(null);
  }

  return (
    <div style={{ fontFamily: "var(--font-jakarta, sans-serif)" }}>
      <PageHeader
        title="Mes Produits"
        subtitle="Catalogue & stock — la vente déduit automatiquement du stock"
        icon={Boxes}
        t={t}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, background: "#8b5cf618", color: "#8b5cf6", fontSize: 12.5, fontWeight: 700 }}>
              <Coins size={15} /> {credits} crédits IA
            </span>
            <button onClick={() => load(search)} disabled={loading} style={ghostBtn(t)}>
              <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            </button>
            <button onClick={() => setEditing("new")} style={primaryBtn}><Plus size={15} /> Ajouter un produit</button>
          </div>
        }
      />

      {/* KPIs */}
      <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <Kpi label="Produits" value={String(summary.total_products)} icon={Package} accent={ORANGE} t={t} />
        <Kpi label="En stock" value={String(summary.in_stock)} icon={Check} accent="#22c55e" t={t} />
        <Kpi label="Unités totales" value={String(summary.total_units)} icon={Layers} accent="#3b82f6" t={t} />
        <Kpi label="Valeur du stock" value={formatDA(summary.stock_value)} icon={Wallet} accent="#16a34a" t={t} />
      </div>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 360, marginBottom: 18 }}>
        <Search size={15} color={t.textFaint} style={{ position: "absolute", left: 12, top: 11 }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(search)}
          placeholder="Rechercher un produit…"
          style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 9, fontSize: 13.5, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none" }} />
      </div>

      {error && <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: 13 }}>{error}</div>}

      {loading && products.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: t.textMuted }}><Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} /></div>
      ) : products.length === 0 ? (
        <div style={{ padding: 50, textAlign: "center", color: t.textMuted, background: t.card, border: `1px dashed ${t.border}`, borderRadius: 14 }}>
          <Boxes size={34} color={t.textFaint} style={{ marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: t.text, marginBottom: 4 }}>Aucun produit</div>
          <div style={{ fontSize: 13 }}>Ajoutez votre premier produit pour gérer le stock et vendre.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {products.map((p) => {
            const seed = images[p.id];
            const low = p.stock > 0 && p.stock <= 5;
            const out = p.stock <= 0;
            const mode = orderModes[p.id] ?? "stock";
            return (
              <div key={p.id} style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 14, overflow: "hidden", boxShadow: t.shadow, display: "flex", flexDirection: "column" }}>
                {/* image */}
                <div style={{
                  height: 120, position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                  background: seed ? `linear-gradient(135deg, ${seed}, ${ORANGE})` : (isDark ? "#0b0e16" : "#f4f4f5"),
                }}>
                  {seed ? (
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, textShadow: "0 1px 4px rgba(0,0,0,.4)", padding: "0 14px", textAlign: "center" }}>{p.name}</span>
                  ) : (
                    <ImageIcon size={28} color={t.textFaint} />
                  )}
                  {seed && <span style={{ position: "absolute", top: 8, left: 8, fontSize: 10, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.35)", padding: "3px 7px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}><Sparkles size={10} /> IA</span>}
                  <span style={{ position: "absolute", top: 8, right: 8, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                    background: out ? "#ef444422" : low ? "#f59e0b22" : "#22c55e22", color: out ? "#ef4444" : low ? "#f59e0b" : "#22c55e" }}>
                    {out ? "Rupture" : `${p.stock} en stock`}
                  </span>
                </div>

                {/* body */}
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: t.text, lineHeight: 1.25 }}>{p.name}</div>
                    {p.sku && <div style={{ fontSize: 11.5, color: t.textFaint, fontFamily: "monospace", marginTop: 2 }}>SKU · {p.sku}</div>}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: ORANGE }}>{formatDA(Number(p.price))}</div>
                  <div style={{ fontSize: 11, color: t.textFaint }}>
                    Commande → {mode === "stock" ? "déduit du stock" : "enregistrée seulement"}
                  </div>

                  {/* actions */}
                  <div style={{ display: "flex", gap: 6, marginTop: "auto", flexWrap: "wrap" }}>
                    <button onClick={() => handleSell(p)} disabled={out || busy === p.id} title="Vendre 1 (déduit du stock)"
                      style={{ ...miniBtn(t), color: out ? t.textFaint : "#22c55e", borderColor: out ? t.border : "#22c55e44", flex: 1 }}>
                      {busy === p.id ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <ShoppingCart size={13} />} Vendre
                    </button>
                    <button onClick={() => setAiFor(p)} title="Générer image (IA)" style={{ ...miniBtn(t), color: "#8b5cf6", borderColor: "#8b5cf644" }}><Sparkles size={14} /></button>
                    <button onClick={() => setLandingFor(p)} title="Landing page" style={{ ...miniBtn(t), color: "#3b82f6", borderColor: "#3b82f644" }}><Globe size={14} /></button>
                    <button onClick={() => setEditing(p)} title="Modifier" style={miniBtn(t)}><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(p)} title="Supprimer" style={{ ...miniBtn(t), color: "#ef4444", borderColor: "#ef444444" }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {editing && (
        <ProductModal
          t={t}
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(search); }}
        />
      )}

      {/* AI image modal */}
      {aiFor && (
        <AiImageModal
          t={t} product={aiFor} credits={credits}
          onClose={() => setAiFor(null)}
          onGenerated={(seed) => { setImages((m) => ({ ...m, [aiFor.id]: seed })); setCredits((c) => Math.max(0, c - 1)); }}
        />
      )}

      {/* Landing page modal */}
      {landingFor && (
        <LandingModal
          t={t} product={landingFor}
          mode={orderModes[landingFor.id] ?? "stock"}
          onMode={(m) => setOrderModes((o) => ({ ...o, [landingFor.id]: m }))}
          onClose={() => setLandingFor(null)}
        />
      )}
    </div>
  );
}

/* ── Product add/edit ─────────────────────────────────────── */
function ProductModal({ t, product, onClose, onSaved }: { t: ReturnType<typeof useTokens>; product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product?.name ?? "", sku: product?.sku ?? "",
    price: product ? String(product.price) : "", stock: product ? String(product.stock) : "",
    description: product?.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!form.name.trim()) { setErr("Le nom est requis"); return; }
    setSaving(true); setErr("");
    const payload = { name: form.name, sku: form.sku || null, price: Number(form.price) || 0, stock: parseInt(form.stock) || 0, description: form.description || null };
    const res = product ? await updateProduct(product.id, payload) : await createProduct(payload);
    setSaving(false);
    if (res.success) onSaved(); else setErr(res.message || "Erreur");
  }

  return (
    <Shell t={t} title={product ? "Modifier le produit" : "Nouveau produit"} onClose={onClose}>
      {err && <div style={{ padding: "9px 12px", borderRadius: 8, marginBottom: 12, background: "#ef444415", color: "#ef4444", fontSize: 12.5 }}>{err}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Nom du produit" t={t} full><input style={inp(t)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="T-shirt coton noir" /></Field>
        <Field label="SKU / Référence" t={t}><input style={{ ...inp(t), fontFamily: "monospace" }} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="TS-NOIR-L" /></Field>
        <Field label="Prix de vente (DA)" t={t}><input type="number" style={inp(t)} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="2500" /></Field>
        <Field label="Stock initial" t={t}><input type="number" style={inp(t)} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="50" /></Field>
        <Field label="Description" t={t} full><textarea rows={3} style={{ ...inp(t), resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={ghostBtn(t)}>Annuler</button>
        <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={15} />} Enregistrer</button>
      </div>
    </Shell>
  );
}

/* ── AI image generator (simulated, costs credits) ────────── */
const PALETTE = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
function AiImageModal({ t, product, credits, onClose, onGenerated }: { t: ReturnType<typeof useTokens>; product: Product; credits: number; onClose: () => void; onGenerated: (seed: string) => void }) {
  const [prompt, setPrompt] = useState(`Photo studio de "${product.name}", fond épuré, éclairage doux`);
  const [phase, setPhase] = useState<"idle" | "gen" | "done">("idle");
  const [seed, setSeed] = useState(PALETTE[0]);

  function generate() {
    if (credits <= 0) return;
    setPhase("gen");
    const picked = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    setSeed(picked);
    setTimeout(() => { setPhase("done"); onGenerated(picked); }, 1400);
  }

  return (
    <Shell t={t} title="Générer une image par IA" onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#8b5cf6", fontWeight: 600, marginBottom: 14 }}>
        <Coins size={15} /> Coût : 1 crédit · Solde : {credits} crédits
      </div>
      <div style={{ height: 160, borderRadius: 12, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
        background: phase === "done" ? `linear-gradient(135deg, ${seed}, ${ORANGE})` : (t.codeBg) }}>
        {phase === "gen" ? <Loader2 size={26} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
          : phase === "done" ? <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, textShadow: "0 1px 6px rgba(0,0,0,.4)" }}>{product.name}</span>
          : <span style={{ color: t.textFaint, fontSize: 13 }}>Aperçu de l'image générée</span>}
      </div>
      <Field label="Prompt" t={t}><textarea rows={2} style={{ ...inp(t), resize: "vertical" }} value={prompt} onChange={(e) => setPrompt(e.target.value)} /></Field>
      <p style={{ fontSize: 11, color: t.textFaint, marginTop: 8 }}>Démo — la génération réelle (Gemini / Nano Banana) se branche sur ce même flux.</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button onClick={onClose} style={ghostBtn(t)}>Fermer</button>
        <button onClick={generate} disabled={credits <= 0 || phase === "gen"} style={{ ...primaryBtn, background: "#8b5cf6", opacity: credits <= 0 ? 0.5 : 1 }}>
          <Sparkles size={15} /> {phase === "done" ? "Régénérer (1 crédit)" : "Générer (1 crédit)"}
        </button>
      </div>
    </Shell>
  );
}

/* ── Landing page generator ───────────────────────────────── */
function LandingModal({ t, product, mode, onMode, onClose }: { t: ReturnType<typeof useTokens>; product: Product; mode: OrderMode; onMode: (m: OrderMode) => void; onClose: () => void }) {
  const slug = (product.sku || product.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const url = `https://shop.delivery.dz/p/${slug || product.id}`;
  const [copied, setCopied] = useState(false);
  return (
    <Shell t={t} title="Page de vente (Landing)" onClose={onClose}>
      <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 16px" }}>
        Une page de commande prête à l'emploi pour <b style={{ color: t.text }}>{product.name}</b>. Les commandes arrivent directement dans votre espace.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 18 }}>
        <code style={{ flex: 1, padding: "10px 12px", borderRadius: 9, background: t.codeBg, color: "#e2e8f0", fontSize: 12.5, fontFamily: "monospace", overflowX: "auto", whiteSpace: "nowrap" }}>{url}</code>
        <button onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1400); }} style={ghostBtn(t)}>{copied ? <Check size={14} color="#22c55e" /> : "Copier"}</button>
        <a href={url} target="_blank" rel="noreferrer" style={{ ...ghostBtn(t), display: "inline-flex", alignItems: "center", textDecoration: "none" }}><ExternalLink size={14} /></a>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 8 }}>À la réception d'une commande</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <ModeCard active={mode === "stock"} onClick={() => onMode("stock")} t={t} title="Déduire du stock" desc="La commande crée un colis et décrémente le stock automatiquement." accent="#22c55e" />
        <ModeCard active={mode === "save"} onClick={() => onMode("save")} t={t} title="Enregistrer seulement" desc="La commande est sauvegardée pour validation manuelle, sans toucher au stock." accent="#3b82f6" />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={primaryBtn}>Terminé</button>
      </div>
    </Shell>
  );
}

function ModeCard({ active, onClick, t, title, desc, accent }: { active: boolean; onClick: () => void; t: ReturnType<typeof useTokens>; title: string; desc: string; accent: string }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", padding: 14, borderRadius: 12, cursor: "pointer",
      background: active ? accent + "0e" : t.card, border: `1.5px solid ${active ? accent : t.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${active ? accent : t.textFaint}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {active && <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />}
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{title}</span>
      </div>
      <div style={{ fontSize: 11.5, color: t.textMuted, lineHeight: 1.5 }}>{desc}</div>
    </button>
  );
}

/* ── shared bits ──────────────────────────────────────────── */
function Kpi({ label, value, icon: Icon, accent, t }: { label: string; value: string; icon: React.ElementType; accent: string; t: ReturnType<typeof useTokens> }) {
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

function Shell({ children, onClose, t, title }: { children: React.ReactNode; onClose: () => void; t: ReturnType<typeof useTokens>; title: string }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", background: t.card, border: `1px solid ${t.border}`, borderRadius: 16, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: t.text }}>{title}</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", color: t.textFaint, cursor: "pointer" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, t, full }: { label: string; children: React.ReactNode; t: ReturnType<typeof useTokens>; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.textSub, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const primaryBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, background: ORANGE, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghostBtn = (t: ReturnType<typeof useTokens>): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, background: t.card, color: t.textSub, border: `1px solid ${t.border}`, fontSize: 13, fontWeight: 600, cursor: "pointer" });
const miniBtn = (t: ReturnType<typeof useTokens>): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 9px", borderRadius: 8, background: "transparent", color: t.textSub, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 600, cursor: "pointer" });
const inp = (t: ReturnType<typeof useTokens>): React.CSSProperties => ({ width: "100%", padding: "9px 11px", borderRadius: 8, fontSize: 13, background: t.inp.bg, border: `1px solid ${t.inp.border}`, color: t.inp.text, outline: "none", fontFamily: "inherit" });
