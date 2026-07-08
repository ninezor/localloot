import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Loader2 } from "lucide-react";

const GREEN = "#0B7C4E";
const MUTE = "#A2A8A3";

const validCoord = (p) =>
  p && isFinite(p.lat) && isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

const pinHtml = (m) => `
  <div style="width:34px;height:34px;border-radius:50% 50% 50% 6px;transform:rotate(-45deg);
    background:${m.status === "gone" ? MUTE : GREEN};border:3px solid #fff;
    box-shadow:0 3px 6px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;">
    <span style="transform:rotate(45deg);font-size:15px;line-height:1">${m.emoji || "📦"}</span>
  </div>`;

export default function MapView({
  center,
  zoom = 15,
  markers = [],
  draggable = false,
  onDragEnd,
  onSelect,
  fitAll = false,
  height = 280,
}) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tilesBlocked, setTilesBlocked] = useState(false);

  const safeCenter = validCoord(center) ? center : { lat: -33.8908, lng: 151.2743 };

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    setFailed(false);
    try {
      const map = L.map(boxRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([safeCenter.lat, safeCenter.lng], zoom);

      // Try OSM tiles, then Carto; if both fail with zero successes, tell the user.
      const attachTiles = (url, opts, onFail) => {
        const layer = L.tileLayer(url, opts);
        let errors = 0;
        let loads = 0;
        layer.on("tileload", () => { loads += 1; });
        layer.on("tileerror", () => {
          errors += 1;
          if (errors >= 3 && loads === 0) {
            try { map.removeLayer(layer); } catch (e) { /* ignore */ }
            onFail();
          }
        });
        layer.addTo(map);
      };
      attachTiles(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" },
        () =>
          attachTiles(
            "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            {
              maxZoom: 19,
              subdomains: "abcd",
              attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
            },
            () => setTilesBlocked(true)
          )
      );

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
      setTimeout(() => {
        try { map.invalidateSize(); } catch (e) { /* unmounted */ }
      }, 120);
    } catch (e) {
      setFailed(true);
    }
    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch (e) { /* already gone */ }
        mapRef.current = null;
        layerRef.current = null;
        setReady(false);
      }
    };
  }, [attempt]);

  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current) return;
    try {
      layerRef.current.clearLayers();
      markers.filter(validCoord).forEach((m) => {
        const icon = L.divIcon({
          className: "",
          html: pinHtml(m),
          iconSize: [34, 42],
          iconAnchor: [17, 40],
        });
        const mk = L.marker([m.lat, m.lng], { icon, draggable });
        if (draggable && onDragEnd) {
          mk.on("dragend", (e) => {
            const p = e.target.getLatLng();
            onDragEnd({ lat: p.lat, lng: p.lng });
          });
        }
        if (onSelect) mk.on("click", () => onSelect(m.id));
        mk.addTo(layerRef.current);
      });
      const fitable = markers.filter(validCoord);
      if (fitAll && fitable.length > 1) {
        const b = L.latLngBounds(fitable.map((m) => [m.lat, m.lng]));
        mapRef.current.fitBounds(b, { padding: [34, 34] });
      }
    } catch (e) {
      /* never let a bad marker take down the app */
    }
  }, [ready, markers, draggable, fitAll]);

  useEffect(() => {
    if (ready && mapRef.current && !fitAll) {
      try {
        mapRef.current.setView(
          [safeCenter.lat, safeCenter.lng],
          mapRef.current.getZoom()
        );
      } catch (e) { /* ignore */ }
    }
  }, [safeCenter.lat, safeCenter.lng, ready, fitAll]);

  if (failed) {
    return (
      <div
        className="sf-mapfail"
        style={{ height, flexDirection: "column", gap: 10, padding: "14px 20px" }}
      >
        <span>
          <MapPin size={15} style={{ verticalAlign: "-2px" }} /> Map couldn&apos;t
          load — pin is at {safeCenter.lat.toFixed(5)}, {safeCenter.lng.toFixed(5)}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="sf-chipbtn" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
          <a
            className="sf-chipbtn"
            style={{ textDecoration: "none" }}
            href={`https://www.google.com/maps?q=${safeCenter.lat},${safeCenter.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps
          </a>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", height, width: "100%" }}>
      <div ref={boxRef} style={{ height: "100%", width: "100%" }} className="sf-map sf-gridbg" />
      {!ready && (
        <div className="sf-maploading">
          <Loader2 size={16} className="sf-spin" /> Loading map…
        </div>
      )}
      {ready && tilesBlocked && (
        <div className="sf-tilenote">
          <span>
            Map imagery couldn't load — check your connection. The pin still
            sets the exact spot.
          </span>
          <a
            href={`https://www.google.com/maps?q=${safeCenter.lat},${safeCenter.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Check on Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
