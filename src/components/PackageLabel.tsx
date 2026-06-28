"use client";

import React, { useRef, useEffect, useState } from "react";
import { X, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";
import type { Package } from "@/lib/packages";

interface Props {
  pkg: Package;
  onClose: () => void;
}

function Barcode({ value, height = 50 }: { value: string; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: 1.5,
          height,
          displayValue: true,
          fontSize: 11,
          font: "monospace",
          textMargin: 2,
          margin: 0,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch { /* ignore */ }
    }
  }, [value, height]);
  return <svg ref={svgRef} style={{ maxWidth: "100%" }} />;
}

export default function PackageLabel({ pkg, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));

  const communeName = typeof pkg.recipient_commune === "object"
    ? (pkg.recipient_commune as any)?.name || ""
    : "";
  const wilayaName = (pkg.recipient_commune as any)?.wilaya?.name
    || (pkg.recipient_wilaya as any)?.name || "";
  const wilayaCode = (pkg.recipient_wilaya as any)?.code || "";

  const deliveryLabel = pkg.delivery_type === "home_delivery" ? "DOMICILE" : "STOP DESK";

  const serviceLabel: Record<string, string> = {
    livraison: "LIVRAISON",
    pickup: "PICKUP",
    echange: "ÉCHANGE",
    recouvrement: "RECOUVREMENT",
  };

  const originSdName = (pkg as any).origin_stop_desk?.name || "";
  const originSdCode = (pkg as any).origin_stop_desk?.code || "";
  const originSdLabel = originSdCode ? `${originSdCode} · ${originSdName}` : originSdName;

  const expeditionDate = pkg.created_at
    ? new Date(pkg.created_at).toLocaleString("fr-FR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  const isEchangeReturn = pkg.tracking_number.startsWith("ECH-");
  const dhdTracking = pkg.external_shipment?.external_tracking;
  const isDhdEchange = pkg.service_type === "echange" && !!dhdTracking;
  const totalAmount = isEchangeReturn ? 0 : (Number(pkg.cod_amount || 0) + (pkg.payment_type === "recipient" ? Number(pkg.shipping_cost || 0) : 0));

  const printRef2 = useRef<HTMLDivElement>(null);

  function handlePrint() {
    // For DHD échange: print both labels (delivery + return) in one popup
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) { alert("Veuillez autoriser les popups pour imprimer"); return; }

    let html = el.innerHTML;
    if (isDhdEchange && printRef2.current) {
      html += '<div style="page-break-before:always"></div>' + printRef2.current.innerHTML;
    }

    w.document.write(`<html><head><title>Étiquette — ${pkg.tracking_number}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif}
      @media print{@page{size:100mm auto;margin:2mm}body{width:100mm}}</style>
      </head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: isDark ? "#111827" : "#fff", borderRadius: 16, width: "100%", maxWidth: 520,
        maxHeight: "95vh", overflowY: "auto", border: isDark ? "1px solid #1e2130" : "1px solid #e5e7eb",
        boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: isDark ? "1px solid #1e2130" : "1px solid #e5e7eb",
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#f0f0f5" : "#111827" }}>
            Étiquette — {pkg.tracking_number}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handlePrint} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 8,
              border: "none", background: "#3b82f6", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              <Printer size={14} /> Imprimer
            </button>
            <button onClick={onClose} style={{
              background: "transparent", border: "none", cursor: "pointer", padding: 4, borderRadius: 6,
            }}>
              <X size={18} color={isDark ? "#6b7280" : "#9ca3af"} />
            </button>
          </div>
        </div>

        {/* Label preview */}
        <div style={{ padding: 24, overflowY: "auto", maxHeight: "calc(95vh - 60px)", display: "flex", justifyContent: "center" }}>
          <div ref={printRef} style={{ width: 380, fontFamily: "Arial, sans-serif", fontSize: 12, color: "#000", background: "#fff" }}>
            <div style={{ border: "2px solid #000", padding: 0, background: "#fff" }}>

              {/* TOP HEADER */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 10px 6px", borderBottom: "2px solid #000" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 1 }}>DELIVERY</div>
                  <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>{serviceLabel[pkg.service_type] || pkg.service_type}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ border: "2px solid #000", padding: "6px 14px", fontWeight: "bold", minWidth: 130 }}>
                    <div style={{ fontSize: 28, lineHeight: "1.1" }}>{wilayaCode || wilayaName}</div>
                    <div style={{ fontSize: 14, lineHeight: "1.2", marginTop: 2 }}>{wilayaCode ? wilayaName : communeName}</div>
                    <div style={{ fontSize: 11, lineHeight: "1.2", marginTop: 2 }}>{communeName}</div>
                  </div>
                  <div style={{ marginTop: 4, background: isEchangeReturn ? "#7c3aed" : "#000", color: "#fff", fontSize: 10, fontWeight: "bold", padding: "2px 10px", display: "inline-block", letterSpacing: 1 }}>
                    {isEchangeReturn ? "ÉCHANGE RETOUR" : deliveryLabel}
                  </div>
                </div>
              </div>

              {/* TRACKING + BARCODE */}
              <div style={{ padding: "6px 10px", borderBottom: "1px solid #000", textAlign: "center" }}>
                {pkg.external_shipment?.external_tracking ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 2, letterSpacing: 0.5 }}>
                      {pkg.external_shipment.external_tracking}
                    </div>
                    <Barcode value={pkg.external_shipment.external_tracking} height={40} />
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, fontWeight: "bold", marginBottom: 4, letterSpacing: 0.5 }}>
                      {pkg.tracking_number}
                    </div>
                    {isEchangeReturn && pkg.content_description?.match(/réf: (DLV-[\w-]+)/)?.[1] && (
                      <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>
                        Original: {pkg.content_description.match(/réf: (DLV-[\w-]+)/)?.[1]}
                      </div>
                    )}
                    <Barcode value={pkg.tracking_number} height={40} />
                  </>
                )}
              </div>

              {/* DESTINATAIRE */}
              <div style={{ margin: "6px 8px", border: "1.5px solid #000", padding: "6px 8px" }}>
                <div style={{ fontSize: 10, fontWeight: "bold", textDecoration: "underline", marginBottom: 4 }}>
                  DESTINATAIRE :
                </div>
                <div style={{ fontSize: 13, fontWeight: "bold" }}>{pkg.recipient_name}</div>
                <div style={{ fontSize: 12, marginTop: 2 }}>{pkg.recipient_phone}</div>
                <div style={{ fontSize: 12, marginTop: 2 }}>{communeName}</div>
                {pkg.recipient_address && (
                  <div style={{ fontSize: 11, color: "#444", marginTop: 1 }}>{pkg.recipient_address}</div>
                )}
              </div>

              {/* POIDS */}
              <div style={{ padding: "4px 10px", borderTop: "1px solid #ccc", borderBottom: "1px solid #ccc" }}>
                <div style={{ border: "1.5px solid #000", borderRadius: 4, padding: "3px 10px", fontWeight: "bold", fontSize: 12, display: "inline-block" }}>
                  {pkg.weight || 0} KG
                </div>
              </div>

              {/* DETAILS */}
              <div style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1.5, borderBottom: "1px solid #ccc" }}>
                <div><b>Produit :</b> {pkg.content_description || "-"}</div>
                <div><b>Wilaya :</b> {wilayaCode ? `${wilayaCode} - ${wilayaName}` : wilayaName}</div>
                <div><b>Commune :</b> {communeName}</div>
                <div><b>Date :</b> {expeditionDate}</div>
                {originSdLabel && (
                  <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}><b>SD origine :</b> {originSdLabel}</div>
                )}
                {pkg.special_instructions && <div><b>Instructions :</b> {pkg.special_instructions}</div>}
              </div>

              {/* EXPEDITEUR + QR */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderBottom: "1px solid #ccc", background: "#fff" }}>
                <div style={{ border: "1.5px solid #000", padding: "6px 8px", flex: 1, marginRight: 8, background: "#fff" }}>
                  <div style={{ fontSize: 10, fontWeight: "bold", textDecoration: "underline", marginBottom: 4, color: "#000" }}>
                    EXPÉDITEUR :
                  </div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "#000" }}>{pkg.sender_name}</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{wilayaName}</div>
                  <div style={{ fontSize: 12, marginTop: 2, color: "#000" }}>{pkg.sender_phone}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: "4px", background: "#fff" }}>
                  <QRCodeSVG value={pkg.external_shipment?.external_tracking ?? pkg.tracking_number} size={76} level="M" />
                </div>
              </div>

              {/* BOTTOM: Total + barcode (skip for DHD — already has barcode on top) */}
              <div style={{ padding: "8px 10px", textAlign: "center", background: "#fff" }}>
                <div style={{ fontSize: 18, fontWeight: "bold", marginBottom: pkg.external_shipment?.external_tracking ? 0 : 6, color: "#000" }}>
                  {totalAmount.toLocaleString("fr-FR")} DZD
                </div>
                {!pkg.external_shipment?.external_tracking && (
                  <Barcode value={pkg.tracking_number} height={35} />
                )}
              </div>

            </div>
          </div>
        </div>

        {/* DHD Échange: second label — same format, -EXCH suffix */}
        {isDhdEchange && dhdTracking && (
          <div style={{ marginTop: 16 }}>
            <div style={{
              padding: "6px 12px", marginBottom: 8, borderRadius: 8,
              background: isDark ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.06)",
              fontSize: 12, fontWeight: 700, color: "#7c3aed", textAlign: "center",
            }}>
              Étiquette retour échange (à mettre dans le colis)
            </div>
            <div ref={printRef2} style={{ width: 380, fontFamily: "Arial, sans-serif", fontSize: 12, color: "#000", background: "#fff" }}>
              <div style={{ border: "2px solid #000", padding: 0, background: "#fff" }}>
                {/* TOP HEADER */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 10px 6px", borderBottom: "2px solid #000" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 1 }}>DELIVERY</div>
                    <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>Échange</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ border: "2px solid #000", padding: "6px 14px", fontWeight: "bold", minWidth: 130 }}>
                      <div style={{ fontSize: 28, lineHeight: "1.1" }}>{wilayaCode || wilayaName}</div>
                      <div style={{ fontSize: 14, lineHeight: "1.2", marginTop: 2 }}>{wilayaCode ? wilayaName : communeName}</div>
                      <div style={{ fontSize: 11, lineHeight: "1.2", marginTop: 2 }}>{communeName}</div>
                    </div>
                    <div style={{ marginTop: 4, background: "#7c3aed", color: "#fff", fontSize: 10, fontWeight: "bold", padding: "2px 10px", display: "inline-block", letterSpacing: 1 }}>
                      ÉCHANGE RETOUR
                    </div>
                  </div>
                </div>
                {/* TRACKING + BARCODE */}
                <div style={{ padding: "6px 10px", borderBottom: "1px solid #000", textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 2, letterSpacing: 0.5 }}>
                    {dhdTracking}-EXCH
                  </div>
                  <Barcode value={`${dhdTracking}-EXCH`} height={40} />
                </div>
                {/* DESTINATAIRE */}
                <div style={{ margin: "6px 8px", border: "1.5px solid #000", padding: "6px 8px" }}>
                  <div style={{ fontSize: 10, fontWeight: "bold", textDecoration: "underline", marginBottom: 4 }}>DESTINATAIRE :</div>
                  <div style={{ fontSize: 13, fontWeight: "bold" }}>{pkg.recipient_name}</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>{pkg.recipient_phone}</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>{communeName}</div>
                  {pkg.recipient_address && <div style={{ fontSize: 11, color: "#444", marginTop: 1 }}>{pkg.recipient_address}</div>}
                </div>
                {/* PRODUIT À RÉCUPÉRER */}
                <div style={{ padding: "6px 10px", borderTop: "1px solid #ccc", borderBottom: "1px solid #ccc" }}>
                  <div style={{ fontSize: 11 }}><b>Produit à récupérer :</b> {pkg.exchange_product || "—"}</div>
                </div>
                {/* DETAILS */}
                <div style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1.5, borderBottom: "1px solid #ccc" }}>
                  <div><b>Wilaya :</b> {wilayaCode ? `${wilayaCode} - ${wilayaName}` : wilayaName}</div>
                  <div><b>Commune :</b> {communeName}</div>
                  <div><b>Date :</b> {expeditionDate}</div>
                  {originSdLabel && (
                    <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}><b>SD origine :</b> {originSdLabel}</div>
                  )}
                </div>
                {/* EXPEDITEUR + QR */}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", borderBottom: "1px solid #ccc", background: "#fff" }}>
                  <div style={{ border: "1.5px solid #000", padding: "6px 8px", flex: 1, marginRight: 8, background: "#fff" }}>
                    <div style={{ fontSize: 10, fontWeight: "bold", textDecoration: "underline", marginBottom: 4, color: "#000" }}>EXPÉDITEUR :</div>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: "#000" }}>{pkg.sender_name}</div>
                    <div style={{ fontSize: 12, marginTop: 2, color: "#000" }}>{pkg.sender_phone}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: "4px", background: "#fff" }}>
                    <QRCodeSVG value={`${dhdTracking}-EXCH`} size={76} level="M" />
                  </div>
                </div>
                {/* BOTTOM */}
                <div style={{ padding: "8px 10px", textAlign: "center", background: "#fff" }}>
                  <div style={{ fontSize: 18, fontWeight: "bold", color: "#000" }}>0 DZD</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
