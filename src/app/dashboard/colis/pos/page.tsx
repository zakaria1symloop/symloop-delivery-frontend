"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Truck,
  ArrowLeftRight,
  Banknote,
  Search,
  X,
  User,
  MapPin,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Package2,
  ReceiptText,
  Tag,
  RefreshCw,
  Zap,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createPackage,
  getContactStats,
  type CreatePackagePayload,
  type ServiceType,
  type DeliveryType,
  type ContactStats,
  SERVICE_LABELS,
} from "@/lib/packages";
import { getWalletSummary, type WalletSummary } from "@/lib/wallet";
import { getWilayas, getAllCommunes, getCommunes } from "@/lib/geography";
import type { Wilaya, Commune, StopDesk } from "@/lib/geography";
import { getClients, getUsers, createUser } from "@/lib/users";
import type { Client, StaffUser } from "@/lib/users";
import { api, getStoredUser, isSDLocked } from "@/lib/api";
import SDSelector from "@/components/SDSelector";
import type { User as ApiUser } from "@/lib/api";
import { getCaisses } from "@/lib/caisse";
import { lookupTariff, type TariffLookupResult } from "@/lib/tarification";
import { useAccess } from "../../_access";
import { Pencil } from "lucide-react";

// ── Service type card definitions ────────────────────────────────────────────
const SERVICE_CARDS: {
  type: ServiceType;
  icon: React.ElementType;
  label: string;
  sub: string;
}[] = [
  { type: "livraison",    icon: Truck,          label: "LIVRAISON",    sub: "Livraison standard"   },
  { type: "echange",      icon: ArrowLeftRight, label: "ÉCHANGE",      sub: "Livraison + collecte" },
  { type: "recouvrement", icon: Banknote,       label: "RECOUVREMENT", sub: "Collecte montant"     },
];

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

// ── Receipt sub-components (always on dark bg) ────────────────────────────────
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

// ── Section header ────────────────────────────────────────────────────────────
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

// ── Shared class constants ────────────────────────────────────────────────────
const inputCls =
  "w-full bg-transparent border-b border-slate-300 dark:border-[#2a3145] py-2 text-[13.5px] " +
  "text-slate-900 dark:text-[#f0f0f5] placeholder:text-slate-400 dark:placeholder:text-[#3a4560] " +
  "focus:outline-none focus:border-orange-400 transition-colors [color-scheme:light] dark:[color-scheme:dark]";

const labelCls =
  "block text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-[#52525b] mb-1";

// ── Main component ────────────────────────────────────────────────────────────
export default function POSPage() {
  const formRef           = useRef<HTMLFormElement>(null);
  const senderSearchRef    = useRef<HTMLDivElement>(null);
  const recipientSearchRef = useRef<HTMLDivElement>(null);

  // ── Reference data ─────────────────────────────────────────────────────────
  const [wilayas,   setWilayas]   = useState<Wilaya[]>([]);
  const [communes,  setCommunes]  = useState<Commune[]>([]);
  const [stopDesks, setStopDesks] = useState<StopDesk[]>([]);

  // ── Sender search (expediteur users) ────────────────────────────────────────
  const [senderClient,       setSenderClient]       = useState<StaffUser | null>(null);
  const [senderSearch,       setSenderSearch]       = useState("");
  const [senderResults,      setSenderResults]      = useState<StaffUser[]>([]);
  const [senderDropdownOpen, setSenderDropdownOpen] = useState(false);
  const [senderLoading,      setSenderLoading]      = useState(false);
  const debouncedSearch = useDebounce(senderSearch, 300);

  // ── Inline expediteur creation ────────────────────────────────────────────
  const [showCreateExp, setShowCreateExp] = useState(false);
  const [createExpForm, setCreateExpForm] = useState({ first_name: "", last_name: "", phone: "", company_name: "" });
  const [createExpLoading, setCreateExpLoading] = useState(false);
  const [createExpError, setCreateExpError] = useState("");

  // ── Contact stats + wallet ─────────────────────────────────────────────────
  const [senderStats, setSenderStats] = useState<ContactStats | null>(null);
  const [senderWallet, setSenderWallet] = useState<WalletSummary | null>(null);
  const [recipientStats, setRecipientStats] = useState<ContactStats | null>(null);

  // ── Service type ───────────────────────────────────────────────────────────
  const [serviceType, setServiceType] = useState<ServiceType>("livraison");

  // ── Form ───────────────────────────────────────────────────────────────────
  const defaultForm = {
    sender_name:              "",
    sender_phone:             "",
    recipient_name:           "",
    recipient_phone:          "",
    recipient_wilaya_id:      "",
    recipient_commune_id:     "",
    recipient_address:        "",
    content_description:      "",
    weight:                   "",
    declared_value:           "0",
    fragile:                  false,
    special_instructions:     "",
    exchange_product:         "",
    delivery_type:            "home_delivery" as DeliveryType,
    sd_wilaya_filter:         "",
    destination_stop_desk_id: "",
    payment_type:             "recipient" as "sender" | "recipient",
    cod_amount:               "0",
  };
  const [form, setForm] = useState(defaultForm);

  // ── Recipient search ───────────────────────────────────────────────────────
  const [recipientClient,        setRecipientClient]        = useState<Client | null>(null);
  const [recipientSearch,        setRecipientSearch]        = useState("");
  const [recipientResults,       setRecipientResults]       = useState<Client[]>([]);
  const [recipientDropdownOpen,  setRecipientDropdownOpen]  = useState(false);
  const [recipientLoading,       setRecipientLoading]       = useState(false);
  const debouncedRecipientSearch = useDebounce(recipientSearch, 300);

  // ── Origin stop desk ────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [originStopDeskId, setOriginStopDeskId] = useState<number | null>(null);
  const [originHasCaisse, setOriginHasCaisse] = useState<boolean | null>(null);
  const isAdmin = currentUser?.user_type === "admin";

  // ── Origin SD computed ─────────────────────────────────────────────────────
  const selectedOriginSD = stopDesks.find((sd) => sd.id === originStopDeskId);
  const originWilayaId   = selectedOriginSD?.commune?.wilaya_id ?? null;

  // ── Status ─────────────────────────────────────────────────────────────────
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");
  const [successPackage, setSuccessPackage] = useState<{ tracking_number: string; external_shipment?: { external_tracking: string | null } | null } | null>(null);

  // ── Tarification lookup ──────────────────────────────────────────────────
  const [resolvedShipping, setResolvedShipping] = useState<TariffLookupResult | null>(null);
  const [shippingLoading,  setShippingLoading]  = useState(false);

  // ── Frais de livraison override (gated by permission) ──────────────────────
  const { hasPermission } = useAccess();
  const canOverrideFrais = isAdmin || hasPermission("override_delivery_fee");
  const [fraisOverrideOn, setFraisOverrideOn] = useState(false);
  const [fraisOverride,   setFraisOverride]   = useState("");
  // Effective frais sent to the backend: manual value when overriding, else auto-tarif.
  const autoShipping = resolvedShipping?.price ?? null;
  const effectiveShipping = fraisOverrideOn ? (Number(fraisOverride) || 0) : autoShipping;

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    api<StopDesk[]>("/stop-desks").then((r) => { if (r.success && r.data) setStopDesks(r.data); });

    // Load current user and set origin stop desk
    const user = getStoredUser();
    setCurrentUser(user);
    if (user) {
      if (user.user_type === "admin") {
        const saved = localStorage.getItem("pos_origin_stop_desk_id");
        if (saved) setOriginStopDeskId(Number(saved));
      } else if (user.stop_desk_id) {
        setOriginStopDeskId(user.stop_desk_id);
      }
    }
  }, []);

  // Refetch wilayas when origin SD changes (Biskra shows all wilayas via DHD)
  useEffect(() => {
    getWilayas(originStopDeskId ? { origin_sd_id: originStopDeskId } : undefined)
      .then((r) => { if (r.success && r.data) setWilayas(r.data); });
  }, [originStopDeskId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") formRef.current?.requestSubmit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!successPackage) return;
    const t = setTimeout(() => setSuccessPackage(null), 8000);
    return () => clearTimeout(t);
  }, [successPackage]);

  // Check caisse when origin stop desk changes
  useEffect(() => {
    if (!originStopDeskId) {
      setOriginHasCaisse(null);
      return;
    }
    getCaisses().then((res) => {
      if (res.success && res.data) {
        const hasCaisse = res.data.some(
          (c) => c.stop_desk_id === originStopDeskId && c.is_active
        );
        setOriginHasCaisse(hasCaisse);
      }
    });
  }, [originStopDeskId]);

  // Auto-lookup shipping cost from tarification
  useEffect(() => {
    const destWilayaId = Number(form.recipient_wilaya_id) || 0;
    if (!destWilayaId || !originWilayaId) { setResolvedShipping(null); return; }

    // Map package service types (French) to tarification service types (English)
    const serviceMap: Record<string, string> = {
      livraison: "delivery", echange: "exchange", recouvrement: "recouvrement",
    };
    const svcType = serviceMap[serviceType] || "delivery";
    const delMode = form.delivery_type === "home_delivery" ? "home" : "desk";

    setShippingLoading(true);
    lookupTariff({
      departure_wilaya_id: originWilayaId,
      destination_wilaya_id: destWilayaId,
      service_type: svcType as "delivery" | "exchange" | "recouvrement" | "return",
      delivery_mode: delMode,
    }).then((res) => {
      setShippingLoading(false);
      setResolvedShipping(res.success && res.data ? res.data : null);
    }).catch(() => { setShippingLoading(false); setResolvedShipping(null); });
  }, [originWilayaId, form.recipient_wilaya_id, serviceType, form.delivery_type]);

  // Click-outside: close dropdowns
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (senderSearchRef.current && !senderSearchRef.current.contains(e.target as Node))
        setSenderDropdownOpen(false);
      if (recipientSearchRef.current && !recipientSearchRef.current.contains(e.target as Node))
        setRecipientDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sender search (expediteur users, min 2 chars)
  useEffect(() => {
    if (debouncedSearch.trim().length < 2 || senderClient) {
      setSenderResults([]);
      setSenderDropdownOpen(false);
      return;
    }
    setSenderLoading(true);
    setSenderDropdownOpen(true);
    getUsers({ type: "expediteur", search: debouncedSearch }).then((r) => {
      setSenderLoading(false);
      setSenderResults(r.success && r.data ? r.data : []);
    });
  }, [debouncedSearch, senderClient]);

  // Recipient search (min 2 chars)
  useEffect(() => {
    if (debouncedRecipientSearch.trim().length < 2 || recipientClient) {
      setRecipientResults([]);
      setRecipientDropdownOpen(false);
      return;
    }
    setRecipientLoading(true);
    setRecipientDropdownOpen(true);
    getClients({ search: debouncedRecipientSearch, per_page: 10 }).then((r) => {
      setRecipientLoading(false);
      setRecipientResults(r.success && r.data?.data ? r.data.data : []);
    });
  }, [debouncedRecipientSearch, recipientClient]);

  // ── Computed ───────────────────────────────────────────────────────────────
  // Load communes per selected wilaya
  const [filteredCommunes, setFilteredCommunes] = useState<Commune[]>([]);
  useEffect(() => {
    if (!form.recipient_wilaya_id) { setFilteredCommunes([]); return; }
    const wId = Number(form.recipient_wilaya_id);
    setFilteredCommunes([]);
    getCommunes(wId).then(r => { if (r.success && r.data) setFilteredCommunes(r.data); });
  }, [form.recipient_wilaya_id]);

  // Stop desks filtered by recipient's commune (for stop_desk delivery)
  // Includes: SDs in the commune + the assigned SD (delivery_stop_desk_id)
  const [destinationStopDesks, setDestinationStopDesks] = useState<StopDesk[]>([]);
  useEffect(() => {
    const communeId = Number(form.recipient_commune_id) || 0;
    if (!communeId) { setDestinationStopDesks([]); return; }
    // SDs physically in the commune
    const inCommune = stopDesks.filter((sd) => sd.commune_id === communeId && sd.is_active);
    if (inCommune.length > 0) { setDestinationStopDesks(inCommune); return; }
    // No SD in commune — check from filteredCommunes
    const commune = filteredCommunes.find(c => c.id === communeId);
    if (commune?.delivery_stop_desk_id) {
      const assignedSd = stopDesks.find(sd => sd.id === commune.delivery_stop_desk_id && sd.is_active);
      if (assignedSd) { setDestinationStopDesks([assignedSd]); return; }
    }
    // Fallback: query backend for the commune's assigned SD (handles DHD communes)
    api<any>(`/communes?wilaya_id=${form.recipient_wilaya_id}`).then(res => {
      const communes = res.data ?? [];
      const match = communes.find((c: any) => c.id === communeId);
      if (match?.delivery_stop_desk_id) {
        const sd = stopDesks.find(s => s.id === match.delivery_stop_desk_id && s.is_active);
        if (sd) { setDestinationStopDesks([sd]); return; }
      }
      setDestinationStopDesks([]);
    });
  }, [stopDesks, form.recipient_commune_id, form.recipient_wilaya_id, filteredCommunes]);

  // Auto-select destination stop desk
  useEffect(() => {
    if (form.delivery_type === "home_delivery") {
      // À domicile: auto-assign the SD in recipient's commune (package goes there, then driver delivers)
      if (destinationStopDesks.length >= 1) {
        setF("destination_stop_desk_id", String(destinationStopDesks[0].id));
      } else {
        setF("destination_stop_desk_id", "");
      }
    } else {
      // Stop desk: auto-select if exactly 1
      if (destinationStopDesks.length === 1) {
        setF("destination_stop_desk_id", String(destinationStopDesks[0].id));
      } else if (!destinationStopDesks.find((sd: StopDesk) => sd.id === Number(form.destination_stop_desk_id))) {
        setF("destination_stop_desk_id", "");
      }
    }
  }, [destinationStopDesks, form.delivery_type]);

  const selectedWilaya   = wilayas.find((w) => w.id === Number(form.recipient_wilaya_id));
  const selectedCommune  = communes.find((c) => c.id === Number(form.recipient_commune_id));
  const selectedStopDesk = stopDesks.find((sd) => sd.id === Number(form.destination_stop_desk_id));

  const showCOD  = serviceType !== "echange";
  const codLabel =
    serviceType === "recouvrement" ? "Montant à recouvrer" :
                                     "Montant COD (DA)";

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleOriginSDChange(sdId: number) {
    setOriginStopDeskId(sdId);
    localStorage.setItem("pos_origin_stop_desk_id", String(sdId));
    // Clear sender — may belong to a different wilaya
    setSenderClient(null);
    setSenderSearch("");
    setSenderResults([]);
    setForm((prev) => ({ ...prev, sender_name: "", sender_phone: "" }));
  }

  function setF(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectSender(client: StaffUser) {
    setSenderClient(client);
    setSenderSearch("");
    setSenderDropdownOpen(false);
    const phone = client.phone || "";
    setForm((prev) => ({
      ...prev,
      sender_name:  `${client.first_name} ${client.last_name}`,
      sender_phone: phone,
    }));
    // Fetch stats + wallet
    if (phone) {
      getContactStats(phone, "sender").then(r => {
        if (r.success && r.data) setSenderStats(r.data);
      });
    }
    getWalletSummary(client.id).then(r => {
      if (r.success && r.data) setSenderWallet(r.data);
    });
  }

  function clearSender() {
    setSenderClient(null);
    setSenderSearch("");
    setSenderStats(null);
    setSenderWallet(null);
    setForm((prev) => ({ ...prev, sender_name: "", sender_phone: "" }));
  }

  function selectRecipient(client: Client) {
    setRecipientClient(client);
    setRecipientSearch("");
    setRecipientDropdownOpen(false);
    setForm((prev) => ({
      ...prev,
      recipient_name:      `${client.first_name} ${client.last_name}`,
      recipient_phone:     client.phone1,
      recipient_wilaya_id: client.wilaya_id ? String(client.wilaya_id) : prev.recipient_wilaya_id,
      recipient_commune_id: client.commune_id ? String(client.commune_id) : (client.wilaya_id ? "" : prev.recipient_commune_id),
    }));
    // Fetch stats
    getContactStats(client.phone1, "recipient").then(r => {
      if (r.success && r.data) setRecipientStats(r.data);
    });
  }

  function clearRecipient() {
    setRecipientClient(null);
    setRecipientSearch("");
    setForm((prev) => ({ ...prev, recipient_name: "", recipient_phone: "" }));
  }

  function resetForm() {
    setServiceType("livraison");
    setSenderClient(null);
    setSenderSearch("");
    setSenderResults([]);
    setRecipientClient(null);
    setRecipientSearch("");
    setRecipientResults([]);
    setForm(defaultForm);
    setSuccessPackage(null);
    setResolvedShipping(null);
    setFraisOverrideOn(false);
    setFraisOverride("");
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!originStopDeskId) {
      setError("Stop desk d'origine requis."); return;
    }
    if (originHasCaisse === false) {
      setError("Aucune caisse active pour ce stop desk. Création de colis bloquée."); return;
    }
    if (!form.sender_name.trim() || !form.sender_phone.trim()) {
      setError("Nom et téléphone de l'expéditeur requis."); return;
    }
    if (!form.recipient_name.trim() || !form.recipient_phone.trim()) {
      setError("Nom et téléphone du destinataire requis."); return;
    }
    if (!form.recipient_wilaya_id) {
      setError("Wilaya du destinataire requise."); return;
    }
    if (!form.content_description.trim()) {
      setError("Description du contenu requise."); return;
    }
    if (form.delivery_type === "stop_desk" && !form.destination_stop_desk_id && destinationStopDesks.length > 0) {
      setError("Stop desk de destination requis."); return;
    }
    if (serviceType === "echange" && !form.exchange_product.trim()) {
      setError("Produit à récupérer requis pour un échange."); return;
    }
    if (!Number(form.cod_amount) || Number(form.cod_amount) <= 0) {
      setError("Valeur déclarée (montant) requise."); return;
    }

    const payload: CreatePackagePayload = {
      service_type:             serviceType,
      origin_stop_desk_id:      originStopDeskId!,
      sender_client_id:         null, // expediteurs are users, not clients
      sender_name:              form.sender_name.trim(),
      sender_phone:             form.sender_phone.trim(),
      recipient_name:           form.recipient_name.trim(),
      recipient_phone:          form.recipient_phone.trim(),
      recipient_wilaya_id:      Number(form.recipient_wilaya_id),
      recipient_commune_id:     form.recipient_commune_id ? Number(form.recipient_commune_id) : null,
      recipient_address:        form.delivery_type === "home_delivery" ? (form.recipient_address.trim() || null) : null,
      delivery_type:            form.delivery_type,
      destination_stop_desk_id: form.destination_stop_desk_id ? Number(form.destination_stop_desk_id) : null,
      content_description:      form.content_description.trim(),
      weight:                   form.weight ? Number(form.weight) : null,
      declared_value:           Number(form.declared_value) || 0,
      cod_amount:               Number(form.cod_amount) || 0,
      payment_type:             form.payment_type,
      fragile:                  form.fragile,
      special_instructions:     form.special_instructions.trim() || null,
      exchange_product:         serviceType === "echange" ? (form.exchange_product.trim() || null) : null,
      // Frais: manual override (when permitted) takes precedence over the auto-tarif.
      ...(effectiveShipping != null ? { shipping_cost: effectiveShipping } : {}),
    };

    setSaving(true);
    const res = await createPackage(payload);
    setSaving(false);

    if (res.success && res.data) {
      setSuccessPackage(res.data);
      setSenderClient(null);
      setSenderSearch("");
      setForm(defaultForm);
      setFraisOverrideOn(false);
      setFraisOverride("");
    } else {
      setError(res.message ?? "Erreur lors de la création.");
    }
  }

  // ── Dropdown styles — always dark (overlay panel, theme-independent) ─────────
  const dd: Record<string, React.CSSProperties> = {
    wrap:   { background: "#0f1623", border: "1px solid #1e2a3a", borderRadius: "12px", boxShadow: "0 12px 28px rgba(0,0,0,.45)", overflow: "hidden" },
    item:   { display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", width: "100%", textAlign: "left", cursor: "pointer", background: "transparent", borderBottom: "1px solid #1e2a3a", color: "#e2e8f0" },
    avatar: { width: "28px", height: "28px", borderRadius: "6px", background: "#1e2a3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, flexShrink: 0, color: "#94a3b8", textTransform: "uppercase" },
    name:   { fontSize: "13px", fontWeight: 500, color: "#f1f5f9", lineHeight: "1.3" },
    phone:  { fontSize: "11px", color: "#64748b" },
    msg:    { padding: "12px 16px", fontSize: "12px", color: "#64748b" },
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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

        .pos-dd-item:last-child { border-bottom: none !important; }
        .pos-dd-item:hover { background: #1a2235 !important; }

        /* Form controls — dark mode (bypasses Tailwind CDN timing) */
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
      {successPackage && (
        <div className="flex items-center justify-between px-5 py-3 bg-emerald-500 text-white shrink-0 z-10">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-medium">
              Colis créé —{" "}
              <strong className="font-mono text-[12px]">{successPackage.external_shipment?.external_tracking ?? successPackage.tracking_number}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetForm}
              className="flex items-center gap-1.5 text-[11px] font-semibold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Créer un autre
            </button>
            <button
              onClick={() => setSuccessPackage(null)}
              className="p-1 rounded hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Two-panel layout ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT — Form ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 pos-scroll">
          <form ref={formRef} onSubmit={submit} className="h-full flex flex-col p-4 pos-form">

            {/* Page header + service-type selector */}
            <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
              <div className="shrink-0">
                <h1 className="text-[16px] font-bold text-slate-900 dark:text-[#f5f5f5] tracking-tight leading-none">
                  Nouveau Colis
                </h1>
                <p className="text-[10px] text-slate-400 dark:text-[#52525b] mt-1 uppercase tracking-wide">
                  Terminal de création — POS
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

            {/* Column 1 */}
            <div className="space-y-4 min-w-0">

            {/* ── Origin Stop Desk ──────────────────────────────── */}
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e2130] shadow-sm">
              <SectionHeader icon={Store} label="Stop Desk d'Origine" />
              <div className="p-3">
                {isAdmin ? (
                  <div>
                    <label className={labelCls}>
                      Sélectionner le stop desk <span className="text-orange-500">*</span>
                    </label>
                    <SDSelector
                      stopDesks={stopDesks}
                      value={originStopDeskId}
                      onChange={(id) => { if (id) handleOriginSDChange(id); else setOriginStopDeskId(null); }}
                      disabled={isSDLocked(getStoredUser())}
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/40 rounded-lg">
                    <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                      <Store className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[13px] font-medium text-slate-800 dark:text-[#f5f5f5]">
                      {selectedOriginSD?.name ?? "Non assigné"}
                      {selectedOriginSD?.code && (
                        <span className="text-slate-400 dark:text-[#52525b] font-normal ml-2">
                          · {selectedOriginSD.code}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Caisse warning */}
              {originStopDeskId && originHasCaisse === false && (
                <div className="mx-4 mb-4 flex items-center gap-2.5 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-[12px] font-medium text-red-700 dark:text-red-400">
                    Aucune caisse active pour ce stop desk. Création de colis bloquée.
                  </span>
                </div>
              )}
            </div>

            {/* ── Section 1: Expéditeur ────────────────────────── */}
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e2130] shadow-sm">
              <SectionHeader icon={User} label="Expéditeur" />
              <div className="p-3 space-y-2.5">

                {/* Client search / chip */}
                {!senderClient ? (
                  <div className="relative" ref={senderSearchRef}>
                    <label className={labelCls}>Rechercher client existant</label>
                    <div className="relative">
                      <Search className="absolute left-0 top-2.5 w-3.5 h-3.5 text-slate-300 dark:text-[#3a4560]" />
                      <input
                        type="text"
                        value={senderSearch}
                        onChange={(e) => setSenderSearch(e.target.value)}
                        placeholder="Rechercher par nom ou téléphone..."
                        className={cn(inputCls, "pl-5")}
                      />
                      {senderLoading && (
                        <Loader2 className="absolute right-0 top-2.5 w-3.5 h-3.5 text-slate-300 dark:text-[#3a4560] animate-spin" />
                      )}
                    </div>

                    {senderDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1" style={dd.wrap}>
                        {senderLoading ? (
                          <div style={{ ...dd.msg, display: "flex", alignItems: "center", gap: "8px" }}>
                            <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin shrink-0" />
                            <span>Recherche…</span>
                          </div>
                        ) : senderResults.length > 0 ? (
                          senderResults.map((client, i) => (
                            <button
                              key={client.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectSender(client)}
                              className="pos-dd-item"
                              style={dd.item}
                            >
                              <div style={dd.avatar}>{client.first_name[0]}{client.last_name[0]}</div>
                              <div>
                                <p style={dd.name}>{client.first_name} {client.last_name}{client.company_name ? ` (${client.company_name})` : ""}</p>
                                <p style={dd.phone}>{client.phone || client.email}</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div>
                            <div style={dd.msg}>Aucun expéditeur trouvé</div>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setSenderDropdownOpen(false);
                                // Pre-fill from search query
                                const q = senderSearch.trim();
                                const isPhone = /^\d/.test(q);
                                setCreateExpForm({
                                  first_name: isPhone ? "" : q.split(" ")[0] || "",
                                  last_name: isPhone ? "" : q.split(" ").slice(1).join(" ") || "",
                                  phone: isPhone ? q : "",
                                  company_name: "",
                                });
                                setSenderSearch("");
                                setShowCreateExp(true);
                                setCreateExpError("");
                              }}
                              style={{ ...dd.item, borderTop: "1px solid rgba(249,115,22,0.15)", justifyContent: "center", gap: 6, color: "#f97316", fontWeight: 600, fontSize: 12 }}
                            >
                              <span style={{ fontSize: 14 }}>+</span> Créer nouvel expéditeur
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800/40 rounded-lg p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0 uppercase">
                        {senderClient.first_name[0]}{senderClient.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800 dark:text-[#f5f5f5] truncate">
                          {senderClient.first_name} {senderClient.last_name}
                          {senderClient.company_name && <span className="text-slate-400 dark:text-[#52525b] font-normal ml-1 text-[11px]">({senderClient.company_name})</span>}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#6b7280]">
                          {senderClient.phone || "—"}
                          {senderClient.wilaya && <span> · {senderClient.wilaya.name}</span>}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">Lié</span>
                      <button type="button" onClick={clearSender} className="p-1 rounded-md hover:bg-orange-200 dark:hover:bg-orange-800/40 transition-colors shrink-0">
                        <X className="w-3.5 h-3.5 text-orange-400" />
                      </button>
                    </div>
                    {senderStats && senderStats.total > 0 && (
                      <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-800/30 grid grid-cols-4 gap-2">
                        <div className="text-center">
                          <p className="text-[15px] font-bold text-orange-600 dark:text-orange-400">{senderStats.total}</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">Colis</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[15px] font-bold text-green-600 dark:text-green-400">{senderStats.livre}</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">Livrés</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[15px] font-bold text-red-500">{senderStats.retour_pct}%</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">Retour</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[15px] font-bold text-amber-600 dark:text-amber-400">{senderStats.en_cours ?? 0}</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">En cours</p>
                        </div>
                      </div>
                    )}
                    {senderStats && senderStats.total === 0 && (
                      <p className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-800/30 text-[11px] text-slate-400 dark:text-[#52525b] text-center">Nouveau client — aucun historique</p>
                    )}
                    {senderWallet && (
                      <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-800/30 grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <p className="text-[13px] font-bold text-blue-500">{senderWallet.en_transit.toLocaleString()} DA</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">En transit</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[13px] font-bold text-green-500">{senderWallet.libere.toLocaleString()} DA</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">Libéré</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[13px] font-bold text-red-500">{senderWallet.retour_count}</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">Retours</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Inline expediteur creation form */}
                {showCreateExp && !senderClient && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">Créer nouvel expéditeur</p>
                      <button type="button" onClick={() => setShowCreateExp(false)} className="p-0.5 rounded hover:bg-emerald-200 dark:hover:bg-emerald-800/30">
                        <X className="w-3.5 h-3.5 text-emerald-500" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Prénom *" value={createExpForm.first_name}
                        onChange={e => setCreateExpForm(p => ({ ...p, first_name: e.target.value }))}
                        className={inputCls} />
                      <input type="text" placeholder="Nom *" value={createExpForm.last_name}
                        onChange={e => setCreateExpForm(p => ({ ...p, last_name: e.target.value }))}
                        className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="tel" placeholder="Téléphone *" value={createExpForm.phone}
                        onChange={e => setCreateExpForm(p => ({ ...p, phone: e.target.value }))}
                        className={inputCls} />
                      <input type="text" placeholder="Entreprise (optionnel)" value={createExpForm.company_name}
                        onChange={e => setCreateExpForm(p => ({ ...p, company_name: e.target.value }))}
                        className={inputCls} />
                    </div>
                    {createExpError && (
                      <p className="text-[11px] text-red-500 font-medium">{createExpError}</p>
                    )}
                    <button
                      type="button"
                      disabled={createExpLoading || !createExpForm.first_name || !createExpForm.last_name || !createExpForm.phone}
                      onClick={async () => {
                        setCreateExpError("");
                        setCreateExpLoading(true);
                        const res = await createUser({
                          first_name: createExpForm.first_name,
                          last_name: createExpForm.last_name,
                          phone: createExpForm.phone,
                          email: `${createExpForm.phone}@expediteur.local`,
                          user_type: "expediteur",
                          status: "active",
                          password: "password123",
                          company_name: createExpForm.company_name || null,
                          stop_desk_id: originStopDeskId ?? undefined,
                        });
                        setCreateExpLoading(false);
                        if (res.success && res.data) {
                          setShowCreateExp(false);
                          selectSender(res.data);
                        } else {
                          setCreateExpError((res as any).message || "Erreur lors de la création");
                        }
                      }}
                      className="w-full py-2 rounded-lg text-[12px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {createExpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Créer et sélectionner
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>
                      Nom expéditeur <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.sender_name}
                      onChange={(e) => setF("sender_name", e.target.value)}
                      placeholder="Nom complet"
                      className={inputCls}
                      readOnly={!!senderClient}
                      style={senderClient ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Téléphone <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={form.sender_phone}
                      onChange={(e) => setF("sender_phone", e.target.value)}
                      placeholder="0XX XXX XXXX"
                      className={inputCls}
                      readOnly={!!senderClient}
                      style={senderClient ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                    />
                  </div>
                </div>
              </div>
            </div>
            </div>{/* end Column 1 */}

            {/* Column 2 */}
            <div className="space-y-4 min-w-0">

            {/* ── Section 2: Destinataire ──────────────────────── */}
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e2130] shadow-sm">
              <SectionHeader icon={MapPin} label="Destinataire" />
              <div className="p-3 space-y-2.5">

                {/* Recipient search / chip */}
                {!recipientClient ? (
                  <div className="relative" ref={recipientSearchRef}>
                    <label className={labelCls}>Rechercher destinataire existant</label>
                    <div className="relative">
                      <Search className="absolute left-0 top-2.5 w-3.5 h-3.5 text-slate-300 dark:text-[#3a4560]" />
                      <input
                        type="text"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        placeholder="Rechercher par nom ou téléphone..."
                        className={cn(inputCls, "pl-5")}
                      />
                    </div>
                    {recipientDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1" style={dd.wrap}>
                        {recipientLoading ? (
                          <div style={{ ...dd.msg, display: "flex", alignItems: "center", gap: "8px" }}>
                            <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin shrink-0" />
                            <span>Recherche…</span>
                          </div>
                        ) : recipientResults.length > 0 ? (
                          recipientResults.map((client, i) => (
                            <button
                              key={client.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectRecipient(client)}
                              className="pos-dd-item"
                              style={dd.item}
                            >
                              <div style={dd.avatar}>{client.first_name[0]}{client.last_name[0]}</div>
                              <div>
                                <p style={dd.name}>{client.first_name} {client.last_name}</p>
                                <p style={dd.phone}>{client.phone1}</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div>
                            <div style={dd.msg}>Aucun destinataire trouvé</div>
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => { setRecipientDropdownOpen(false); setRecipientSearch(""); }}
                              style={{ ...dd.item, borderTop: "1px solid rgba(249,115,22,0.15)", justifyContent: "center", gap: 6, color: "#f97316", fontWeight: 600, fontSize: 12 }}
                            >
                              <span style={{ fontSize: 14 }}>+</span> Saisir manuellement
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-violet-50 dark:bg-violet-900/15 border border-violet-200 dark:border-violet-800/40 rounded-lg p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0 uppercase">
                        {recipientClient.first_name[0]}{recipientClient.last_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-800 dark:text-[#f5f5f5] truncate">
                          {recipientClient.first_name} {recipientClient.last_name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-[#6b7280]">
                          {recipientClient.phone1}
                          {recipientClient.wilaya && <span> · {recipientClient.wilaya.name}</span>}
                          {recipientClient.commune && <span> · {recipientClient.commune.name}</span>}
                        </p>
                      </div>
                      <span className="text-[9px] font-bold text-violet-500 bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">Lié</span>
                      <button type="button" onClick={() => { clearRecipient(); setRecipientStats(null); }} className="p-1 rounded-md hover:bg-violet-200 dark:hover:bg-violet-800/40 transition-colors shrink-0">
                        <X className="w-3.5 h-3.5 text-violet-400" />
                      </button>
                    </div>
                    {recipientStats && recipientStats.total > 0 && (
                      <div className="mt-2 pt-2 border-t border-violet-200 dark:border-violet-800/30 grid grid-cols-4 gap-2">
                        <div className="text-center">
                          <p className="text-[15px] font-bold text-violet-600 dark:text-violet-400">{recipientStats.total}</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">Reçus</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[15px] font-bold text-green-600 dark:text-green-400">{recipientStats.livre_pct}%</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">Livré</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[15px] font-bold text-red-500">{recipientStats.retour_pct}%</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">Retour</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[15px] font-bold text-amber-600 dark:text-amber-400">{recipientStats.reporte ?? 0}</p>
                          <p className="text-[9px] text-slate-500 dark:text-[#6b7280] uppercase">Reporté</p>
                        </div>
                      </div>
                    )}
                    {recipientStats && recipientStats.total === 0 && (
                      <p className="mt-2 pt-2 border-t border-violet-200 dark:border-violet-800/30 text-[11px] text-slate-400 dark:text-[#52525b] text-center">Nouveau destinataire — aucun historique</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>
                      Nom destinataire <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.recipient_name}
                      onChange={(e) => setF("recipient_name", e.target.value)}
                      placeholder="Nom complet"
                      className={inputCls}
                      readOnly={!!recipientClient}
                      style={recipientClient ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Téléphone <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={form.recipient_phone}
                      onChange={(e) => setF("recipient_phone", e.target.value)}
                      placeholder="0XX XXX XXXX"
                      className={inputCls}
                      readOnly={!!recipientClient}
                      style={recipientClient ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
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
                        value={form.recipient_wilaya_id}
                        onChange={(e) => { setF("recipient_wilaya_id", e.target.value); setF("recipient_commune_id", ""); }}
                        className={cn(inputCls, "appearance-none cursor-pointer")}
                      >
                        <option value="">— Sélectionner —</option>
                        {wilayas.map((w) => <option key={w.id} value={w.id}>{w.code ? `${w.code} - ${w.name}` : w.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-0 top-2.5 w-3.5 h-3.5 text-slate-300 dark:text-[#3a4560] pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Commune</label>
                    <div className="relative">
                      <select
                        value={form.recipient_commune_id}
                        onChange={(e) => setF("recipient_commune_id", e.target.value)}
                        disabled={!form.recipient_wilaya_id}
                        className={cn(
                          inputCls,
                          "appearance-none cursor-pointer",
                          !form.recipient_wilaya_id && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <option value="">— Commune —</option>
                        {filteredCommunes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-0 top-2.5 w-3.5 h-3.5 text-slate-300 dark:text-[#3a4560] pointer-events-none" />
                    </div>
                  </div>
                </div>

                {form.delivery_type === "home_delivery" && (
                  <div>
                    <label className={labelCls}>Adresse de livraison</label>
                    <input
                      type="text"
                      value={form.recipient_address}
                      onChange={(e) => setF("recipient_address", e.target.value)}
                      placeholder="N° rue, quartier, bâtiment..."
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            </div>
            </div>{/* end Column 2 */}

            {/* Column 3 */}
            <div className="space-y-4 min-w-0">

            {/* ── Section 3: Mode de livraison ─────────────────── */}
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e2130] shadow-sm">
              <SectionHeader icon={Truck} label="Mode de livraison" />
              <div className="p-3 space-y-2.5">
                <div className="inline-flex bg-slate-100 dark:bg-[#1a1f2e] rounded-lg p-0.5">
                  {([
                    { v: "home_delivery" as DeliveryType, label: "À domicile" },
                    { v: "stop_desk"     as DeliveryType, label: "Stop Desk"  },
                  ]).map(({ v, label }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setF("delivery_type", v); setF("destination_stop_desk_id", ""); }}
                      className={cn(
                        "px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all",
                        form.delivery_type === v
                          ? "bg-white dark:bg-[#0e1017] shadow-sm text-slate-900 dark:text-[#f5f5f5]"
                          : "text-slate-500 dark:text-[#52525b] hover:text-slate-700 dark:hover:text-[#a1a1aa]"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {form.delivery_type === "stop_desk" && (
                  <div>
                    {!form.recipient_commune_id ? (
                      <p className="text-[11px] text-slate-400 dark:text-[#6b7280]">Sélectionnez la commune du destinataire d&apos;abord</p>
                    ) : destinationStopDesks.length === 0 ? (
                      <p className="text-[11px] text-amber-500">
                        Aucun stop desk — livraison via prestataire externe
                      </p>
                    ) : destinationStopDesks.length === 1 ? (
                      <div className="flex items-center gap-2">
                        <Store className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[12px] font-medium text-slate-700 dark:text-[#d1d5db]">
                          {destinationStopDesks[0].name}{destinationStopDesks[0].code ? ` (${destinationStopDesks[0].code})` : ""}
                        </span>
                        <span className="text-[10px] text-emerald-500 font-medium">Auto-sélectionné</span>
                      </div>
                    ) : (
                      <div>
                        <label className={labelCls}>
                          Stop Desk <span className="text-orange-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={form.destination_stop_desk_id}
                            onChange={(e) => setF("destination_stop_desk_id", e.target.value)}
                            className={cn(inputCls, "appearance-none cursor-pointer")}
                          >
                            <option value="">— Sélectionner —</option>
                            {destinationStopDesks.map((sd) => (
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

            {/* ── Section 5: Paiement ──────────────────────────── */}
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
                        onClick={() => setF("payment_type", v)}
                        className={cn(
                          "px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all",
                          form.payment_type === v
                            ? "bg-white dark:bg-[#0e1017] shadow-sm text-slate-900 dark:text-[#f5f5f5]"
                            : "text-slate-500 dark:text-[#52525b] hover:text-slate-700 dark:hover:text-[#a1a1aa]"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.payment_type === "sender" && showCOD && (
                  <div>
                    <label className={labelCls}>
                      {codLabel}
                    </label>
                    <input
                      type="number" min="0"
                      value={form.cod_amount}
                      onChange={(e) => { setF("cod_amount", e.target.value); setF("declared_value", e.target.value); }}
                      placeholder="0"
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 4: Détails colis ─────────────────────── */}
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-[#1e2130] shadow-sm">
              <SectionHeader icon={Package2} label="Détails colis" />
              <div className="p-3 space-y-2.5">
                <div>
                  <label className={labelCls}>
                    Description du contenu <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.content_description}
                    onChange={(e) => setF("content_description", e.target.value)}
                    placeholder="Ex : Vêtements, électronique, documents..."
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Poids (kg)</label>
                    <input
                      type="number" min="0" step="0.1"
                      value={form.weight}
                      onChange={(e) => setF("weight", e.target.value)}
                      placeholder="0.0"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Valeur déclarée (DA) <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="number" min="0"
                      value={form.cod_amount}
                      onChange={(e) => { setF("cod_amount", e.target.value); setF("declared_value", e.target.value); }}
                      placeholder="0"
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
                      value={form.exchange_product}
                      onChange={(e) => setF("exchange_product", e.target.value)}
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
                    onClick={() => setF("fragile", !form.fragile)}
                    className={cn(
                      "relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0",
                      form.fragile ? "bg-orange-500" : "bg-slate-200 dark:bg-[#2a3145]"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                      form.fragile ? "translate-x-5" : "translate-x-0.5"
                    )} />
                  </button>
                </div>

                <div>
                  <label className={labelCls}>Instructions spéciales</label>
                  <textarea
                    value={form.special_instructions}
                    onChange={(e) => setF("special_instructions", e.target.value)}
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
        {/* Intentionally always dark — like a receipt terminal */}
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
            <ReceiptRow label="Origine" value={selectedOriginSD?.name ?? <Placeholder />} truncate />

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

            <ReceiptRow label="Expéditeur"  value={form.sender_name  || <Placeholder />} truncate />
            {form.sender_phone && <ReceiptRow label="Tél exp."  value={form.sender_phone} />}

            <RDivider />

            <ReceiptRow label="Destinataire" value={form.recipient_name  || <Placeholder />} truncate />
            {form.recipient_phone && <ReceiptRow label="Tél dest." value={form.recipient_phone} />}
            <ReceiptRow label="Wilaya"  value={selectedWilaya ? (selectedWilaya.code ? `${selectedWilaya.code} - ${selectedWilaya.name}` : selectedWilaya.name) : <Placeholder />} />
            {selectedCommune && <ReceiptRow label="Commune" value={selectedCommune.name} truncate />}

            <RDivider />

            <ReceiptRow label="Livraison" value={form.delivery_type === "home_delivery" ? "À domicile" : "Stop Desk"} />
            {form.delivery_type === "stop_desk" && selectedStopDesk && (
              <ReceiptRow label="Stop Desk" value={selectedStopDesk.name} truncate />
            )}
            {form.delivery_type === "home_delivery" && form.recipient_address && (
              <ReceiptRow label="Adresse" value={form.recipient_address} truncate />
            )}

            <RDivider />

            {form.content_description && (
              <ReceiptRow label="Contenu"    value={form.content_description} truncate />
            )}
            {form.weight && <ReceiptRow label="Poids" value={`${form.weight} kg`} />}
            <ReceiptRow label="Fragile" value={
              <span className={form.fragile ? "text-orange-400" : "text-slate-500"}>
                {form.fragile ? "Oui" : "Non"}
              </span>
            } />

            <RDivider />

            <ReceiptRow label="Frais" value={
              form.payment_type === "recipient" ? "Destinataire" : "Expéditeur"
            } />
            <ReceiptRow label="Livraison" value={
              fraisOverrideOn ? (
                <span className="inline-flex items-center gap-1.5">
                  <input
                    type="number" min="0" autoFocus
                    value={fraisOverride}
                    onChange={(e) => setFraisOverride(e.target.value)}
                    placeholder={autoShipping != null ? String(autoShipping) : "0"}
                    className="w-[68px] bg-transparent border-b border-orange-400 text-right text-emerald-400 font-bold text-[11px] font-mono focus:outline-none [color-scheme:dark]"
                  />
                  <span className="text-emerald-400 font-bold text-[11px] font-mono">DA</span>
                  <button type="button" title="Rétablir le tarif automatique"
                    onClick={() => { setFraisOverrideOn(false); setFraisOverride(""); }}
                    className="text-slate-500 hover:text-slate-300">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : shippingLoading ? (
                <span className="text-slate-500 text-[10px]">...</span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  {resolvedShipping
                    ? <span className="text-emerald-400 font-bold">{resolvedShipping.price} DA</span>
                    : <Placeholder />}
                  {canOverrideFrais && (
                    <button type="button" title="Modifier les frais de livraison"
                      onClick={() => { setFraisOverrideOn(true); setFraisOverride(autoShipping != null ? String(autoShipping) : ""); }}
                      className="text-slate-500 hover:text-orange-400">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </span>
              )
            } />
            {fraisOverrideOn && (
              <ReceiptRow label="Source" value={
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold bg-orange-500/20 text-orange-300">
                  Frais manuels
                </span>
              } />
            )}
            {!fraisOverrideOn && resolvedShipping && (
              <ReceiptRow label="Source" value={
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded font-semibold",
                  resolvedShipping.source === "expediteur"
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-slate-500/20 text-slate-400"
                )}>
                  {resolvedShipping.source === "expediteur" ? "Tarif expéditeur" : "Tarif par défaut"}
                </span>
              } />
            )}
            {showCOD && (
              <ReceiptRow label="COD" value={
                <span className="text-orange-300 font-bold">{Number(form.cod_amount) || 0} DA</span>
              } />
            )}

            <RDivider />
            <div className="flex justify-between items-center py-1">
              <span className="text-[11px] font-bold text-slate-300 dark:text-[#d1d5db] uppercase tracking-wide">Total</span>
              <span className="text-[14px] font-bold text-emerald-400">
                {((Number(form.cod_amount) || 0) + (effectiveShipping || 0))} DA
              </span>
            </div>

            {serviceType === "echange" && form.exchange_product && (
              <>
                <RDivider />
                <ReceiptRow label="À récupérer" value={form.exchange_product} truncate />
              </>
            )}
          </div>

          {/* Submit */}
          <div className="px-5 pb-5 pt-3 border-t border-slate-800 dark:border-[#1a1f2e] space-y-2 shrink-0">
            <button
              type="button"
              onClick={() => formRef.current?.requestSubmit()}
              disabled={saving || originHasCaisse === false}
              className={cn(
                "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[14px] text-white transition-all",
                saving || originHasCaisse === false
                  ? "bg-orange-400 cursor-not-allowed opacity-60"
                  : "bg-orange-500 hover:bg-orange-600 active:scale-[0.98]"
              )}
            >
              {saving ? (
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
