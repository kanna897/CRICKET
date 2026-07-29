export const PLAYER_CARD_SIZE = 1080;

export type TextAlignment = "left" | "center" | "right";

export type PlayerCardTextLayout = {
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  fontColour: string;
  textAlignment: TextAlignment;
  maxWidth: number;
  fontWeight: number;
  italic: boolean;
};

export type PlayerCardLayout = {
  version: 1;
  width: 1080;
  height: 1080;
  photo: {
    x: number;
    y: number;
    width: number;
    height: number;
    borderRadius: number;
  };
  name: PlayerCardTextLayout;
  role: PlayerCardTextLayout;
  batting: PlayerCardTextLayout;
  bowling: PlayerCardTextLayout;
  phone: PlayerCardTextLayout;
  serial: PlayerCardTextLayout;
};

const detail = (x: number, y: number): PlayerCardTextLayout => ({
  x,
  y,
  fontSize: 40,
  fontFamily: "Arial",
  fontColour: "#071936",
  textAlignment: "left",
  maxWidth: 390,
  fontWeight: 900,
  italic: true,
});

export const DEFAULT_PLAYER_CARD_LAYOUT: PlayerCardLayout = {
  version: 1,
  width: PLAYER_CARD_SIZE,
  height: PLAYER_CARD_SIZE,
  photo: { x: 85, y: 294, width: 348, height: 543, borderRadius: 50 },
  name: {
    x: 560,
    y: 392,
    fontSize: 58,
    fontFamily: "Arial",
    fontColour: "#ffffff",
    textAlignment: "left",
    maxWidth: 440,
    fontWeight: 900,
    italic: true,
  },
  role: detail(650, 515),
  batting: detail(650, 626),
  bowling: detail(650, 737),
  phone: detail(646, 848),
  serial: {
    x: 194,
    y: 900,
    fontSize: 79,
    fontFamily: "Arial",
    fontColour: "#ffffff",
    textAlignment: "left",
    maxWidth: 190,
    fontWeight: 900,
    italic: true,
  },
};

const finite = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const colour = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

const textLayout = (value: unknown, fallback: PlayerCardTextLayout): PlayerCardTextLayout => {
  const input = value && typeof value === "object" ? value as Partial<PlayerCardTextLayout> : {};
  return {
    x: finite(input.x, fallback.x, 0, PLAYER_CARD_SIZE),
    y: finite(input.y, fallback.y, 0, PLAYER_CARD_SIZE),
    fontSize: finite(input.fontSize, fallback.fontSize, 8, 180),
    fontFamily: typeof input.fontFamily === "string" && input.fontFamily.trim() ? input.fontFamily.trim().slice(0, 80) : fallback.fontFamily,
    fontColour: colour(input.fontColour, fallback.fontColour),
    textAlignment: input.textAlignment === "center" || input.textAlignment === "right" ? input.textAlignment : "left",
    maxWidth: finite(input.maxWidth, fallback.maxWidth, 40, PLAYER_CARD_SIZE),
    fontWeight: finite(input.fontWeight, fallback.fontWeight, 100, 900),
    italic: typeof input.italic === "boolean" ? input.italic : fallback.italic,
  };
};

export function normalizePlayerCardLayout(value: unknown): PlayerCardLayout {
  const input = value && typeof value === "object" ? value as Partial<PlayerCardLayout> : {};
  const photo: Partial<PlayerCardLayout["photo"]> = input.photo && typeof input.photo === "object" ? input.photo : {};
  return {
    version: 1,
    width: PLAYER_CARD_SIZE,
    height: PLAYER_CARD_SIZE,
    photo: {
      x: finite(photo.x, DEFAULT_PLAYER_CARD_LAYOUT.photo.x, 0, PLAYER_CARD_SIZE),
      y: finite(photo.y, DEFAULT_PLAYER_CARD_LAYOUT.photo.y, 0, PLAYER_CARD_SIZE),
      width: finite(photo.width, DEFAULT_PLAYER_CARD_LAYOUT.photo.width, 20, PLAYER_CARD_SIZE),
      height: finite(photo.height, DEFAULT_PLAYER_CARD_LAYOUT.photo.height, 20, PLAYER_CARD_SIZE),
      borderRadius: finite(photo.borderRadius, DEFAULT_PLAYER_CARD_LAYOUT.photo.borderRadius, 0, 540),
    },
    name: textLayout(input.name, DEFAULT_PLAYER_CARD_LAYOUT.name),
    role: textLayout(input.role, DEFAULT_PLAYER_CARD_LAYOUT.role),
    batting: textLayout(input.batting, DEFAULT_PLAYER_CARD_LAYOUT.batting),
    bowling: textLayout(input.bowling, DEFAULT_PLAYER_CARD_LAYOUT.bowling),
    phone: textLayout(input.phone, DEFAULT_PLAYER_CARD_LAYOUT.phone),
    serial: textLayout(input.serial, DEFAULT_PLAYER_CARD_LAYOUT.serial),
  };
}
