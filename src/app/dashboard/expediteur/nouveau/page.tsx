"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Truck,
  ArrowLeftRight,
  Banknote,
  X,
  User,
  MapPin,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Package2,
  ReceiptText,
  Tag,
  RefreshCw,
  Zap,
  Store,
  Printer,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, getStoredUser } from "@/lib/api";
import PackageLabel from "@/components/PackageLabel";
import { createExpPackage } from "@/lib/expediteur";
import { lookupTariff, type ServiceType as TariffServiceType, type DeliveryMode } from "@/lib/tarification";
import type { Wilaya, Commune, StopDesk } from "@/lib/geography";

/* ── Extended user shape (localStorage may have extra fields) ──────────── */
interface ExpUser {
  id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  company_name?: string | null;
  wilaya_id?: number | null;
  stop_desk_id?: number | null;
}

/* ── Service type definitions ──────────────────────────────────────────── */
const SERVICE_CARDS: {
  type: string;
  tariffKey: TariffServiceType;
  icon: React.ElementType;
  label: string;
}[] = [
  { type: "livraison",    tariffKey: "delivery",     icon: Truck,          label: "LIVRAISON"    },
  { type: "echange",      tariffKey: "exchange",     icon: ArrowLeftRight, label: "ÉCHANGE"      },
  { type: "recouvrement", tariffKey: "recouvrement", icon: Banknote,       label: "RECOUVREMENT" },
];

const SERVICE_LABELS: Record<string, string> = {
  livraison: "Livraison",
  echange: "Échange",
  recouvrement: "Recouvrement",
};

/* ── Receipt sub-components (always on dark bg) ────────────────────────── */
function ReceiptRow({ label, value, truncate }: {
  label: string;
  value: React.ReactNode;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-[5px]">
      <span className="text-slate-500 text-[11px] shrink-0 font-mono">{label}</span>
      <span className={cn("text-slate-300 text-[11px] text-right font-mono", truncate && "truncate max-w-[140px]")}>
        {value}
      </span>
    </div>
  );
}

function RDivider() {
  return <div className="border-t border-white/10 border-dashed my-1.5" />;
}

function Placeholder() {
  return <span className="text-slate-600">—</span>;
}

/* ── Section header ─────────────────────────────────────────────────────── */
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 dark:bg-[#0a0d14] border-b border-slate-200 dark:border-[#1e2130] rounded-t-xl">
      <Icon className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" />
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 dark:text-[#6b7280]">
        {label}
      </span>
    </div>
  );
}

/* ── Shared class constants ─────────────────────────────────────────────── */
const inputCls =
  "w-full bg-transparent border-b border-slate-300 dark:border-[#2a3145] py-2 text-[13.5px] " +
  "text-slate-900 dark:text-[#f0f0f5] placeholder:text-slate-400 dark:placeholder:text-[#3a4560] " +
  "focus:outline-none focus:border-orange-400 transition-colors [color-scheme:light] dark:[color-scheme:dark]";

const labelCls =
  "block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#52525b] mb-1";

/* ── Component ─────────────────────────────────────────────────────────── */
export default function NouveauColisPage() {
  const formRef = useRef<HTMLFormElement>(null);

  /* ── User ── */
  const [user, setUser] = useState<ExpUser | null>(null);

  /* ── Reference data ── */
  const [stopDesks, setStopDesks] = useState<StopDesk[]>([]);
  const [wilayas, setWilayas]     = useState<Wilaya[]>([]);
  const [communes, setCommunes]   = useState<Commune[]>([]);
  const [destSDs, setDestSDs]     = useState<StopDesk[]>([]);
  const [loading, setLoading]     = useState(true);

  /* ── Form fields ── */
  const [originSdId, setOriginSdId]                   = useState<number | "">("");
  const [serviceType, setServiceType]                 = useState("livraison");
  const [recipientName, setRecipientName]             = useState("");
  const [recipientPhone, setRecipientPhone]           = useState("");
  const [destWilayaId, setDestWilayaId]               = useState<number | "">("");
  const [destCommuneId, setDestCommuneId]             = useState<number | "">("");
  const [recipientAddress, setRecipientAddress]       = useState("");
  const [deliveryType, setDeliveryType]               = useState<"home_delivery" | "stop_desk">("home_delivery");
  const [destStopDeskId, setDestStopDeskId]           = useState<number | "">("");
  const [contentDesc, setContentDesc]                 = useState("");
  const [codAmount, setCodAmount]                     = useState("");
  const [weight, setWeight]                           = useState("");
  const [paymentType, setPaymentType]                 = useState<"sender" | "recipient">("recipient");
  const [fragile, setFragile]                         = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [exchangeProduct, setExchangeProduct]         = useState("");

  /* ── Tariff ── */
  const [shippingCost, setShippingCost]   = useState<number | null>(null);
  const [tariffSource, setTariffSource]   = useState<string | null>(null);
  const [tariffLoading, setTariffLoading] = useState(false);

  /* ── Submit ── */
  const [submitting, setSubmitting]         = useState(false);
  const [success, setSuccess]               = useState(false);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [createdPackage, setCreatedPackage] = useState<any>(null);
  const [showLabel, setShowLabel]           = useState(false);
  const [error, setError]                   = useState<string | null>(null);

  /* debounce ref for tariff */
  const tariffTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Init: load user + reference data, derive origin SD from account ── */
  useEffect(() => {
    async function init() {
      const stored = getStoredUser();
      const u = stored as unknown as ExpUser;
      setUser(u);

      const sdRes = await api<StopDesk[]>("/stop-desks");
      const desks = sdRes.success && sdRes.data ? sdRes.data : [];
      if (desks.length) setStopDesks(desks);

      // Origin SD is derived from the expéditeur's account (no manual choice):
      // prefer the account's assigned stop desk, else the first SD in their wilaya.
      const originId =
        u?.stop_desk_id ??
        desks.find((sd) => sd.commune?.wilaya_id === u?.wilaya_id)?.id ??
        "";
      setOriginSdId(originId || "");

      const wRes = await api<Wilaya[]>(`/wilayas${originId ? `?origin_sd_id=${originId}` : ""}`);
      if (wRes.success && wRes.data) setWilayas(wRes.data);
      setLoading(false);
    }
    init();
  }, []);

  /* ── Fetch communes when dest wilaya changes ── */
  useEffect(() => {
    if (!destWilayaId) { setCommunes([]); setDestCommuneId(""); return; }
    let cancelled = false;
    (async () => {
      const res = await api<Commune[]>(`/wilayas/${destWilayaId}/communes`);
      if (!cancelled && res.success && res.data) setCommunes(res.data);
    })();
    return () => { cancelled = true; };
  }, [destWilayaId]);

  /* ── Fetch destination SDs when commune changes (for stop_desk delivery) ── */
  const [destSDsLoading, setDestSDsLoading] = useState(false);
  useEffect(() => {
    if (!destCommuneId || deliveryType !== "stop_desk") { setDestSDs([]); setDestStopDeskId(""); return; }
    let cancelled = false;
    setDestSDsLoading(true);
    (async () => {
      // 1. Check SDs in the commune
      const res = await api<StopDesk[]>(`/communes/${destCommuneId}/stop-desks`);
      if (cancelled) return;
      if (res.success && res.data && res.data.length > 0) {
        setDestSDs(res.data);
        setDestSDsLoading(false);
        return;
      }
      // 2. No SD in commune — check assigned SD via delivery_stop_desk_id
      const commune = communes.find(c => c.id === Number(destCommuneId));
      if (commune?.delivery_stop_desk_id) {
        const sd = stopDesks.find(s => s.id === commune.delivery_stop_desk_id);
        if (sd) { setDestSDs([sd]); setDestSDsLoading(false); return; }
      }
      // 3. Fallback: query commune from backend for delivery_stop_desk_id
      const cRes = await api<any>(`/communes?wilaya_id=${destWilayaId}`);
      if (cancelled) return;
      const match = (cRes.data ?? []).find((c: any) => c.id === Number(destCommuneId));
      if (match?.delivery_stop_desk_id) {
        const sd = stopDesks.find(s => s.id === match.delivery_stop_desk_id);
        if (sd) { setDestSDs([sd]); setDestSDsLoading(false); return; }
      }
      setDestSDs([]);
      setDestSDsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [destCommuneId, deliveryType, destWilayaId, communes, stopDesks]);

  // Auto-select destination SD when only 1 option
  useEffect(() => {
    if (destSDs.length === 1 && deliveryType === "stop_desk") {
      setDestStopDeskId(destSDs[0].id);
    }
  }, [destSDs, deliveryType]);

  /* ── Auto-calculate tariff ── */
  const calcTariff = useCallback(() => {
    if (!user?.id) return;
    const originSD = stopDesks.find(sd => sd.id === originSdId);
    const departureWilayaId = originSD?.commune?.wilaya_id;
    if (!departureWilayaId || !destWilayaId) { setShippingCost(null); setTariffSource(null); return; }

    const svc = SERVICE_CARDS.find(s => s.type === serviceType);
    if (!svc) return;

    const mode: DeliveryMode = deliveryType === "stop_desk" ? "desk" : "home";

    setTariffLoading(true);
    lookupTariff({
      user_id: user.id,
      departure_wilaya_id: departureWilayaId,
      destination_wilaya_id: Number(destWilayaId),
      service_type: svc.tariffKey,
      delivery_mode: mode,
    }).then(res => {
      if (res.success && res.data) {
        setShippingCost(res.data.price);
        setTariffSource(res.data.source);
      } else {
        setShippingCost(null);
        setTariffSource(null);
      }
    }).finally(() => setTariffLoading(false));
  }, [user, originSdId, destWilayaId, serviceType, deliveryType, stopDesks]);

  useEffect(() => {
    if (tariffTimer.current) clearTimeout(tariffTimer.current);
    tariffTimer.current = setTimeout(calcTariff, 400);
    return () => { if (tariffTimer.current) clearTimeout(tariffTimer.current); };
  }, [calcTariff]);

  /* ── Reset commune-bound SD when delivery type toggles ── */
  useEffect(() => {
    if (deliveryType === "home_delivery") { setDestStopDeskId(""); }
  }, [deliveryType]);

  /* ── Ctrl+Enter to submit ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") formRef.current?.requestSubmit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Submit ── */
  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!originSdId) { setError("Aucun point de dépôt disponible pour votre compte."); return; }
    if (!recipientName.trim()) { setError("Le nom du destinataire est requis."); return; }
    if (!recipientPhone.trim()) { setError("Le téléphone du destinataire est requis."); return; }
    if (!destWilayaId) { setError("Veuillez sélectionner la wilaya de destination."); return; }
    if (!contentDesc.trim()) { setError("La description du contenu est requise."); return; }
    if (deliveryType === "stop_desk" && !destStopDeskId && destSDs.length > 0) {
      setError("Veuillez sélectionner un point de retrait."); return;
    }
    if (serviceType === "echange" && !exchangeProduct.trim()) {
      setError("Produit à récupérer requis pour un échange."); return;
    }

    setSubmitting(true);
    const payload: Record<string, unknown> = {
      origin_stop_desk_id: originSdId,
      service_type: serviceType,
      recipient_name: recipientName.trim(),
      recipient_phone: recipientPhone.trim(),
      recipient_wilaya_id: destWilayaId,
      recipient_commune_id: destCommuneId || null,
      recipient_address: recipientAddress.trim() || null,
      delivery_type: deliveryType,
      destination_stop_desk_id: deliveryType === "stop_desk" ? destStopDeskId : null,
      content_description: contentDesc.trim(),
      cod_amount: codAmount ? parseFloat(codAmount) : 0,
      weight: weight ? parseFloat(weight) : null,
      payment_type: paymentType,
      fragile,
      special_instructions: specialInstructions.trim() || null,
    };
    if (serviceType === "echange") {
      payload.exchange_product = exchangeProduct.trim() || null;
    }

    const res = await createExpPackage(payload as Record<string, any>);
    setSubmitting(false);

    if (res.success && res.data) {
      const dhdTr = (res as any).dhd_tracking ?? res.data.external_shipment?.external_tracking;
      setTrackingNumber(dhdTr || res.data.tracking_number);
      setCreatedPackage(res.data);
      setSuccess(true);
    } else {
      const msgs = res.errors
        ? Object.values(res.errors).flat().join(", ")
        : res.message || "Erreur lors de la création.";
      setError(msgs);
    }
  }

  /* ── Reset form (keep derived origin + service) ── */
  function handleReset() {
    setRecipientName("");
    setRecipientPhone("");
    setDestWilayaId("");
    setDestCommuneId("");
    setRecipientAddress("");
    setDeliveryType("home_delivery");
    setDestStopDeskId("");
    setContentDesc("");
    setCodAmount("");
    setWeight("");
    setPaymentType("recipient");
    setFragile(false);
    setSpecialInstructions("");
    setExchangeProduct("");
    setShippingCost(null);
    setTariffSource(null);
    setSuccess(false);
    setTrackingNumber(null);
    setCreatedPackage(null);
    setError(null);
  }

  /* ── Copy tracking ── */
  function copyTracking() {
    if (trackingNumber) navigator.clipboard.writeText(trackingNumber);
  }

  /* ── Resolve names for receipt preview ── */
  const destWilayaName  = wilayas.find(w => w.id === destWilayaId)?.name ?? "";
  const destCommuneName = communes.find(c => c.id === destCommuneId)?.name ?? "";
  const originSD        = stopDesks.find(sd => sd.id === originSdId);
  const originSDName    = originSD ? `${originSD.name}${originSD.code ? ` (${originSD.code})` : ""}` : "";
  const selectedDestSD  = destSDs.find(sd => sd.id === destStopDeskId);

  const codNum   = parseFloat(codAmount) || 0;
  const totalDue = codNum + (shippingCost ?? 0);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="-m-6 md:-m-8 h-[calc(100vh-60px)] flex items-center justify-center bg-slate-50 dark:bg-[#0e1017]">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="-m-6 md:-m-8 h-[calc(100vh-60px)] flex flex-col overflow-hidden bg-slate-50 dark:bg-[#0e1017]">
      <style>{`
        .pos-scroll::-webkit-scrollbar { width: 5px; }
        .pos-scroll::-webkit-scrollbar-track { background: transparent; }
        .pos-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
        .pos-scroll::-webkit-scrollbar-thumb:hover { background: #f97316; }
        .dark .pos-scroll::-webkit-scrollbar-thumb { background: #1e2a40; }
        .dark .pos-scroll::-webkit-scrollbar-thumb:hover { background: #f97316; }

        .receipt-scroll::-webkit-scrollbar { width: 4px; }
        .receipt-scroll::-webkit-scrollbar-track { background: transparent; }
        .receipt-scroll::-webkit-scrollbar-thumb { background: #1e2a40; border-radius: 9999px; }
        .receipt-scroll::-webkit-scrollbar-thumb:hover { background: #f97316; }

        /* Form controls — dark mode */
        .dark .pos-form select,
        .dark .pos-form input,
        .dark .pos-form textarea {
          color: #e2e8f0 !important;
          background-color: transparent !important;
          color-scheme: dark;
        }
        .dark .pos-form select option {
          background-color: #1e2130;
          color: #e2e8f0;
        }
        .dark .pos-form select {
          background-color: #0f1623 !important;
        }
      `}</style>

      {/* ── Success banner ─────────────────────────────────────────────── */}
      {success && trackingNumber && (
        <div className="flex items-center justify-between px-5 py-3 bg-emerald-500 text-white shrink-0 z-10 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-medium">
              Colis créé —{" "}
              <strong className="font-mono text-[12px]">{trackingNumber}</strong>
            </span>
            <button
              onClick={copyTracking}
              title="Copier"
              className="p-1 rounded hover:bg-white/20 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLabel(true)}
              className="flex items-center gap-1.5 text-[11px] font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Printer className="w-3 h-3" />
              Imprimer
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-[11px] font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Créer un autre
            </button>
            <button
              onClick={() => setSuccess(false)}
              className="p-1 rounded hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showLabel && createdPackage && (
        <PackageLabel pkg={createdPackage} onClose={() => setShowLabel(false)} />
      )}

      {/* ── Two-panel layout ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT — Form ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 pos-scroll">
          <form ref={formRef} onSubmit={handleSubmit} className="h-full flex flex-col p-4 pos-form">

            {/* Page header + service-type selector */}
            <div className="flex items-center justify-between gap-3 mb-3 shrink-0 flex-wrap">
              <div className="shrink-0">
                <h1 className="text-[16px] font-bold text-slate-900 dark:text-[#f5f5f5] tracking-tight leading-none">
                  Nouveau Colis
                </h1>
                <p className="text-[10px] text-slate-400 dark:text-[#52525b] mt-1 uppercase tracking-wide">
                  Espace expéditeur — créer un envoi
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {SERVICE_CARDS.map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setServiceType(type)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-[11px] font-bold tracking-wide transition-all cursor-pointer",
                      serviceType === type
                        ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 shadow-sm"
                        : "border-slate-200 dark:border-[#1e2130] bg-white dark:bg-[#161b27] text-slate-500 dark:text-[#a1a1aa] hover:border-slate-300 dark:hover:border-[#2a3145]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-[#52525b] bg-white dark:bg-[#161b27] border border-slate-200 dark:border-[#1e2130] px-2.5 py-1.5 rounded-lg">
                  <Zap className="w-3 h-3 text-orange-400" />
                  Ctrl+Enter
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-3 py-2 mb-3 shrink-0 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-[12px] text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" />
                {error}
              </div>
            )}

            {/* ── Dense 3-column form grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-y-auto pos-scroll pr-1 content-start">

              {/* ── Column 1 — Expéditeur + Destinataire ── */}
              <div className="space-y-4 min-w-0">

                {/* Expéditeur (account, read-only) */}
                <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e2130] shadow-sm">
                  <SectionHeader icon={User} label="Expéditeur" />
                  <div className="p-3">
                    <div className="flex items-center gap-2.5 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/40 rounded-lg">
                      <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800 dark:text-[#f5f5f5] truncate">
                          {user ? `${user.first_name} ${user.last_name}` : "—"}
                          {user?.company_name && (
                            <span className="text-slate-400 dark:text-[#52525b] font-normal ml-1 text-[11px]">
                              ({user.company_name})
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#6b7280] truncate">
                          {user?.phone || "—"}
                          {originSDName && <span> · {originSDName}</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Destinataire */}
                <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e2130] shadow-sm">
                  <SectionHeader icon={MapPin} label="Destinataire" />
                  <div className="p-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>
                          Nom complet <span className="text-orange-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          placeholder="Nom du destinataire"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>
                          Téléphone <span className="text-orange-500">*</span>
                        </label>
                        <input
                          type="tel"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="0XX XXX XXXX"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>
                          Wilaya <span className="text-orange-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={destWilayaId}
                            onChange={(e) => {
                              setDestWilayaId(e.target.value ? Number(e.target.value) : "");
                              setDestCommuneId("");
                              setDestStopDeskId("");
                            }}
                            className={cn(inputCls, "appearance-none cursor-pointer")}
                          >
                            <option value="">— Sélectionner —</option>
                            {wilayas.map((w) => (
                              <option key={w.id} value={w.id}>{w.code ? `${w.code} - ${w.name}` : w.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-0 top-2.5 w-3.5 h-3.5 text-slate-300 dark:text-[#3a4560] pointer-events-none" />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Commune</label>
                        <div className="relative">
                          <select
                            value={destCommuneId}
                            onChange={(e) => {
                              setDestCommuneId(e.target.value ? Number(e.target.value) : "");
                              setDestStopDeskId("");
                            }}
                            disabled={!destWilayaId}
                            className={cn(
                              inputCls,
                              "appearance-none cursor-pointer",
                              !destWilayaId && "opacity-40 cursor-not-allowed"
                            )}
                          >
                            <option value="">— Commune —</option>
                            {communes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <ChevronDown className="absolute right-0 top-2.5 w-3.5 h-3.5 text-slate-300 dark:text-[#3a4560] pointer-events-none" />
                        </div>
                      </div>
                    </div>

                    {deliveryType === "home_delivery" && (
                      <div>
                        <label className={labelCls}>Adresse de livraison</label>
                        <input
                          type="text"
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          placeholder="N° rue, quartier, bâtiment..."
                          className={inputCls}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>{/* end Column 1 */}

              {/* ── Column 2 — Mode de livraison + Paiement ── */}
              <div className="space-y-4 min-w-0">

                {/* Mode de livraison */}
                <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e2130] shadow-sm">
                  <SectionHeader icon={Truck} label="Mode de livraison" />
                  <div className="p-3 space-y-2.5">
                    <div className="inline-flex bg-slate-100 dark:bg-[#1a1f2e] rounded-lg p-0.5">
                      {([
                        { v: "home_delivery" as const, label: "À domicile" },
                        { v: "stop_desk"     as const, label: "Stop Desk"  },
                      ]).map(({ v, label }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => { setDeliveryType(v); setDestStopDeskId(""); }}
                          className={cn(
                            "px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all",
                            deliveryType === v
                              ? "bg-white dark:bg-[#0e1017] shadow-sm text-slate-900 dark:text-[#f5f5f5]"
                              : "text-slate-500 dark:text-[#52525b] hover:text-slate-700 dark:hover:text-[#a1a1aa]"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {deliveryType === "stop_desk" && (
                      <div>
                        {!destCommuneId ? (
                          <p className="text-[11px] text-slate-400 dark:text-[#6b7280]">
                            Sélectionnez la commune du destinataire d&apos;abord
                          </p>
                        ) : destSDsLoading ? (
                          <p className="text-[11px] text-slate-400 dark:text-[#6b7280]">Chargement...</p>
                        ) : destSDs.length === 0 ? (
                          <p className="text-[11px] text-amber-500">
                            Aucun point de retrait — utilisez « À domicile »
                          </p>
                        ) : destSDs.length === 1 ? (
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[12px] font-medium text-slate-700 dark:text-[#d1d5db]">
                              {destSDs[0].name}{destSDs[0].code ? ` (${destSDs[0].code})` : ""}
                            </span>
                            <span className="text-[10px] text-emerald-500 font-medium">Auto-sélectionné</span>
                          </div>
                        ) : (
                          <div>
                            <label className={labelCls}>
                              Point de retrait <span className="text-orange-500">*</span>
                            </label>
                            <div className="relative">
                              <select
                                value={destStopDeskId}
                                onChange={(e) => setDestStopDeskId(e.target.value ? Number(e.target.value) : "")}
                                className={cn(inputCls, "appearance-none cursor-pointer")}
                              >
                                <option value="">— Sélectionner —</option>
                                {destSDs.map((sd) => (
                                  <option key={sd.id} value={sd.id}>
                                    {sd.name}{sd.code ? ` (${sd.code})` : ""}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-0 top-2.5 w-3.5 h-3.5 text-slate-300 dark:text-[#3a4560] pointer-events-none" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Paiement */}
                <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e2130] shadow-sm">
                  <SectionHeader icon={CreditCard} label="Paiement" />
                  <div className="p-3 space-y-2.5">
                    <div>
                      <label className={labelCls}>Frais de port payés par</label>
                      <div className="inline-flex bg-slate-100 dark:bg-[#1a1f2e] rounded-lg p-0.5 mt-1">
                        {([
                          { v: "recipient" as const, label: "Destinataire" },
                          { v: "sender"    as const, label: "Expéditeur"   },
                        ]).map(({ v, label }) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setPaymentType(v)}
                            className={cn(
                              "px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all",
                              paymentType === v
                                ? "bg-white dark:bg-[#0e1017] shadow-sm text-slate-900 dark:text-[#f5f5f5]"
                                : "text-slate-500 dark:text-[#52525b] hover:text-slate-700 dark:hover:text-[#a1a1aa]"
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>{/* end Column 2 */}

              {/* ── Column 3 — Détails colis ── */}
              <div className="space-y-4 min-w-0">
                <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e2130] shadow-sm">
                  <SectionHeader icon={Package2} label="Détails colis" />
                  <div className="p-3 space-y-2.5">
                    <div>
                      <label className={labelCls}>
                        Description du contenu <span className="text-orange-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={contentDesc}
                        onChange={(e) => setContentDesc(e.target.value)}
                        placeholder="Ex : Vêtements, électronique, documents..."
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Montant COD (DA)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={codAmount}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "" || /^\d*\.?\d*$/.test(v)) setCodAmount(v);
                          }}
                          placeholder="0"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Poids (kg)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={weight}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "" || /^\d*\.?\d*$/.test(v)) setWeight(v);
                          }}
                          placeholder="0.0"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    {serviceType === "echange" && (
                      <div>
                        <label className={labelCls}>
                          Produit à récupérer <span className="text-orange-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={exchangeProduct}
                          onChange={(e) => setExchangeProduct(e.target.value)}
                          placeholder="Description du produit à collecter en échange"
                          className={inputCls}
                        />
                      </div>
                    )}

                    {/* Fragile toggle */}
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-[13px] font-medium text-slate-700 dark:text-[#c4c4cc]">
                          Colis fragile
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-[#52525b]">
                          Traitement avec précaution requis
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFragile(!fragile)}
                        className={cn(
                          "relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0",
                          fragile ? "bg-orange-500" : "bg-slate-200 dark:bg-[#2a3145]"
                        )}
                      >
                        <span className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                          fragile ? "translate-x-5" : "translate-x-0.5"
                        )} />
                      </button>
                    </div>

                    <div>
                      <label className={labelCls}>Instructions spéciales</label>
                      <textarea
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="Instructions particulières pour la livraison..."
                        rows={2}
                        className={cn(inputCls, "resize-none leading-relaxed")}
                      />
                    </div>
                  </div>
                </div>
              </div>{/* end Column 3 */}

            </div>{/* end form grid */}
          </form>
        </div>

        {/* ── RIGHT — Receipt + Submit ──────────────────────────────────── */}
        <div className="w-[280px] shrink-0 border-l border-slate-800 dark:border-[#1a1f2e] bg-slate-900 dark:bg-[#0a0d14] flex flex-col overflow-y-auto min-h-0 receipt-scroll">

          {/* Receipt header */}
          <div className="px-5 pt-5 pb-3 border-b border-slate-800 dark:border-[#1a1f2e]">
            <div className="flex items-center gap-2 text-orange-400 mb-1">
              <ReceiptText className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Récapitulatif</span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">N° Auto-généré</p>
          </div>

          {/* Receipt body */}
          <div className="flex-1 px-5 py-3">
            <ReceiptRow label="Origine" value={originSDName || <Placeholder />} truncate />

            <RDivider />

            <ReceiptRow label="Service" value={
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                serviceType === "livraison"    && "bg-blue-500/20 text-blue-300",
                serviceType === "echange"      && "bg-purple-500/20 text-purple-300",
                serviceType === "recouvrement" && "bg-orange-500/20 text-orange-300",
              )}>
                {SERVICE_LABELS[serviceType]}
              </span>
            } />

            <RDivider />

            <ReceiptRow label="Expéditeur" value={user ? `${user.first_name} ${user.last_name}` : <Placeholder />} truncate />
            {user?.phone && <ReceiptRow label="Tél exp." value={user.phone} />}

            <RDivider />

            <ReceiptRow label="Destinataire" value={recipientName || <Placeholder />} truncate />
            {recipientPhone && <ReceiptRow label="Tél dest." value={recipientPhone} />}
            <ReceiptRow label="Wilaya" value={destWilayaName || <Placeholder />} />
            {destCommuneName && <ReceiptRow label="Commune" value={destCommuneName} truncate />}

            <RDivider />

            <ReceiptRow label="Livraison" value={deliveryType === "home_delivery" ? "À domicile" : "Stop Desk"} />
            {deliveryType === "stop_desk" && selectedDestSD && (
              <ReceiptRow label="Point retrait" value={selectedDestSD.name} truncate />
            )}
            {deliveryType === "home_delivery" && recipientAddress && (
              <ReceiptRow label="Adresse" value={recipientAddress} truncate />
            )}

            <RDivider />

            {contentDesc && <ReceiptRow label="Contenu" value={contentDesc} truncate />}
            {weight && <ReceiptRow label="Poids" value={`${weight} kg`} />}
            <ReceiptRow label="Fragile" value={
              <span className={fragile ? "text-orange-400" : "text-slate-500"}>
                {fragile ? "Oui" : "Non"}
              </span>
            } />

            <RDivider />

            <ReceiptRow label="Frais" value={paymentType === "recipient" ? "Destinataire" : "Expéditeur"} />
            <ReceiptRow label="Livraison" value={
              tariffLoading ? (
                <span className="text-slate-500 text-[10px]">...</span>
              ) : shippingCost !== null ? (
                <span className="text-emerald-400 font-bold">{shippingCost.toLocaleString("fr-DZ")} DA</span>
              ) : (
                <Placeholder />
              )
            } />
            {tariffSource && (
              <ReceiptRow label="Source" value={
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded font-semibold",
                  tariffSource === "expediteur"
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-slate-500/20 text-slate-400"
                )}>
                  {tariffSource === "expediteur" ? "Tarif expéditeur" : "Tarif par défaut"}
                </span>
              } />
            )}
            <ReceiptRow label="COD" value={
              <span className="text-orange-300 font-bold">{codNum.toLocaleString("fr-DZ")} DA</span>
            } />

            <RDivider />
            <div className="flex justify-between items-center py-1">
              <span className="text-[11px] font-bold text-slate-300 dark:text-[#d1d5db] uppercase tracking-wide">Total</span>
              <span className="text-[14px] font-bold text-emerald-400">
                {totalDue.toLocaleString("fr-DZ")} DA
              </span>
            </div>

            {serviceType === "echange" && exchangeProduct && (
              <>
                <RDivider />
                <ReceiptRow label="À récupérer" value={exchangeProduct} truncate />
              </>
            )}

            {trackingNumber && (
              <>
                <RDivider />
                <div className="text-center pt-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Tracking</p>
                  <p className="text-[15px] font-bold text-orange-400 font-mono tracking-wide">{trackingNumber}</p>
                </div>
              </>
            )}
          </div>

          {/* Submit */}
          <div className="px-5 pb-5 pt-3 border-t border-slate-800 dark:border-[#1a1f2e] space-y-2 shrink-0">
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              disabled={submitting}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[14px] text-white transition-all",
                submitting
                  ? "bg-orange-400 cursor-not-allowed opacity-60"
                  : "bg-orange-500 hover:bg-orange-600 active:scale-[0.98]"
              )}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Création...</>
              ) : (
                <><Tag className="w-4 h-4" /> Créer le colis</>
              )}
            </button>
            <p className="text-center text-[10px] text-slate-500 font-mono">Ctrl + Enter</p>
          </div>
        </div>

      </div>
    </div>
  );
}
