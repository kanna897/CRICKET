const target = process.argv[2] ?? process.env.PRODUCTION_URL;

if (!target) {
  throw new Error("Pass a deployment URL or set PRODUCTION_URL.");
}

const response = await fetch(new URL("/en", target), {
  method: "GET",
  redirect: "follow",
});

if (!response.ok) {
  throw new Error(`Deployment returned HTTP ${response.status}.`);
}

const required = {
  "content-security-policy": [
    "default-src 'self'",
    "frame-ancestors 'none'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://res.cloudinary.com",
    "https://challenges.cloudflare.com",
  ],
  "strict-transport-security": ["max-age=63072000", "includeSubDomains", "preload"],
  "referrer-policy": ["strict-origin-when-cross-origin"],
  "permissions-policy": ["camera=()", "microphone=()", "geolocation=()"],
  "x-frame-options": ["DENY"],
  "x-content-type-options": ["nosniff"],
  "cross-origin-opener-policy": ["same-origin-allow-popups"],
  "cross-origin-resource-policy": ["same-origin"],
  "cross-origin-embedder-policy": ["unsafe-none"],
};

const failures = [];
for (const [header, expectedParts] of Object.entries(required)) {
  const value = response.headers.get(header);
  if (!value) {
    failures.push(`${header}: missing`);
    continue;
  }
  for (const expected of expectedParts) {
    if (!value.includes(expected)) failures.push(`${header}: missing ${expected}`);
  }
}

if (failures.length) {
  throw new Error(`Security header verification failed:\n- ${failures.join("\n- ")}`);
}

console.log(`Security headers verified: ${response.url}`);
