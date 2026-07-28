import { createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { resolveApplicationRole } from "@/lib/application-role";

const folders = {
  "tournament-logos": "crickpulse/tournament-logos",
  "team-logos": "crickpulse/team-logos",
  "player-photos": "crickpulse/player-photos",
  "player-registrations": "crickpulse/player-registrations",
  "auction-templates": "crickpulse/auction-templates",
  posters: "crickpulse/posters",
  banners: "crickpulse/banners",
} as const;

type MediaKind = keyof typeof folders;
const isMediaKind = (value: string): value is MediaKind => value in folders;

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!supabaseUrl || !supabaseKey || !cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Media upload service is not configured." }, { status: 503 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: { get: (name) => request.cookies.get(name)?.value, set() {}, remove() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!resolveApplicationRole(profile?.role)) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");
  if (!(file instanceof File) || typeof kind !== "string" || !isMediaKind(kind)) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Upload a JPG or PNG image smaller than 5 MB." }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = folders[kind];
  const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");
  return NextResponse.json({ cloudName, apiKey, folder, timestamp, signature });
}
