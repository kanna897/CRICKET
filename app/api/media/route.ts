import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { resolveApplicationRole } from "@/lib/application-role";
import type { Database } from "@/types/database.types";
import {
  MEDIA_FOLDERS,
  canUpload,
  clientAddress,
  consumeUploadLimit,
  isMediaKind,
  uploadToCloudinary,
  validateImage,
  writeUploadAudit,
} from "@/lib/cloudinary-upload-security";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Media upload service is not configured." }, { status: 503 });
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: { get: (name) => request.cookies.get(name)?.value, set() {}, remove() {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = resolveApplicationRole(profile?.role);
  if (!role) return NextResponse.json({ error: "Unauthorized." }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");
  if (!(file instanceof File) || typeof kind !== "string" || !isMediaKind(kind)) {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }
  if (!canUpload(role, kind)) return NextResponse.json({ error: "This role cannot upload that media type." }, { status: 403 });
  const ip = clientAddress(request);
  const limiter = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient<Database>(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : supabase;
  try {
    if (!await consumeUploadLimit(limiter, `${user.id}:${ip}`, 30)) {
      await writeUploadAudit(supabase, { userId: user.id, role, action: "Upload Rate Limited", kind, ip, success: false });
      return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
    }
    await validateImage(file);
    const upload = await uploadToCloudinary(file, MEDIA_FOLDERS[kind], process.env.CLOUDINARY_ADMIN_UPLOAD_PRESET);
    await writeUploadAudit(supabase, { userId: user.id, role, action: "Media Uploaded", kind, publicId: upload.publicId, ip, success: true });
    return NextResponse.json(upload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image upload failed.";
    await writeUploadAudit(supabase, { userId: user.id, role, action: "Upload Rejected", kind, ip, success: false });
    return NextResponse.json({ error: message }, { status: message.includes("configured") ? 503 : 400 });
  }
}
