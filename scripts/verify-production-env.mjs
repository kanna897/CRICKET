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
} catch (error) {
  console.error(error instanceof Error ? error.message : "NEXT_PUBLIC_SUPABASE_URL is invalid.");
  process.exit(1);
}

if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("service_role")) {
  console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY must never contain a service-role key.");
  process.exit(1);
}
console.log("Production environment validation passed.");
