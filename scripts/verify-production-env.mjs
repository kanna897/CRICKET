const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing production environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

try {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (url.protocol !== "https:") throw new Error("Supabase URL must use HTTPS.");
  if (!url.hostname.endsWith(".supabase.co")) throw new Error("Supabase URL must use a supabase.co project hostname.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "NEXT_PUBLIC_SUPABASE_URL is invalid.");
  process.exit(1);
}

const publicSupabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim();
if (publicSupabaseKey.startsWith("sb_secret_")) {
  console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY must never contain a Supabase secret key.");
  process.exit(1);
}

if (publicSupabaseKey.startsWith("sb_publishable_")) {
  console.log("Supabase publishable key format detected.");
} else {
  try {
    const [, payload] = publicSupabaseKey.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (decoded.role !== "anon") throw new Error("Public Supabase JWT must use the anon role.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "NEXT_PUBLIC_SUPABASE_ANON_KEY is not a valid public key.");
    process.exit(1);
  }
}

const unsafePublicNames = Object.keys(process.env).filter((name) =>
  name.startsWith("NEXT_PUBLIC_") && /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN)/i.test(name),
);
if (unsafePublicNames.length) {
  console.error(`Potential secrets must not use NEXT_PUBLIC_: ${unsafePublicNames.join(", ")}`);
  process.exit(1);
}

if (process.env.CLOUDINARY_API_SECRET === process.env.CLOUDINARY_API_KEY) {
  console.error("Cloudinary API key and secret must not be identical.");
  process.exit(1);
}

console.log("Production environment validation passed.");
