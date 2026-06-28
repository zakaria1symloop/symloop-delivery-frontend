"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GoogleMap, Marker, Polyline, InfoWindow, TrafficLayer, useJsApiLoader } from "@react-google-maps/api";
import { Loader2, AlertTriangle, KeyRound, Layers, Navigation, Clock, Package, X } from "lucide-react";
import { api } from "@/lib/api";
import {
  getNavetteManifest, formatDuration, isNavetteActive, navetteRouteColor, navetteStatusLabel,
  type Navette, type NavetteManifest, type ManifestBag,
} from "@/lib/navettes";

const ORANGE = "#f97316";
const GREEN = "#22c55e";
const RED = "#ef4444";
const PURPLE = "#8b5cf6";

interface NavetteMapGoogleProps {
  /** Caller passes the active fleet; we defensively re-filter so terminée/annulée
   *  can never be drawn even if a stale row slips through. */
  navettes: Navette[];
  isDark: boolean;
  onFocus: (id: number) => void;
}

const ALGERIA_CENTER = { lat: 28.0339, lng: 1.6596 };
const CONTAINER_STYLE: React.CSSProperties = { width: "100%", height: "100%" };

type LatLng = google.maps.LatLngLiteral;

/** Coords of a SD brief, or null when ungeocoded. */
function sdLatLng(sd: { lat: number | null; lng: number | null } | null): LatLng | null {
  if (!sd || sd.lat == null || sd.lng == null) return null;
  return { lat: sd.lat, lng: sd.lng };
}

/** A bag's resolved final-destination marker coords, or null when ungeocoded. */
function bagLatLng(b: ManifestBag): LatLng | null {
  if (b.final_destination.lat == null || b.final_destination.lng == null) return null;
  return { lat: b.final_destination.lat, lng: b.final_destination.lng };
}

/** "SD · Wilaya" label of a bag's final destination. */
function bagDestName(b: ManifestBag): string {
  const sd = b.final_destination.stop_desk?.name;
  const wil = b.final_destination.wilaya?.name;
  if (sd && wil) return `${sd} · ${wil}`;
  return sd ?? wil ?? "Destination finale";
}

/* Minimal dark map theme so the canvas matches the app's dark tokens. */
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0f1623" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0e1017" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a3145" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e2130" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2a3145" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b0e16" }] },
];

/* ── Loading-state shell shared by every placeholder ── */
function Placeholder({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center",
        background: isDark ? "#0f1623" : "#f9fafb",
      }}
    >
      {children}
    </div>
  );
}

export default function NavetteMapGoogle({ navettes, isDark, onFocus }: NavetteMapGoogleProps) {
  // undefined = still fetching the key · null = backend has no key · string = key.
  const [mapsKey, setMapsKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    // The endpoint returns { data: { key } } (no `success` envelope), so we read
    // data.key directly rather than relying on res.success.
    api<{ key: string | null }>("/config/maps-key").then((res) => {
      if (cancelled) return;
      const key = res?.data?.key;
      setMapsKey(key ? key : null);
    });
    return () => { cancelled = true; };
  }, []);

  if (mapsKey === undefined) {
    return (
      <Placeholder isDark={isDark}>
        <Loader2 size={22} className="spin" style={{ color: ORANGE }} />
        <span style={{ fontSize: 13, color: isDark ? "#d1d5db" : "#374151", fontWeight: 500 }}>
          Chargement de la carte…
        </span>
      </Placeholder>
    );
  }

  if (mapsKey === null) {
    return (
      <Placeholder isDark={isDark}>
        <KeyRound size={26} color={isDark ? "#4b5563" : "#9ca3af"} />
        <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#f0f0f5" : "#111827" }}>
          Clé Google Maps non configurée
        </span>
        <span style={{ fontSize: 12.5, color: isDark ? "#6b7280" : "#6b7280", maxWidth: 360 }}>
          Ajoutez une clé Google Maps pour afficher les itinéraires routiers réels des navettes.
        </span>
        <Link
          href="/dashboard/admin/api-keys"
          style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9,
            background: ORANGE, color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}
        >
          <KeyRound size={14} /> Configurer la clé API
        </Link>
      </Placeholder>
    );
  }

  return <MapInner apiKey={mapsKey} navettes={navettes} isDark={isDark} onFocus={onFocus} />;
}

/* ───────────────────────── Inner map (key is known) ───────────────────────── */
type Selected = { id: number; position: LatLng; title: string; sub: string };

function MapInner({
  apiKey, navettes, isDark, onFocus,
}: { apiKey: string } & NavetteMapGoogleProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "navette-google-maps",
    googleMapsApiKey: apiKey,
    // DirectionsService lives in the JS API core — no extra libraries needed.
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  // Real road geometry per navette id (overview_path → LatLngLiterals).
  const [paths, setPaths] = useState<Record<number, LatLng[]>>({});
  // Dedupe DirectionsService calls by origin→dest signature (routes are reused).
  const routeCache = useRef<Map<string, LatLng[]>>(new Map());
  const [traffic, setTraffic] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);

  // ── Selected navette → its smart manifest (bag-destination markers + ETA) ──
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [manifest, setManifest] = useState<NavetteManifest | null>(null);
  const [bagInfo, setBagInfo] = useState<{ position: LatLng; tracking: string; dest: string } | null>(null);

  // Active fleet only, with usable origin/dest coords.
  const active = useMemo(
    () => navettes.filter((n) => isNavetteActive(n.status)),
    [navettes],
  );

  // Fetch the manifest for the selected navette (assigned/loaded bag destinations).
  useEffect(() => {
    if (selectedId == null) { setManifest(null); return; }
    let cancelled = false;
    getNavetteManifest(selectedId).then((res) => {
      if (cancelled) return;
      setManifest(res.success && res.data && res.data.navette.id === selectedId ? res.data : null);
    });
    return () => { cancelled = true; };
  }, [selectedId]);

  // Deduped, geocoded bag-destination markers for the selected navette.
  const bagMarkers = useMemo(() => {
    if (!manifest) return [] as { tracking: string; dest: string; position: LatLng }[];
    const seen = new Set<string>();
    const out: { tracking: string; dest: string; position: LatLng }[] = [];
    for (const b of [...manifest.to_load.confirmed, ...manifest.to_load.to_scan]) {
      if (seen.has(b.tracking_number)) continue;
      const position = bagLatLng(b);
      if (!position) continue;
      seen.add(b.tracking_number);
      out.push({ tracking: b.tracking_number, dest: bagDestName(b), position });
    }
    return out;
  }, [manifest]);

  // ── Fetch the REAL road route for every navette via DirectionsService ──────
  useEffect(() => {
    if (!isLoaded) return;
    const svc = new google.maps.DirectionsService();
    let cancelled = false;

    for (const n of active) {
      const origin = sdLatLng(n.origin_stop_desk);
      const dest = sdLatLng(n.destination_stop_desk);
      if (!origin || !dest) continue;

      const sig = `${origin.lat},${origin.lng}->${dest.lat},${dest.lng}`;
      const cached = routeCache.current.get(sig);
      if (cached) {
        setPaths((p) => (p[n.id] === cached ? p : { ...p, [n.id]: cached }));
        continue;
      }

      svc.route(
        { origin, destination: dest, travelMode: google.maps.TravelMode.DRIVING },
        (res, status) => {
          if (cancelled) return;
          if (status === google.maps.DirectionsStatus.OK && res?.routes?.[0]) {
            const path = res.routes[0].overview_path.map((ll) => ({ lat: ll.lat(), lng: ll.lng() }));
            routeCache.current.set(sig, path);
            setPaths((p) => ({ ...p, [n.id]: path }));
          } else {
            // Skip this route gracefully — keep the rest of the map alive.
            console.debug(`[navette] DirectionsService failed for #${n.id}: ${status}`);
          }
        },
      );
    }
    return () => { cancelled = true; };
  }, [isLoaded, active]);

  // ── Fit bounds to every drawn route + stop-desk ────────────────────────────
  const fitToFleet = useCallback(() => {
    const map = mapRef.current;
    if (!map || typeof google === "undefined") return;
    const bounds = new google.maps.LatLngBounds();
    let any = false;
    for (const n of active) {
      const origin = sdLatLng(n.origin_stop_desk);
      const dest = sdLatLng(n.destination_stop_desk);
      if (origin) { bounds.extend(origin); any = true; }
      if (dest) { bounds.extend(dest); any = true; }
      for (const pt of paths[n.id] ?? []) bounds.extend(pt);
    }
    if (!any) { map.setCenter(ALGERIA_CENTER); map.setZoom(5); return; }
    map.fitBounds(bounds, 48);
  }, [active, paths]);

  useEffect(() => { if (isLoaded) fitToFleet(); }, [isLoaded, fitToFleet]);

  // When a navette is selected, fit to its route + bag destinations so the
  // freshly plotted bag markers are guaranteed to be on screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!isLoaded || !map || typeof google === "undefined" || !manifest) return;
    const bounds = new google.maps.LatLngBounds();
    let any = false;
    const nav = manifest.navette;
    const o = sdLatLng(nav.origin_stop_desk);
    const d = sdLatLng(nav.destination_stop_desk);
    if (o) { bounds.extend(o); any = true; }
    if (d) { bounds.extend(d); any = true; }
    for (const pt of paths[nav.id] ?? []) bounds.extend(pt);
    for (const b of bagMarkers) { bounds.extend(b.position); any = true; }
    if (any) map.fitBounds(bounds, 64);
  }, [isLoaded, manifest, bagMarkers, paths]);

  const onMapLoad = useCallback((map: google.maps.Map) => { mapRef.current = map; }, []);
  const onMapUnmount = useCallback(() => { mapRef.current = null; }, []);

  if (loadError) {
    return (
      <Placeholder isDark={isDark}>
        <AlertTriangle size={24} color={RED} />
        <span style={{ fontSize: 13, color: isDark ? "#d1d5db" : "#374151", fontWeight: 500 }}>
          Impossible de charger Google Maps. Vérifiez la clé API.
        </span>
      </Placeholder>
    );
  }

  if (!isLoaded) {
    return (
      <Placeholder isDark={isDark}>
        <Loader2 size={22} className="spin" style={{ color: ORANGE }} />
        <span style={{ fontSize: 13, color: isDark ? "#d1d5db" : "#374151", fontWeight: 500 }}>
          Chargement de la carte…
        </span>
      </Placeholder>
    );
  }

  const markerIcon = (fill: string): google.maps.Symbol => ({
    path: google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: fill,
    fillOpacity: 1,
    strokeColor: isDark ? "#0e1017" : "#ffffff",
    strokeWeight: 2.5,
  });

  // Bag final-destination marker — smaller orange diamond, distinct from SD dots.
  const bagDestIcon: google.maps.Symbol = {
    path: "M 0 -7 L 7 0 L 0 7 L -7 0 Z",
    scale: 1.05,
    fillColor: ORANGE,
    fillOpacity: 0.95,
    strokeColor: isDark ? "#0e1017" : "#ffffff",
    strokeWeight: 2,
  };

  const focus = (n: Navette, position: LatLng, sub: string) => {
    const oName = n.origin_stop_desk?.name ?? `SD #${n.origin_stop_desk_id}`;
    const dName = n.destination_stop_desk?.name ?? `SD #${n.destination_stop_desk_id}`;
    setSelected({ id: n.id, position, title: `${oName} → ${dName}`, sub });
    setSelectedId(n.id);          // drives bag-destination markers + ETA overlay
    setBagInfo(null);
    onFocus(n.id);
  };

  const clearSelection = () => { setSelectedId(null); setBagInfo(null); setSelected(null); };

  const selectedNav = manifest?.navette ?? null;
  const route = selectedNav?.route ?? null;

  return (
    <div style={{ position: "relative", inset: 0, width: "100%", height: "100%" }}>
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={ALGERIA_CENTER}
        zoom={5}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          gestureHandling: "greedy",
          styles: isDark ? DARK_MAP_STYLE : undefined,
          backgroundColor: isDark ? "#0f1623" : "#f9fafb",
        }}
      >
        {traffic && <TrafficLayer />}

        {active.map((n) => {
          const color = navetteRouteColor(n.status);
          const origin = sdLatLng(n.origin_stop_desk);
          const dest = sdLatLng(n.destination_stop_desk);
          const path = paths[n.id];
          const oName = n.origin_stop_desk?.name ?? `SD #${n.origin_stop_desk_id}`;
          const dName = n.destination_stop_desk?.name ?? `SD #${n.destination_stop_desk_id}`;
          return (
            <Fragment key={n.id}>
              {path && path.length >= 2 && (
                <Polyline
                  path={path}
                  options={{
                    strokeColor: color,
                    strokeOpacity: 0.9,
                    strokeWeight: 5,
                    clickable: true,
                    zIndex: n.status === "en_route" ? 30 : n.status === "assignee" ? 20 : 10,
                  }}
                  onClick={(e) => {
                    const pos = e.latLng ? { lat: e.latLng.lat(), lng: e.latLng.lng() } : (origin ?? ALGERIA_CENTER);
                    focus(n, pos, navetteStatusLabel(n.status));
                  }}
                />
              )}

              {origin && (
                <Marker
                  position={origin}
                  icon={markerIcon(GREEN)}
                  title={`Départ · ${oName}`}
                  onClick={() => focus(n, origin, `Départ · ${oName}`)}
                />
              )}
              {dest && (
                <Marker
                  position={dest}
                  icon={markerIcon(RED)}
                  title={`Arrivée · ${dName}`}
                  onClick={() => focus(n, dest, `Arrivée · ${dName}`)}
                />
              )}
            </Fragment>
          );
        })}

        {/* Bag final-destination markers for the selected navette */}
        {bagMarkers.map((b) => (
          <Marker
            key={`bag-${b.tracking}`}
            position={b.position}
            icon={bagDestIcon}
            title={`${b.tracking} → ${b.dest}`}
            zIndex={40}
            onClick={() => setBagInfo({ position: b.position, tracking: b.tracking, dest: b.dest })}
          />
        ))}

        {bagInfo && (
          <InfoWindow position={bagInfo.position} onCloseClick={() => setBagInfo(null)}>
            <div style={{ fontFamily: "var(--font-jakarta, sans-serif)", minWidth: 150 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 12.5, color: "#111827" }}>
                <span style={{ width: 8, height: 8, transform: "rotate(45deg)", background: ORANGE, display: "inline-block" }} />
                {bagInfo.tracking}
              </div>
              <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>Dest. finale : {bagInfo.dest}</div>
            </div>
          </InfoWindow>
        )}

        {selected && (
          <InfoWindow position={selected.position} onCloseClick={() => setSelected(null)}>
            <div style={{ fontFamily: "var(--font-jakarta, sans-serif)", minWidth: 150 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: "#111827" }}>{selected.title}</div>
              <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{selected.sub}</div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* ── Selected navette: route distance + ETA-with-traffic + bag-dest count ── */}
      {selectedNav && (
        <div style={{
          position: "absolute", top: 12, left: 12, zIndex: 5, maxWidth: 270,
          background: isDark ? "#111827" : "#ffffff",
          border: `1px solid ${isDark ? "#1e2130" : "#e5e7eb"}`,
          borderRadius: 11, boxShadow: "0 2px 10px rgba(0,0,0,0.18)", padding: "11px 13px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: isDark ? "#f0f0f5" : "#111827", lineHeight: 1.3 }}>
              {selectedNav.origin_stop_desk?.name ?? "Origine"} → {selectedNav.destination_stop_desk?.name ?? "Destination"}
            </div>
            <button onClick={clearSelection} title="Effacer la sélection" style={{ border: "none", background: "none", cursor: "pointer", color: isDark ? "#6b7280" : "#9ca3af", padding: 0, flexShrink: 0 }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 9 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: isDark ? "#d1d5db" : "#374151" }}>
              <Navigation size={13} color="#3b82f6" />{route?.distance_km != null ? `${route.distance_km} km` : "— km"}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: isDark ? "#d1d5db" : "#374151" }}>
              <Clock size={13} color={PURPLE} />{route?.duration_min != null ? formatDuration(route.duration_min) : "—"}
            </span>
          </div>
          {route?.duration_traffic_min != null && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: RED, marginTop: 7 }}>
              <Clock size={13} color={RED} /> Trafic : {formatDuration(route.duration_traffic_min)}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: isDark ? "#9ca3af" : "#6b7280", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${isDark ? "#1e2130" : "#f3f4f6"}` }}>
            <Package size={12} color={ORANGE} /> {bagMarkers.length} destination{bagMarkers.length > 1 ? "s" : ""} de sac affichée{bagMarkers.length > 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Traffic-layer toggle (live traffic) */}
      <button
        type="button"
        onClick={() => setTraffic((v) => !v)}
        title="Afficher le trafic en temps réel"
        style={{
          position: "absolute", top: 12, right: 12, zIndex: 5,
          display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 9,
          fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          background: traffic ? ORANGE : (isDark ? "#111827" : "#ffffff"),
          color: traffic ? "#fff" : (isDark ? "#d1d5db" : "#374151"),
          border: `1px solid ${traffic ? ORANGE : (isDark ? "#1e2130" : "#e5e7eb")}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        }}
      >
        <Layers size={14} /> Trafic
      </button>
    </div>
  );
}
