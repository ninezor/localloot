import { createClient } from "@supabase/supabase-js";

/**
 * Dual-mode data layer.
 *
 * - No env vars           -> local demo mode (in-memory, per visitor)
 * - VITE_SUPABASE_URL and
 *   VITE_SUPABASE_ANON_KEY -> shared community feed (everyone sees everything)
 *
 * Run supabase/schema.sql in the Supabase SQL editor to create the table,
 * the public photo bucket, and the access policies.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

export const isShared = Boolean(supabase);

const H = 3600000;
let memory = [
  {
    id: "s1",
    title: "Solid timber bookshelf",
    note: "Sturdy, just needs a wipe down. On the nature strip until the weekend.",
    category: "furniture",
    emoji: "🗄️",
    lat: -33.8898,
    lng: 151.2717,
    area: "Bondi Beach",
    ts: Date.now() - 2 * H,
    status: "available",
    photo: null,
  },
  {
    id: "s2",
    title: "Kids bike, 16 inch",
    note: "Tyres hold air, brakes work. Outgrown, not worn out.",
    category: "kids",
    emoji: "🚲",
    lat: -33.8845,
    lng: 151.2809,
    area: "North Bondi",
    ts: Date.now() - 5 * H,
    status: "available",
    photo: null,
  },
  {
    id: "s3",
    title: "Box of kitchen gear",
    note: "Pots, pans, a kettle and mixed utensils. Take the lot or pick through.",
    category: "kitchen",
    emoji: "🍳",
    lat: -33.8916,
    lng: 151.2508,
    area: "Bondi Junction",
    ts: Date.now() - 9 * H,
    status: "available",
    photo: null,
  },
];

function rowToItem(r) {
  return {
    id: r.id,
    title: r.title,
    note: r.note || "",
    category: r.category,
    emoji: r.emoji,
    lat: r.lat,
    lng: r.lng,
    area: r.area || "Local pickup",
    status: r.status,
    photo: r.photo_url,
    ts: new Date(r.created_at).getTime(),
  };
}

export async function listFinds() {
  if (!supabase) return [...memory];
  const { data, error } = await supabase
    .from("finds")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data.map(rowToItem);
}

export async function addFind(item, photoBlob, photoDataUrl) {
  if (!supabase) {
    const it = {
      ...item,
      id: `u${Date.now()}`,
      ts: Date.now(),
      status: "available",
      photo: photoDataUrl || null,
    };
    memory = [it, ...memory];
    return it;
  }
  let photo_url = null;
  if (photoBlob) {
    const path = `${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("photos")
      .upload(path, photoBlob, { contentType: "image/jpeg" });
    if (upErr) throw upErr;
    photo_url = supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
  }
  const { data, error } = await supabase
    .from("finds")
    .insert({
      title: item.title,
      note: item.note,
      category: item.category,
      emoji: item.emoji,
      lat: item.lat,
      lng: item.lng,
      area: item.area,
      status: "available",
      photo_url,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToItem(data);
}

export async function setFindStatus(id, status) {
  if (!supabase) {
    memory = memory.map((i) => (i.id === id ? { ...i, status } : i));
    return;
  }
  const { error } = await supabase.from("finds").update({ status }).eq("id", id);
  if (error) throw error;
}
