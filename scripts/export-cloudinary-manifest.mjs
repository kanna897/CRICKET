import { writeFile } from "node:fs/promises";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
const outputPath = process.argv[2] || "backup/cloudinary-assets.json";

if (!cloudName || !apiKey || !apiSecret) {
  await writeFile(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    warning: "Cloudinary backup secrets are not configured.",
    resources: [],
  }, null, 2));
  process.exit(0);
}

const authorization = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
const resources = [];

for (const resourceType of ["image", "video", "raw"]) {
  let nextCursor = "";
  do {
    const url = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}`);
    url.searchParams.set("max_results", "500");
    url.searchParams.set("tags", "true");
    url.searchParams.set("context", "true");
    if (nextCursor) url.searchParams.set("next_cursor", nextCursor);
    const response = await fetch(url, { headers: { Authorization: authorization } });
    if (!response.ok) throw new Error(`Cloudinary ${resourceType} export failed: HTTP ${response.status}`);
    const page = await response.json();
    for (const item of page.resources || []) {
      resources.push({
        resourceType,
        publicId: item.public_id,
        assetId: item.asset_id,
        version: item.version,
        format: item.format,
        bytes: item.bytes,
        width: item.width,
        height: item.height,
        createdAt: item.created_at,
        secureUrl: item.secure_url,
        backup: item.backup,
        tags: item.tags || [],
        context: item.context || null,
      });
    }
    nextCursor = page.next_cursor || "";
  } while (nextCursor);
}

await writeFile(outputPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  cloudName,
  resourceCount: resources.length,
  totalBytes: resources.reduce((total, item) => total + (item.bytes || 0), 0),
  note: "This is a complete asset inventory. Binary recovery requires Cloudinary backup/versioning.",
  resources,
}, null, 2));
