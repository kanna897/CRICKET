import { supabase } from "@/lib/supabase";

export type MediaKind =
  | "tournament-logos"
  | "team-logos"
  | "player-photos"
  | "player-registrations"
  | "auction-player-cards"
  | "auction-templates"
  | "posters"
  | "banners";

type MediaUpload = { url?: string; publicId?: string };

type ErrorPayload = { error?: string | { message?: string } };

function errorMessage(error: ErrorPayload["error"], fallback: string) {
  if (typeof error === "string" && error) return error;
  if (typeof error === "object" && error?.message) return error.message;
  return fallback;
}

export function cloudinaryPlayerPhotoUrl(url: string) {
  if (!url.includes("res.cloudinary.com/") || !url.includes("/image/upload/")) return url;
  if (url.includes("/c_fill,g_auto,w_1200,h_1200,q_auto,f_auto/")) return url;
  return url.replace(
    "/image/upload/",
    "/image/upload/c_fill,g_auto,w_1200,h_1200,q_auto,f_auto/",
  );
}

async function readJson<T>(response: Response): Promise<T & ErrorPayload> {
  const body = await response.text();
  if (!body) throw new Error(`Upload service returned an empty response (${response.status}).`);

  try {
    return JSON.parse(body) as T & ErrorPayload;
  } catch {
    throw new Error(`Upload service returned an invalid response (${response.status}).`);
  }
}

export async function uploadImage(file: File, kind: MediaKind) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");

  const signatureRequest = new FormData();
  signatureRequest.set("file", file);
  signatureRequest.set("kind", kind);

  const signatureResponse = await fetch("/api/media", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: signatureRequest,
  });
  const upload = await readJson<MediaUpload>(signatureResponse);
  if (!signatureResponse.ok || !upload.url || !upload.publicId) {
    throw new Error(errorMessage(upload.error, "Image upload failed."));
  }
  const url = kind === "player-photos" || kind === "player-registrations"
    ? cloudinaryPlayerPhotoUrl(upload.url)
    : upload.url;
  return { url, publicId: upload.publicId };
}
