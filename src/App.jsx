import { useEffect, useRef, useState } from "react";
import exifr from "exifr";
import {
  MapPin, Plus, Camera, Image as ImageIcon, ChevronLeft, Clock,
  LayoutGrid, Map as MapIcon, Crosshair, Navigation, Check, X,
  Loader2, Heart, RefreshCw, Info,
} from "lucide-react";
import MapView from "./MapView.jsx";
import { listFinds, addFind, setFindStatus, isShared } from "./store.js";
import { kmBetween, distLabel, timeAgo, resizeImage } from "./utils.js";

/* theme */
const INK = "#171A18";
const PAVE = "#F6F7F4";
const GREEN = "#0B7C4E";
const GREEN_DARK = "#08603C";
const TAPE = "#0B7C4E";
const MUTE = "#7C837E";

const DONATE_URL = import.meta.env.VITE_DONATE_URL || "#";
const DEFAULT_CENTER = { lat: -33.8908, lng: 151.2743 }; // Bondi Beach

const CATEGORIES = [
  { id: "furniture", label: "Furniture", emoji: "🛋️" },
  { id: "kitchen", label: "Kitchen", emoji: "🍳" },
  { id: "kids", label: "Kids", emoji: "🧸" },
  { id: "electronics", label: "Electronics", emoji: "🔌" },
  { id: "plants", label: "Plants", emoji: "🪴" },
  { id: "books", label: "Books", emoji: "📚" },
  { id: "other", label: "Other", emoji: "📦" },
];

const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[6];

/* ------------------------------ small pieces ------------------------------ */

function FreeStamp({ gone }) {
  return (
    <span className={`sf-stamp ${gone ? "sf-stamp-gone" : ""}`}>
      {gone ? "GONE" : "FREE"}
    </span>
  );
}

function CardImage({ item, big }) {
  if (item.photo) {
    return (
      <img
        src={item.photo}
        alt={item.title}
        className="sf-photo"
        loading="lazy"
        style={{ height: big ? 300 : 190 }}
      />
    );
  }
  return (
    <div
      className="sf-photo sf-photo-empty"
      style={{ height: big ? 300 : 190 }}
    >
      <span style={{ fontSize: big ? 72 : 52 }}>{item.emoji}</span>
    </div>
  );
}

/* -------------------------------- add flow -------------------------------- */

function AddFind({ onCancel, onPost, defaultCenter, posting }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loc, setLoc] = useState(null);
  const [locSource, setLocSource] = useState(null); // photo | device | manual
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("furniture");
  const [area, setArea] = useState("");
  const [note, setNote] = useState("");
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const handleFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    const dataUrl = await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.readAsDataURL(f);
    });
    setPreview(dataUrl);
    // Read GPS from the ORIGINAL file before any re-encoding strips EXIF.
    try {
      const gps = await exifr.gps(f);
      if (gps && isFinite(gps.latitude) && isFinite(gps.longitude)) {
        setLoc({ lat: gps.latitude, lng: gps.longitude });
        setLocSource("photo");
        setLocMsg(
          `Location found in the photo (${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}) — drag the pin if it's off.`
        );
      } else if (!loc) {
        setLocMsg(
          "This photo has no location data. Usual causes: the camera app's location permission is off, it's a screenshot, or the photo was shared through an app that strips GPS. No problem — use your current location or drop the pin."
        );
      }
    } catch {
      if (!loc) {
        setLocMsg(
          "Couldn't read location from this photo. Use your current location or drop the pin."
        );
      }
    }
    e.target.value = "";
  };

  const useDevice = () => {
    if (!navigator.geolocation) {
      setLocMsg("This browser has no location access — drop the pin manually.");
      setLoc(loc || defaultCenter);
      setLocSource("manual");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocSource("device");
        setLocMsg("Using your current location — drag the pin if it's off.");
        setLocating(false);
      },
      () => {
        setLocMsg("Couldn't get your location — drop the pin manually instead.");
        setLoc(loc || defaultCenter);
        setLocSource("manual");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const useManual = () => {
    setLoc(loc || defaultCenter);
    setLocSource("manual");
    setLocMsg("Drag the pin to where the item is.");
  };

  const canPost = file && loc && title.trim().length > 1 && !posting;

  return (
    <div className="sf-page">
      <div className="sf-topbar">
        <button className="sf-iconbtn" onClick={onCancel} aria-label="Back">
          <ChevronLeft size={22} />
        </button>
        <h2>Post a find</h2>
        <span style={{ width: 38 }} />
      </div>

      <section className="sf-section">
        <div className="sf-label">Photo</div>
        {preview ? (
          <div className="sf-preview">
            <img src={preview} alt="Your find" />
            <button
              className="sf-chipbtn sf-preview-x"
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
            >
              <X size={14} /> Retake
            </button>
          </div>
        ) : (
          <div className="sf-photorow">
            <button className="sf-bigbtn" onClick={() => cameraRef.current.click()}>
              <Camera size={20} />
              Take photo
            </button>
            <button
              className="sf-bigbtn sf-bigbtn-alt"
              onClick={() => galleryRef.current.click()}
            >
              <ImageIcon size={20} />
              From gallery
            </button>
          </div>
        )}
        <p className="sf-hint">
          Gallery photos may carry GPS data; camera shots here won&apos;t —
          that&apos;s normal, we&apos;ll grab your location instead.
        </p>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handleFile}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          hidden
          onChange={handleFile}
        />
      </section>

      <section className="sf-section">
        <div className="sf-label">Where is it?</div>
        <div className="sf-photorow">
          <button
            className="sf-bigbtn sf-bigbtn-alt"
            onClick={useDevice}
            disabled={locating}
          >
            {locating ? (
              <Loader2 size={20} className="sf-spin" />
            ) : (
              <Crosshair size={20} />
            )}
            My location
          </button>
          <button className="sf-bigbtn sf-bigbtn-alt" onClick={useManual}>
            <MapPin size={20} />
            Drop a pin
          </button>
        </div>
        {locMsg && <p className="sf-hint">{locMsg}</p>}
        {loc && (
          <div className="sf-mapwrap">
            <MapView
              center={loc}
              zoom={16}
              height={220}
              draggable
              markers={[
                {
                  id: "new",
                  lat: loc.lat,
                  lng: loc.lng,
                  emoji: catOf(category).emoji,
                  status: "available",
                },
              ]}
              onDragEnd={(p) => {
                setLoc(p);
                setLocSource("manual");
              }}
            />
            <div className="sf-coords">
              {locSource === "photo"
                ? "From photo metadata"
                : locSource === "device"
                  ? "From your device"
                  : "Pinned by hand"}
              {" · "}
              {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
            </div>
          </div>
        )}
      </section>

      <section className="sf-section">
        <div className="sf-label">Details</div>
        <input
          className="sf-input"
          placeholder="What is it? e.g. Solid timber bookshelf"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
        />
        <div className="sf-chips">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`sf-chip ${category === c.id ? "sf-chip-on" : ""}`}
              onClick={() => setCategory(c.id)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <input
          className="sf-input"
          placeholder="Suburb (optional), e.g. Bondi Beach"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          maxLength={40}
        />
        <textarea
          className="sf-input"
          rows={3}
          placeholder="Condition, pickup notes… e.g. Works fine, out until Sunday"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={240}
        />
      </section>

      <button
        className="sf-post"
        disabled={!canPost}
        onClick={() =>
          onPost(
            {
              title: title.trim(),
              note: note.trim(),
              category,
              emoji: catOf(category).emoji,
              lat: loc.lat,
              lng: loc.lng,
              area: area.trim() || "Local pickup",
            },
            file,
            preview
          )
        }
      >
        {posting ? <Loader2 size={20} className="sf-spin" /> : <Check size={20} />}
        {posting ? "Posting…" : "Post it — it's free"}
      </button>
      {!canPost && !posting && (
        <p className="sf-hint" style={{ textAlign: "center" }}>
          A photo, a pin and a name — that&apos;s all it needs.
        </p>
      )}
    </div>
  );
}

/* ----------------------------------- app ----------------------------------- */

export default function App() {
  const [view, setView] = useState("feed"); // feed | map | add | detail
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [userLoc, setUserLoc] = useState(null);
  const [locating, setLocating] = useState(false);
  const [sortNearest, setSortNearest] = useState(false);
  const [toast, setToast] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await listFinds());
    } catch (e) {
      setToast("Couldn't load finds — check your connection");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortNearest(true);
        setLocating(false);
      },
      () => {
        setToast("Couldn't get your location");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const shown = items
    .filter((i) => filter === "all" || i.category === filter)
    .slice()
    .sort((a, b) => {
      if (sortNearest && userLoc) return kmBetween(userLoc, a) - kmBetween(userLoc, b);
      return b.ts - a.ts;
    });

  const detail = items.find((i) => i.id === detailId);

  const changeStatus = async (id, status) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
    try {
      await setFindStatus(id, status);
      setToast(status === "gone" ? "Thanks — marked as gone" : "Marked as still there");
    } catch {
      setToast("Couldn't update — try again");
      refresh();
    }
  };

  const post = async (fields, file, previewDataUrl) => {
    setPosting(true);
    try {
      const blob = await resizeImage(file);
      const item = await addFind(fields, blob, previewDataUrl);
      setItems((prev) => [item, ...prev]);
      setView("feed");
      setFilter("all");
      setToast("Posted — your find is live");
    } catch {
      setToast("Couldn't post — try again");
    } finally {
      setPosting(false);
    }
  };

  const styles = (
    <style>{`
      .sf-root{max-width:460px;margin:0 auto;min-height:100vh;background:${PAVE};
        font-family:'Manrope',system-ui,sans-serif;color:${INK};position:relative;
        display:flex;flex-direction:column;letter-spacing:-.01em}
      .sf-root *{box-sizing:border-box}
      .sf-header{padding:22px 20px 8px;display:flex;align-items:flex-start;justify-content:space-between}
      .sf-logo{font-family:'Sora',sans-serif;font-weight:800;font-size:24px;letter-spacing:-.03em;margin:0}
      .sf-logo em{font-style:normal;color:${GREEN}}
      .sf-tag{font-size:12.5px;color:${MUTE};font-weight:500;margin-top:3px}
      .sf-page{flex:1;padding-bottom:112px}
      .sf-topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 6px}
      .sf-topbar h2{font-family:'Sora',sans-serif;font-size:17px;font-weight:700;letter-spacing:-.02em;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px}
      .sf-iconbtn{width:38px;height:38px;border-radius:12px;border:1px solid #E5E7E3;background:#fff;
        display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;
        box-shadow:0 1px 2px rgba(23,26,24,.05)}
      .sf-filters{display:flex;gap:8px;overflow-x:auto;padding:10px 20px 16px;scrollbar-width:none}
      .sf-filters::-webkit-scrollbar{display:none}
      .sf-chip{border:none;background:#fff;border-radius:999px;padding:9px 15px;
        font-size:13px;font-weight:600;white-space:nowrap;cursor:pointer;font-family:inherit;
        color:#4A514D;box-shadow:0 1px 2px rgba(23,26,24,.07)}
      .sf-chip-on{background:${INK};color:#fff}
      .sf-cards{display:flex;flex-direction:column;gap:18px;padding:0 20px}
      .sf-card{background:#fff;border:1px solid rgba(23,26,24,.05);border-radius:22px;overflow:hidden;
        box-shadow:0 1px 2px rgba(23,26,24,.04),0 14px 36px -14px rgba(23,26,24,.14);cursor:pointer;
        text-align:left;padding:0;font-family:inherit;transition:transform .15s ease}
      .sf-card:active{transform:scale(.985)}
      .sf-photo{width:100%;object-fit:cover;display:block;background:#ECEEEA}
      .sf-photo-empty{display:flex;align-items:center;justify-content:center}
      .sf-cardbody{padding:14px 16px 16px}
      .sf-cardtitle{font-family:'Sora',sans-serif;font-size:15.5px;font-weight:700;letter-spacing:-.02em;margin:0 0 5px}
      .sf-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;color:${MUTE};font-weight:500;align-items:center}
      .sf-meta svg{vertical-align:-2px}
      .sf-stamp{font-family:'Sora',sans-serif;font-size:11px;font-weight:800;letter-spacing:.1em;
        color:#fff;background:${GREEN};border-radius:999px;padding:6px 12px;display:inline-block;
        box-shadow:0 4px 12px -2px rgba(11,124,78,.45)}
      .sf-stamp-gone{background:#A2A8A3;box-shadow:none}
      .sf-imgwrap{position:relative}
      .sf-imgwrap .sf-stamp{position:absolute;top:12px;left:12px}
      .sf-gone .sf-photo{filter:grayscale(1);opacity:.75}
      .sf-nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;
        background:rgba(255,255,255,.86);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
        border-top:1px solid rgba(23,26,24,.07);display:flex;justify-content:space-around;
        align-items:center;padding:10px 18px calc(12px + env(safe-area-inset-bottom));z-index:1000}
      .sf-navbtn{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10.5px;
        font-weight:600;border:none;background:none;color:#A2A8A3;cursor:pointer;font-family:inherit;text-decoration:none}
      .sf-navbtn.on{color:${GREEN}}
      .sf-navbtn.donate{color:#DE5B4E}
      .sf-fab{width:56px;height:56px;border-radius:20px;background:linear-gradient(135deg,#12B872,${GREEN_DARK});
        border:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;
        box-shadow:0 12px 26px -8px rgba(11,124,78,.55);margin-top:-30px;transition:transform .12s ease}
      .sf-fab:active{transform:scale(.93)}
      .sf-section{padding:12px 20px 4px}
      .sf-label{font-size:11.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
        color:${MUTE};margin-bottom:9px}
      .sf-photorow{display:flex;gap:10px}
      .sf-bigbtn{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;border:none;
        border-radius:16px;background:${GREEN};color:#fff;font-weight:700;font-size:14px;
        padding:15px 8px;cursor:pointer;font-family:inherit;box-shadow:0 8px 18px -8px rgba(11,124,78,.5)}
      .sf-bigbtn-alt{background:#fff;color:${INK};border:1px solid #E5E7E3;box-shadow:0 1px 2px rgba(23,26,24,.05)}
      .sf-bigbtn:disabled{opacity:.55}
      .sf-hint{font-size:12.5px;color:${MUTE};margin:9px 2px 0;line-height:1.5}
      .sf-preview{position:relative;border:1px solid #E5E7E3;border-radius:18px;overflow:hidden;
        box-shadow:0 1px 2px rgba(23,26,24,.05)}
      .sf-preview img{width:100%;max-height:260px;object-fit:cover;display:block}
      .sf-chipbtn{display:inline-flex;align-items:center;gap:5px;border:1px solid #E5E7E3;
        border-radius:999px;background:#fff;font-size:12.5px;font-weight:600;padding:7px 12px;
        cursor:pointer;font-family:inherit;color:${INK};box-shadow:0 1px 2px rgba(23,26,24,.05)}
      .sf-preview-x{position:absolute;top:10px;right:10px}
      .sf-mapwrap{margin-top:10px;border:1px solid #E5E7E3;border-radius:18px;overflow:hidden;
        box-shadow:0 1px 2px rgba(23,26,24,.05)}
      .sf-map{z-index:0}
      .sf-mapfail{display:flex;gap:8px;align-items:center;justify-content:center;background:#ECEEEA;
        color:${MUTE};font-size:13px;padding:0 20px;text-align:center}
      .sf-maploading{position:absolute;inset:0;display:flex;gap:8px;align-items:center;
        justify-content:center;background:#ECEEEA;color:${MUTE};font-size:13px;z-index:1}
      .sf-gridbg{background-color:#ECEEEA;background-image:
        linear-gradient(rgba(23,26,24,.05) 1px,transparent 1px),
        linear-gradient(90deg,rgba(23,26,24,.05) 1px,transparent 1px);
        background-size:26px 26px}
      .sf-tilenote{position:absolute;left:10px;right:10px;bottom:10px;z-index:500;
        background:rgba(23,26,24,.88);backdrop-filter:blur(6px);color:#fff;font-size:11.5px;
        line-height:1.45;padding:10px 12px;border-radius:12px;display:flex;flex-direction:column;gap:5px}
      .sf-tilenote a{color:#8FE3BC;font-weight:700;text-decoration:none}
      .sf-coords{font-size:11.5px;color:${MUTE};padding:8px 12px;background:#fff;border-top:1px solid #EEF0EC}
      .sf-input{width:100%;border:1px solid #E5E7E3;border-radius:14px;padding:13px 14px;font-size:14px;
        font-family:inherit;margin-bottom:10px;background:#fff;resize:vertical;color:${INK}}
      .sf-input::placeholder{color:#A2A8A3}
      .sf-input:focus{outline:none;border-color:${GREEN};box-shadow:0 0 0 3px rgba(11,124,78,.14)}
      .sf-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
      .sf-post{margin:16px 20px 0;width:calc(100% - 40px);display:flex;align-items:center;
        justify-content:center;gap:8px;background:${GREEN};color:#fff;border:none;
        border-radius:16px;font-size:15.5px;font-weight:700;padding:16px;cursor:pointer;
        font-family:inherit;box-shadow:0 12px 26px -10px rgba(11,124,78,.55)}
      .sf-post:disabled{background:#C7CCC8;box-shadow:none;cursor:default}
      .sf-empty{text-align:center;padding:60px 30px;color:${MUTE}}
      .sf-empty .sf-stamp{margin-bottom:14px}
      .sf-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:rgba(23,26,24,.92);
        backdrop-filter:blur(8px);color:#fff;font-size:13.5px;font-weight:600;padding:11px 20px;
        border-radius:999px;z-index:2000;box-shadow:0 8px 24px rgba(23,26,24,.25);white-space:nowrap}
      .sf-detailbtns{display:flex;gap:10px;padding:14px 20px}
      .sf-donatecard{margin:26px 20px 8px;background:linear-gradient(135deg,#FFF7F1,#FCEBE8);
        border:1px solid rgba(222,91,78,.16);border-radius:22px;padding:20px;text-align:center}
      .sf-donatecard h3{font-family:'Sora',sans-serif;font-size:16.5px;font-weight:700;letter-spacing:-.02em;margin:0 0 6px;color:${INK}}
      .sf-donatecard p{font-size:13px;color:${MUTE};margin:0 0 13px;line-height:1.55}
      .sf-donatebtn{display:inline-flex;align-items:center;gap:8px;background:#DE5B4E;color:#fff;
        border:none;border-radius:999px;font-weight:700;font-size:14px;padding:12px 24px;
        text-decoration:none;box-shadow:0 10px 22px -8px rgba(222,91,78,.6);font-family:inherit;cursor:pointer}
      .sf-donatebtn:active{transform:scale(.97)}
      .sf-about{padding:0 22px 10px;font-size:14.5px;line-height:1.65}
      .sf-about p{margin:0 0 13px}
      .sf-about h3{font-family:'Sora',sans-serif;font-size:15.5px;font-weight:700;letter-spacing:-.02em;margin:20px 0 7px;color:${INK}}
      .sf-spin{animation:sfspin 1s linear infinite}
      @keyframes sfspin{to{transform:rotate(360deg)}}
      @media (prefers-reduced-motion: reduce){.sf-spin{animation:none}.sf-card,.sf-fab{transition:none}}
      button:focus-visible,a:focus-visible{outline:3px solid rgba(11,124,78,.4);outline-offset:2px}
    `}</style>
  );

  let body = null;

  if (view === "add") {
    body = (
      <AddFind
        defaultCenter={userLoc || DEFAULT_CENTER}
        onCancel={() => setView("feed")}
        onPost={post}
        posting={posting}
      />
    );
  } else if (view === "detail" && detail) {
    const gone = detail.status === "gone";
    body = (
      <div className="sf-page">
        <div className="sf-topbar">
          <button className="sf-iconbtn" onClick={() => setView("feed")} aria-label="Back">
            <ChevronLeft size={22} />
          </button>
          <h2>{detail.title}</h2>
          <span style={{ width: 38 }} />
        </div>
        <div
          className={`sf-imgwrap ${gone ? "sf-gone" : ""}`}
          style={{
            margin: "8px 18px",
            border: "1px solid rgba(23,26,24,.08)",
            borderRadius: 22,
            overflow: "hidden",
          }}
        >
          <CardImage item={detail} big />
          <FreeStamp gone={gone} />
        </div>
        <div style={{ padding: "0 20px" }}>
          <div className="sf-meta" style={{ marginBottom: 8 }}>
            <span>
              {catOf(detail.category).emoji} {catOf(detail.category).label}
            </span>
            <span><Clock size={13} /> {timeAgo(detail.ts)}</span>
            <span><MapPin size={13} /> {detail.area}</span>
            {userLoc && <span>{distLabel(kmBetween(userLoc, detail))} away</span>}
          </div>
          {detail.note && (
            <p style={{ fontSize: 14.5, lineHeight: 1.55, margin: "0 0 6px" }}>
              {detail.note}
            </p>
          )}
        </div>
        <div className="sf-section">
          <div className="sf-mapwrap">
            <MapView center={detail} zoom={16} height={200} markers={[detail]} />
          </div>
        </div>
        <div className="sf-detailbtns">
          <a
            className="sf-bigbtn"
            style={{ textDecoration: "none" }}
            href={`https://www.google.com/maps/dir/?api=1&destination=${detail.lat},${detail.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation size={18} /> Directions
          </a>
          {gone ? (
            <button
              className="sf-bigbtn sf-bigbtn-alt"
              onClick={() => changeStatus(detail.id, "available")}
            >
              <Check size={18} /> It&apos;s back
            </button>
          ) : (
            <button
              className="sf-bigbtn sf-bigbtn-alt"
              onClick={() => changeStatus(detail.id, "gone")}
            >
              <X size={18} /> It&apos;s gone
            </button>
          )}
        </div>
        <p className="sf-hint" style={{ textAlign: "center", padding: "0 30px" }}>
          Grabbed it? Mark it gone so no one makes the trip for nothing.
        </p>
      </div>
    );
  } else if (view === "about") {
    body = (
      <div className="sf-page">
        <div className="sf-topbar">
          <button className="sf-iconbtn" onClick={() => setView("feed")} aria-label="Back">
            <ChevronLeft size={22} />
          </button>
          <h2>About StreetFinds</h2>
          <span style={{ width: 38 }} />
        </div>
        <div className="sf-about">
          <div style={{ textAlign: "center", margin: "10px 0 18px" }}>
            <FreeStamp />
          </div>
          <p>
            I built StreetFinds because I live here. Perfectly good stuff sits
            out on the kerb for weeks waiting for council cleanup, while someone
            a few streets away could put it to use today.
          </p>
          <p>
            The idea is simple: leave what you no longer need out the front,
            snap a photo, and pin the spot. Neighbours see it on the map, walk
            over, and give it a new home. Streets stay cleaner, good things get
            a second life, and nobody waits for cleanup day.
          </p>
          <h3>How it works</h3>
          <p>
            <strong>Share it.</strong> Photograph a find — the pin comes from
            the photo or your phone, and you can nudge it to the exact spot.
            <br />
            <strong>Grab it.</strong> Tap a find, get directions, go take a look.
            <br />
            <strong>Close the loop.</strong> Mark it gone so no one makes the
            trip for nothing.
          </p>
          <h3>Where it&apos;s headed</h3>
          <p>
            This started in Bondi, but it doesn&apos;t have to stay here. If the
            project gets traction, I&apos;ll keep building — native apps on the
            App Store and new neighbourhoods are next. If you appreciate it, a
            donation keeps it moving.
          </p>
          <div style={{ textAlign: "center", margin: "16px 0" }}>
            <a className="sf-donatebtn" href={DONATE_URL} target="_blank" rel="noreferrer">
              <Heart size={16} /> Support the project
            </a>
          </div>
        </div>
      </div>
    );
  } else if (view === "map") {
    body = (
      <div className="sf-page">
        <div className="sf-topbar">
          <h2 style={{ paddingLeft: 6 }}>Finds near you</h2>
          <button className="sf-chipbtn" onClick={locateMe} disabled={locating}>
            {locating ? <Loader2 size={14} className="sf-spin" /> : <Crosshair size={14} />}
            Near me
          </button>
        </div>
        <div className="sf-section">
          <div className="sf-mapwrap">
            <MapView
              center={userLoc || DEFAULT_CENTER}
              zoom={14}
              height={430}
              fitAll={!userLoc && items.length > 1}
              markers={items}
              onSelect={(id) => {
                setDetailId(id);
                setView("detail");
              }}
            />
          </div>
          <p className="sf-hint">
            Tap a pin to see the find. Grey pins are already gone.
          </p>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="sf-page">
        <div className="sf-header">
          <div>
            <h1 className="sf-logo">Street<em>Finds</em></h1>
            <div className="sf-tag">One street&apos;s clear-out is another&apos;s lucky day</div>
          </div>
          <button className="sf-chipbtn" onClick={locateMe} disabled={locating}>
            {locating ? <Loader2 size={14} className="sf-spin" /> : <Crosshair size={14} />}
            {sortNearest && userLoc ? "Nearest" : "Near me"}
          </button>
        </div>
        <div className="sf-filters">
          <button
            className={`sf-chip ${filter === "all" ? "sf-chip-on" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`sf-chip ${filter === c.id ? "sf-chip-on" : ""}`}
              onClick={() => setFilter(c.id)}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="sf-empty">
            <Loader2 size={26} className="sf-spin" />
            <p>Loading finds…</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="sf-empty">
            <div><FreeStamp /></div>
            Nothing here yet — spotted something on the kerb? Post it.
          </div>
        ) : (
          <div className="sf-cards">
            {shown.map((item) => {
              const gone = item.status === "gone";
              return (
                <button
                  key={item.id}
                  className={`sf-card ${gone ? "sf-gone" : ""}`}
                  onClick={() => {
                    setDetailId(item.id);
                    setView("detail");
                  }}
                >
                  <div className="sf-imgwrap">
                    <CardImage item={item} />
                    <FreeStamp gone={gone} />
                  </div>
                  <div className="sf-cardbody">
                    <h3 className="sf-cardtitle">{item.title}</h3>
                    <div className="sf-meta">
                      <span><MapPin size={13} /> {item.area}</span>
                      <span><Clock size={13} /> {timeAgo(item.ts)}</span>
                      {userLoc && <span>{distLabel(kmBetween(userLoc, item))} away</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="sf-donatecard">
          <h3>Keep the kerbs generous</h3>
          <p>
            StreetFinds is free and run for the community. Donations cover
            hosting and help it reach more neighbourhoods.
          </p>
          <a
            className="sf-donatebtn"
            href={DONATE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Heart size={16} /> Donate
          </a>
        </div>

        <p className="sf-hint" style={{ textAlign: "center", marginTop: 12 }}>
          {isShared
            ? "Shared community feed — everyone sees these finds."
            : "Demo mode — finds are only saved on this device for this session. Add Supabase keys to go live."}
          {" "}
          <button
            className="sf-chipbtn"
            style={{ marginLeft: 6 }}
            onClick={refresh}
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="sf-root">
      {styles}
      {toast && <div className="sf-toast">{toast}</div>}
      {body}
      {view !== "add" && (
        <nav className="sf-nav">
          <button
            className={`sf-navbtn ${view === "feed" ? "on" : ""}`}
            onClick={() => setView("feed")}
          >
            <LayoutGrid size={22} />
            Feed
          </button>
          <button
            className={`sf-navbtn ${view === "map" ? "on" : ""}`}
            onClick={() => setView("map")}
          >
            <MapIcon size={22} />
            Map
          </button>
          <button className="sf-fab" onClick={() => setView("add")} aria-label="Post a find">
            <Plus size={28} />
          </button>
          <a className="sf-navbtn donate" href={DONATE_URL} target="_blank" rel="noreferrer">
            <Heart size={22} />
            Donate
          </a>
          <button
            className={`sf-navbtn ${view === "about" ? "on" : ""}`}
            onClick={() => setView("about")}
          >
            <Info size={22} />
            About
          </button>
        </nav>
      )}
    </div>
  );
}
