import { createHash } from "node:crypto";
import sharp, { type OverlayOptions } from "sharp";
import {
  normalizePlayerCardLayout,
  PLAYER_CARD_SIZE,
  type PlayerCardLayout,
  type PlayerCardTextLayout,
} from "@/lib/player-card-layout";

export type PlayerCardData = {
  id: string;
  templateUrl: string;
  photoUrl: string;
  playerName: string;
  playingRole: string;
  battingStyle: string;
  bowlingStyle: string;
  mobileNumber: string;
  registrationNumber: number;
  layout?: PlayerCardLayout;
};

export type TeamPlayerCardData = PlayerCardData & {
  teamName: string;
  teamLogoUrl: string | null;
  auctionPrice: number;
};

const xml = (value: string | number) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

async function fetchImage(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load card image (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

function fitText(value: string, max = 28) {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function fittedFontSize(value: string, field: PlayerCardTextLayout) {
  const estimatedWidth = Math.max(1, value.length) * field.fontSize * 0.57;
  return estimatedWidth <= field.maxWidth
    ? field.fontSize
    : Math.max(8, Math.floor(field.fontSize * field.maxWidth / estimatedWidth));
}

async function textLayer(value: string, field: PlayerCardTextLayout): Promise<OverlayOptions> {
  const fontSize = fittedFontSize(value, field);
  const width = Math.max(1, Math.round(field.maxWidth));
  const height = Math.max(1, Math.ceil(fontSize * 1.35));
  const anchor = field.textAlignment === "center" ? "middle" : field.textAlignment === "right" ? "end" : "start";
  const x = field.textAlignment === "center" ? width / 2 : field.textAlignment === "right" ? width : 0;
  const input = Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="${x}" y="${fontSize}" text-anchor="${anchor}" fill="${field.fontColour}" font-family="sans-serif" font-size="${fontSize}" font-weight="${field.fontWeight}" font-style="${field.italic ? "italic" : "normal"}">${xml(value)}</text>
  </svg>`);
  const left = field.textAlignment === "center"
    ? Math.round(field.x - field.maxWidth / 2)
    : field.textAlignment === "right"
      ? Math.round(field.x - field.maxWidth)
      : Math.round(field.x);
  return {
    input,
    left: Math.max(0, left),
    top: Math.max(0, Math.round(field.y - fontSize)),
  };
}

export async function generatePlayerCardJpeg(data: PlayerCardData) {
  const layout = normalizePlayerCardLayout(data.layout);
  const [template, photo] = await Promise.all([fetchImage(data.templateUrl), fetchImage(data.photoUrl)]);
  const base = sharp(template).resize(PLAYER_CARD_SIZE, PLAYER_CARD_SIZE, { fit: "fill" });
  const portraitMask = Buffer.from(`<svg width="${layout.photo.width}" height="${layout.photo.height}" xmlns="http://www.w3.org/2000/svg"><rect width="${layout.photo.width}" height="${layout.photo.height}" rx="${layout.photo.borderRadius}" fill="white"/></svg>`);
  const portrait = await sharp(photo)
    .resize(layout.photo.width, layout.photo.height, { fit: "cover", position: "attention" })
    .composite([{ input: portraitMask, blend: "dest-in" }])
    .png()
    .toBuffer();
  const placeholderMask = Buffer.from(`<svg width="${PLAYER_CARD_SIZE}" height="${PLAYER_CARD_SIZE}" xmlns="http://www.w3.org/2000/svg">
    <path d="M535 316 L1020 316 L1028 420 L548 420 Z" fill="#073467"/>
    <rect x="625" y="454" width="350" height="86" rx="8" fill="#ffffff"/>
    <rect x="625" y="564" width="350" height="86" rx="8" fill="#ffffff"/>
    <rect x="625" y="674" width="350" height="86" rx="8" fill="#ffffff"/>
    <rect x="625" y="784" width="350" height="86" rx="8" fill="#ffffff"/>
    <path d="M142 832 L350 794 L337 905 L150 923 Z" fill="#f5b814"/>
    <path d="M160 817 L342 805 L330 892 L154 903 Z" fill="#0a3568"/>
  </svg>`);
  const textLayers = await Promise.all([
    textLayer(data.playerName.trim(), layout.name),
    textLayer(label(data.playingRole), layout.role),
    textLayer(label(data.battingStyle), layout.batting),
    textLayer(label(data.bowlingStyle), layout.bowling),
    textLayer(data.mobileNumber.trim(), layout.phone),
    textLayer(String(data.registrationNumber).padStart(2, "0"), layout.serial),
  ]);
  return base
    .composite([
      { input: portrait, left: layout.photo.x, top: layout.photo.y },
      { input: placeholderMask, left: 0, top: 0 },
      ...textLayers,
    ])
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
    .withMetadata({ density: 300 })
    .toBuffer();
}

export async function generateTeamPlayerCardJpeg(data: TeamPlayerCardData) {
  const [template, photo, teamLogo] = await Promise.all([
    fetchImage(data.templateUrl),
    fetchImage(data.photoUrl),
    data.teamLogoUrl ? fetchImage(data.teamLogoUrl) : Promise.resolve(null),
  ]);
  const base = sharp(template).resize(1600, 900, { fit: "fill" });
  const portrait = await sharp(photo).resize(380, 500, { fit: "cover", position: "attention" }).jpeg({ quality: 94 }).toBuffer();
  const logo = teamLogo ? await sharp(teamLogo).resize(135, 135, { fit: "contain" }).png().toBuffer() : null;
  const text = Buffer.from(`<svg width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="shadow"><feDropShadow dx="3" dy="4" stdDeviation="4" flood-opacity=".75"/></filter></defs>
    <style>
      .team{font:900 64px Arial,sans-serif;fill:#fff;stroke:#071936;stroke-width:3;paint-order:stroke;filter:url(#shadow)}
      .name{font:900 76px Arial,sans-serif;fill:#fff;stroke:#071936;stroke-width:3;paint-order:stroke;filter:url(#shadow)}
      .role{font:800 36px Arial,sans-serif;fill:#eaf6ff;stroke:#071936;stroke-width:2;paint-order:stroke}
      .price{font:900 50px Arial,sans-serif;fill:#ffd34e;stroke:#071936;stroke-width:2;paint-order:stroke}
    </style>
    <rect x="515" y="210" width="1000" height="500" rx="40" fill="#061a3d" fill-opacity=".82"/>
    <text x="560" y="315" class="team">${xml(fitText(data.teamName, 30))}</text>
    <text x="560" y="430" class="name">${xml(fitText(data.playerName, 26))}</text>
    <text x="560" y="515" class="role">${xml(label(data.playingRole))}</text>
    <text x="560" y="600" class="price">Auction Price: ${xml(data.auctionPrice.toLocaleString("en-US"))}</text>
    <text x="560" y="665" class="role">Registration No: ${xml(String(data.registrationNumber).padStart(2, "0"))}</text>
  </svg>`);
  const layers: OverlayOptions[] = [
    { input: portrait, left: 90, top: 255 },
    { input: text, left: 0, top: 0 },
  ];
  if (logo) layers.push({ input: logo, left: 1385, top: 35 });
  return base.composite(layers).jpeg({ quality: 94, chromaSubsampling: "4:4:4" }).toBuffer();
}

export async function uploadGeneratedJpeg(buffer: Buffer, folder: string, publicId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Generated-card storage is not configured.");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const overwrite = "true";
  const signature = createHash("sha1")
    .update(`folder=${folder}&overwrite=${overwrite}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");
  const body = new FormData();
  body.set("file", new Blob([new Uint8Array(buffer)], { type: "image/jpeg" }), `${publicId}.jpg`);
  body.set("folder", folder);
  body.set("overwrite", overwrite);
  body.set("public_id", publicId);
  body.set("timestamp", timestamp);
  body.set("api_key", apiKey);
  body.set("signature", signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body });
  const payload = await response.json() as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !payload.secure_url) throw new Error(payload.error?.message || "Generated card upload failed.");
  return payload.secure_url;
}
