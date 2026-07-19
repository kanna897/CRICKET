import { supabase } from "@/lib/supabase";

export type MediaKind = "tournament-logos" | "team-logos" | "player-photos" | "posters";

type UploadSignature = {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: string;
  signature: string;
};

type CloudinaryUpload = {
  secure_url?: string;
  public_id?: string;
};

type ErrorPayload = { error?: string | { message?: string } };

function errorMessage(error: ErrorPayload["error"], fallback: string) {
  if (typeof error === "string" && error) return error;
  if (typeof error === "object" && error?.message) return error.message;
  return fallback;
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
  const signature = await readJson<UploadSignature>(signatureResponse);
  if (!signatureResponse.ok) throw new Error(errorMessage(signature.error, "Image upload authorization failed."));

  const cloudinaryForm = new FormData();
  cloudinaryForm.set("file", file);
  cloudinaryForm.set("folder", signature.folder);
  cloudinaryForm.set("timestamp", signature.timestamp);
  cloudinaryForm.set("api_key", signature.apiKey);
  cloudinaryForm.set("signature", signature.signature);

  const cloudinaryResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
    { method: "POST", body: cloudinaryForm },
  );
  const upload = await readJson<CloudinaryUpload>(cloudinaryResponse);
  if (!cloudinaryResponse.ok || !upload.secure_url || !upload.public_id) {
    throw new Error(errorMessage(upload.error, "Cloudinary upload failed."));
  }

  return { url: upload.secure_url, publicId: upload.public_id };
}
