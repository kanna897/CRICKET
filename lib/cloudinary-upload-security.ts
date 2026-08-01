import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MEDIA_FOLDERS = {
  "tournament-logos": "crickpulse/tournament-logos",
  "team-logos": "crickpulse/team-logos",
  "player-photos": "crickpulse/player-photos",
  "player-registrations": "crickpulse/player-registrations",
  "auction-player-cards": "crickpulse/auction-player-cards",
  "auction-templates": "crickpulse/auction-templates",
  posters: "crickpulse/posters",
  banners: "crickpulse/banners",
} as const;

export type MediaKind = keyof typeof MEDIA_FOLDERS;
export type UploadRole = "master_admin" | "organizer" | "public_registration";

const ROLE_UPLOADS: Record<UploadRole, readonly MediaKind[]> = {
  master_admin: Object.keys(MEDIA_FOLDERS) as MediaKind[],
  organizer: Object.keys(MEDIA_FOLDERS) as MediaKind[],
  public_registration: ["player-registrations"],
};

const localLimits = new Map<string, { count: number; resetAt: number }>();

export function isMediaKind(value: string): value is MediaKind {
  return Object.hasOwn(MEDIA_FOLDERS, value);
}

export function canUpload(role: UploadRole, kind: MediaKind) {
  return ROLE_UPLOADS[role].includes(kind);
}

export function registrationFolder(tournamentId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tournamentId)) {
    throw new Error("Invalid tournament identifier.");
  }
  return `${MEDIA_FOLDERS["player-registrations"]}/${tournamentId}`;
}

function detectedMime(bytes: Uint8Array): typeof ALLOWED_IMAGE_MIME_TYPES[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

export async function validateImage(file: File) {
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Upload a JPG, PNG or WebP image smaller than 5 MB.");
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as typeof ALLOWED_IMAGE_MIME_TYPES[number])) {
    throw new Error("Upload a JPG, PNG or WebP image smaller than 5 MB.");
  }
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (detectedMime(bytes) !== file.type) throw new Error("The file content does not match its image type.");
}

export function clientAddress(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export async function consumeUploadLimit(
  supabase: SupabaseClient<Database>,
  identity: string,
  maxAttempts: number,
) {
  const identifier = createHash("sha256").update(`upload:${identity}`).digest("hex");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    const { data, error } = await supabase.rpc("consume_registration_lookup_attempt", {
      p_identifier_hash: identifier,
      p_max_attempts: maxAttempts,
      p_window: "10 minutes",
    });
    if (error) throw new Error("Upload rate limiter is unavailable.");
    return data;
  }

  const now = Date.now();
  const current = localLimits.get(identifier);
  if (!current || current.resetAt <= now) {
    localLimits.set(identifier, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= maxAttempts;
}

type TurnstileResult = {
  success: boolean;
  hostname?: string;
  action?: string;
};

export async function verifyTurnstile(token: string, remoteip: string) {
  const configuredSecret = process.env.TURNSTILE_SECRET_KEY;
  const secret = configuredSecret
    ?? (process.env.NODE_ENV === "production" ? undefined : "1x0000000000000000000000000000000AA");
  if (!secret || !token) return false;

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, response: token, remoteip }),
    cache: "no-store",
  });
  if (!response.ok) return false;
  const result = await response.json() as TurnstileResult;
  const expectedHost = process.env.TURNSTILE_EXPECTED_HOSTNAME;
  return result.success
    && result.action === "player_registration_upload"
    && (!expectedHost || result.hostname === expectedHost);
}

export async function uploadToCloudinary(file: File, folder: string, preset?: string) {
  if (!/^crickpulse\/[a-z0-9-]+(?:\/[0-9a-f-]{36})?$/i.test(folder)) throw new Error("Upload folder is not allowed.");
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Media upload service is not configured.");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = new URLSearchParams({ folder, timestamp });
  if (preset) params.set("upload_preset", preset);
  const canonical = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join("&");
  const signature = createHash("sha1").update(`${canonical}${apiSecret}`).digest("hex");
  if (Math.floor(Date.now() / 1000) - Number(timestamp) > 60) throw new Error("Upload authorization expired.");

  const body = new FormData();
  body.set("file", file);
  for (const [key, value] of params) body.set(key, value);
  body.set("api_key", apiKey);
  body.set("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
    cache: "no-store",
  });
  const result = await response.json() as {
    secure_url?: string;
    public_id?: string;
    resource_type?: string;
    format?: string;
    bytes?: number;
    width?: number;
    height?: number;
    folder?: string;
    error?: { message?: string };
  };
  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(result.error?.message || "Cloudinary upload failed.");
  }
  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type ?? "image",
    folder: result.folder ?? folder,
    format: result.format ?? null,
    bytes: result.bytes ?? file.size,
    width: result.width ?? null,
    height: result.height ?? null,
  };
}

type UploadAuditMetadata = {
  publicId?: string;
  secureUrl?: string;
  resourceType?: string;
  folder?: string;
  format?: string | null;
  bytes?: number;
  width?: number | null;
  height?: number | null;
};

export async function writeUploadAudit(
  supabase: SupabaseClient<Database>,
  input: { userId: string; role: string; action: string; kind: MediaKind; ip: string; success: boolean; upload?: UploadAuditMetadata },
) {
  const newValues: Json = {
    kind: input.kind,
    public_id: input.upload?.publicId ?? null,
    secure_url: input.upload?.secureUrl ?? null,
    resource_type: input.upload?.resourceType ?? null,
    folder: input.upload?.folder ?? null,
    format: input.upload?.format ?? null,
    bytes: input.upload?.bytes ?? null,
    width: input.upload?.width ?? null,
    height: input.upload?.height ?? null,
    success: input.success,
  };
  try {
    const { error } = await supabase.from("audit_logs").insert({
      user_id: input.userId,
      user_name: "Upload Security",
      user_role: input.role,
      action: input.action,
      entity_type: "cloudinary_upload",
      entity_id: crypto.randomUUID(),
      new_values: newValues,
      ip_address: input.ip,
      device_browser: "server",
    });
    if (error) {
      console.error("upload_audit_failure", {
        code: error.code,
        message: error.message,
        action: input.action,
        kind: input.kind,
      });
    }
  } catch (error) {
    console.error("upload_audit_failure", {
      code: error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "unexpected_error",
      message: error instanceof Error ? error.message : "Unexpected audit failure",
      action: input.action,
      kind: input.kind,
    });
  }
}
