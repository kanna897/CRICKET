import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database.types";
import {
  clientAddress,
  consumeUploadLimit,
  registrationFolder,
  uploadToCloudinary,
  validateImage,
  verifyTurnstile,
} from "@/lib/cloudinary-upload-security";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Player photo upload service is not configured." }, { status: 503 });

  const formData = await request.formData();
  const tournamentId = formData.get("tournamentId");
  const captchaToken = formData.get("captchaToken");
  const file = formData.get("file");
  if (typeof tournamentId !== "string" || typeof captchaToken !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid player photo upload request." }, { status: 400 });
  }

  const ip = clientAddress(request);
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    if (!await consumeUploadLimit(supabase, `registration:${tournamentId}:${ip}`, 8)) {
      console.warn("upload_audit", { action: "rate_limited", tournamentId, ip });
      return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
    }
    if (!await verifyTurnstile(captchaToken, ip)) {
      console.warn("upload_audit", { action: "captcha_rejected", tournamentId, ip });
      return NextResponse.json({ error: "CAPTCHA verification failed. Please try again." }, { status: 403 });
    }
    await validateImage(file);
    const { data: tournament, error } = await supabase.from("tournaments").select("id")
      .eq("id", tournamentId).eq("player_registration_enabled", true).is("deleted_at", null).maybeSingle();
    if (error || !tournament) {
      return NextResponse.json({ error: "Player registration is not enabled for this tournament." }, { status: 403 });
    }
    const upload = await uploadToCloudinary(
      file,
      registrationFolder(tournamentId),
      process.env.CLOUDINARY_REGISTRATION_UPLOAD_PRESET,
    );
    console.info("upload_audit", { action: "uploaded", tournamentId, publicId: upload.publicId, ip });
    return NextResponse.json(upload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Player photo upload failed.";
    console.error("upload_audit", { action: "rejected", tournamentId, ip, message });
    return NextResponse.json({ error: message }, { status: message.includes("configured") ? 503 : 400 });
  }
}
