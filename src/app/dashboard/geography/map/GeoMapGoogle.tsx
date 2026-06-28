"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  GoogleMap,
  InfoWindow,
  useJsApiLoader,
  // Re-export of the installed `@googlemaps/markerclusterer` module namespace.
  // Using it (rather than importing the package directly) keeps us on a
  // declared dependency — @react-google-maps/api owns @googlemaps/markerclusterer.
  GoogleMapsMarkerClusterer,
} from "@react-google-maps/api";
import { Loader2, KeyRound, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import type { Wilaya, Commune, StopDesk } from "@/lib/geography";

/* ── Layer colors (mirror the page's LAYER_CFG / legend) ──────────────────── */
const ORANGE = "#f97316"; // wilaya
const BLUE = "#3b82f6";   // commune
const RED = "#ef4444";

const DESK_COLORS: Record<string, string> = {
  agence: "#3b82f6",
  depot:  "#f59e0b",
  hub:    "#10b981",
};
const DESK_LABELS: Record<string, string> = {
  agence: "Agence",
  depot:  "Dépôt",
  hub:    "HUB",
};

interface GeoMapGoogleProps {
  wilayas: Wilaya[];
  communes: Commune[];
  desks: StopDesk[];
  layers: { wilayas: boolean; communes: boolean; desks: boolean };
  deskTypeFilter: string;
  isDark: boolean;
}

const ALGERIA_CENTER = { lat: 28.0339, lng: 1.6596 };
const CONTAINER_STYLE: React.CSSProperties = { width: "100%", height: "100%" };

type LatLng = google.maps.LatLngLiteral;

/* Minimal dark map theme — identical to the navette map for visual consistency. */
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

/* ── Loading-state shell shared by every placeholder (mirrors navette) ──────── */
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

export default function GeoMapGoogle(props: GeoMapGoogleProps) {
  // undefined = still fetching the key · null = backend has no key · string = key.
  const [mapsKey, setMapsKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    // The endpoint returns { data: { key } } (no `success` envelope).
    api<{ key: string | null }>("/config/maps-key").then((res) => {
      if (cancelled) return;
      const key = res?.data?.key;
      setMapsKey(key ? key : null);
    });
    return () => { cancelled = true; };
  }, []);

  if (mapsKey === undefined) {
    return (
      <Placeholder isDark={props.isDark}>
        <Loader2 size={22} className="animate-spin" style={{ color: ORANGE }} />
        <span style={{ fontSize: 13, color: props.isDark ? "#d1d5db" : "#374151", fontWeight: 500 }}>
          Chargement de la carte…
        </span>
      </Placeholder>
    );
  }

  if (mapsKey === null) {
    return (
      <Placeholder isDark={props.isDark}>
        <KeyRound size={26} color={props.isDark ? "#4b5563" : "#9ca3af"} />
        <span style={{ fontSize: 14, fontWeight: 700, color: props.isDark ? "#f0f0f5" : "#111827" }}>
          Clé Google Maps non configurée
        </span>
        <span style={{ fontSize: 12.5, color: "#6b7280", maxWidth: 360 }}>
          Ajoutez une clé Google Maps pour afficher la carte du réseau (wilayas, communes, stop-desks).
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

  return <MapInner apiKey={mapsKey} {...props} />;
}

/* ───────────────────────── Inner map (key is known) ───────────────────────── */
type Selected = { position: LatLng; title: string; sub: string };

/** A flat description of one marker, derived from the enabled layers. */
type MarkerSpec = {
  id: string;
  position: LatLng;
  icon: google.maps.Symbol;
  title: string;     // native hover tooltip
  infoTitle: string; // InfoWindow heading
  infoSub: string;   // InfoWindow type/sub line
  zIndex: number;
};

/* Cluster bubble renderer themed to the app's orange so it matches dark mode. */
function makeClusterRenderer(isDark: boolean) {
  return {
    render({ count, position }: { count: number; position: google.maps.LatLng }) {
      const svg = window.btoa(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="22" fill="${ORANGE}" opacity="0.22" />
          <circle cx="24" cy="24" r="15" fill="${ORANGE}" opacity="0.95"
            stroke="${isDark ? "#0e1017" : "#ffffff"}" stroke-width="2" />
        </svg>`,
      );
      return new google.maps.Marker({
        position,
        icon: {
          url: `data:image/svg+xml;base64,${svg}`,
          scaledSize: new google.maps.Size(46, 46),
          anchor: new google.maps.Point(23, 23),
        },
        label: { text: String(count), color: "#ffffff", fontSize: "12px", fontWeight: "700" },
        zIndex: 1000 + count,
      });
    },
  };
}

function MapInner({
  apiKey, wilayas, communes, desks, layers, deskTypeFilter, isDark,
}: { apiKey: string } & GeoMapGoogleProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    // Same id as the navette map: the underlying Loader is a global singleton,
    // so all pages must request Google Maps with identical options.
    id: "navette-google-maps",
    googleMapsApiKey: apiKey,
  });

  // Map kept in state (not a ref) so the marker/cluster effect re-runs on load.
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);

  /* ── Build marker specs for the enabled layers (only those with lat/lng) ──── */
  const specs = useMemo<MarkerSpec[]>(() => {
    if (!isLoaded) return [];
    const ring = (color: string, scale: number): google.maps.Symbol => ({
      path: google.maps.SymbolPath.CIRCLE,
      scale, fillColor: color, fillOpacity: 0.22,
      strokeColor: color, strokeWeight: 1.8,
    });
    const dot = (color: string, scale: number): google.maps.Symbol => ({
      path: google.maps.SymbolPath.CIRCLE,
      scale, fillColor: color, fillOpacity: 0.85,
      strokeColor: color, strokeWeight: 1,
    });
    const pin = (color: string): google.maps.Symbol => ({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 7, fillColor: color, fillOpacity: 0.95,
      strokeColor: isDark ? "#0e1017" : "#ffffff", strokeWeight: 2,
    });

    const out: MarkerSpec[] = [];

    if (layers.wilayas) {
      for (const w of wilayas) {
        if (w.lat == null || w.lng == null) continue;
        out.push({
          id: `w-${w.id}`,
          position: { lat: w.lat, lng: w.lng },
          icon: ring(ORANGE, 9),
          title: w.name,
          infoTitle: w.name,
          infoSub: w.code ? `Wilaya · ${w.code}` : "Wilaya",
          zIndex: 30,
        });
      }
    }

    if (layers.communes) {
      for (const c of communes) {
        if (c.lat == null || c.lng == null) continue;
        out.push({
          id: `c-${c.id}`,
          position: { lat: c.lat, lng: c.lng },
          icon: dot(BLUE, 5),
          title: c.name,
          infoTitle: c.name,
          infoSub: c.wilaya ? `Commune · ${c.wilaya.name}` : "Commune",
          zIndex: 10,
        });
      }
    }

    if (layers.desks) {
      const visible = deskTypeFilter === "all"
        ? desks
        : desks.filter((d) => d.type === deskTypeFilter);
      for (const d of visible) {
        if (d.lat == null || d.lng == null) continue;
        const color = DESK_COLORS[d.type ?? "agence"] ?? "#6b7280";
        out.push({
          id: `d-${d.id}`,
          position: { lat: d.lat, lng: d.lng },
          icon: pin(color),
          title: d.name,
          infoTitle: d.name,
          infoSub: `${DESK_LABELS[d.type ?? "agence"]}${d.code ? ` · ${d.code}` : ""}`,
          zIndex: 20,
        });
      }
    }

    return out;
  }, [isLoaded, wilayas, communes, desks, layers, deskTypeFilter, isDark]);

  /* ── Imperatively build markers + clusterer (batch add for performance) ───── */
  useEffect(() => {
    if (!map || !isLoaded) return;

    // Close any stale InfoWindow when the marker set is rebuilt.
    setSelected(null);

    const markers = specs.map((spec) => {
      const marker = new google.maps.Marker({
        position: spec.position,
        icon: spec.icon,
        title: spec.title,
        zIndex: spec.zIndex,
      });
      marker.addListener("click", () => {
        setSelected({ position: spec.position, title: spec.infoTitle, sub: spec.infoSub });
      });
      return marker;
    });

    // Single batched cluster build — avoids the per-marker redraw lag that a
    // <Marker clusterer={...}> children approach would cause for ~1398 communes.
    const clusterer = new GoogleMapsMarkerClusterer.MarkerClusterer({
      map,
      markers,
      renderer: makeClusterRenderer(isDark),
    });

    return () => {
      clusterer.clearMarkers();
      clusterer.setMap(null);
      markers.forEach((m) => google.maps.event.clearInstanceListeners(m));
    };
  }, [map, isLoaded, specs, isDark]);

  /* ── Fit bounds to the currently visible markers ──────────────────────────── */
  useEffect(() => {
    if (!map || !isLoaded) return;
    if (specs.length === 0) {
      map.setCenter(ALGERIA_CENTER);
      map.setZoom(5);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const s of specs) bounds.extend(s.position);
    map.fitBounds(bounds, 48);
  }, [map, isLoaded, specs]);

  const onMapLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onMapUnmount = useCallback(() => setMap(null), []);

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
        <Loader2 size={22} className="animate-spin" style={{ color: ORANGE }} />
        <span style={{ fontSize: 13, color: isDark ? "#d1d5db" : "#374151", fontWeight: 500 }}>
          Chargement de la carte…
        </span>
      </Placeholder>
    );
  }

  return (
    <div style={{ position: "relative", zIndex: 0, width: "100%", height: "100%" }}>
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
        {selected && (
          <InfoWindow position={selected.position} onCloseClick={() => setSelected(null)}>
            <div style={{ fontFamily: "var(--font-jakarta, sans-serif)", minWidth: 140 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: "#111827" }}>{selected.title}</div>
              <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{selected.sub}</div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
