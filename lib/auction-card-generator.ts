import { createHash } from "node:crypto";
import sharp, { type OverlayOptions } from "sharp";

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

export async function generatePlayerCardJpeg(data: PlayerCardData) {
  const [template, photo] = await Promise.all([fetchImage(data.templateUrl), fetchImage(data.photoUrl)]);
  const base = sharp(template).resize(1254, 1254, { fit: "fill" });
  const portrait = await sharp(photo)
    .resize(430, 620, { fit: "cover", position: "attention" })
    .jpeg({ quality: 94 })
    .toBuffer();
  const text = Buffer.from(`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="shadow"><feDropShadow dx="3" dy="4" stdDeviation="4" flood-opacity=".7"/></filter></defs>
    <style>
      .name{font:italic 900 62px Arial,sans-serif;fill:#fff;stroke:#071936;stroke-width:2;paint-order:stroke;filter:url(#shadow)}
      .detail{font:italic 800 39px Arial,sans-serif;fill:#071936}
      .number{font:900 58px Arial,sans-serif;fill:#fff;stroke:#071936;stroke-width:2;paint-order:stroke}
    </style>
    <text x="650" y="460" class="name">${xml(fitText(data.playerName, 23))}</text>
    <text x="770" y="585" class="detail">${xml(label(data.playingRole))}</text>
    <text x="770" y="710" class="detail">${xml(label(data.battingStyle))}</text>
    <text x="770" y="835" class="detail">${xml(label(data.bowlingStyle))}</text>
    <text x="790" y="970" class="detail">${xml(fitText(data.mobileNumber, 20))}</text>
    <text x="220" y="1015" class="number">${xml(String(data.registrationNumber).padStart(2, "0"))}</text>
  </svg>`);
  return base
    .composite([
      { input: portrait, left: 92, top: 365 },
      { input: text, left: 0, top: 0 },
    ])
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
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
