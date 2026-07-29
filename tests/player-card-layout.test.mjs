import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLAYER_CARD_LAYOUT,
  normalizePlayerCardLayout,
  PLAYER_CARD_SIZE,
} from "../lib/player-card-layout.ts";

test("player card layouts normalize to a 1080 square canvas", () => {
  const layout = normalizePlayerCardLayout({
    photo: { x: -50, y: 1200, width: 0, height: 9999 },
    name: { x: 500, fontSize: 500, fontColour: "invalid", textAlignment: "middle" },
  });
  assert.equal(layout.width, PLAYER_CARD_SIZE);
  assert.equal(layout.height, PLAYER_CARD_SIZE);
  assert.equal(layout.photo.x, 0);
  assert.equal(layout.photo.y, 1080);
  assert.equal(layout.photo.width, 20);
  assert.equal(layout.photo.height, 1080);
  assert.equal(layout.name.fontSize, 180);
  assert.equal(layout.name.fontColour, DEFAULT_PLAYER_CARD_LAYOUT.name.fontColour);
  assert.equal(layout.name.textAlignment, "left");
});

test("template coordinates and typography remain independently configurable", () => {
  const layout = normalizePlayerCardLayout({
    photo: { x: 40, y: 80, width: 300, height: 600, borderRadius: 24 },
    phone: {
      x: 900,
      y: 800,
      fontSize: 44,
      fontFamily: "Verdana",
      fontColour: "#112233",
      textAlignment: "right",
      maxWidth: 320,
      fontWeight: 700,
      italic: false,
    },
  });
  assert.deepEqual(layout.photo, { x: 40, y: 80, width: 300, height: 600, borderRadius: 24 });
  assert.deepEqual(layout.phone, {
    x: 900,
    y: 800,
    fontSize: 44,
    fontFamily: "Verdana",
    fontColour: "#112233",
    textAlignment: "right",
    maxWidth: 320,
    fontWeight: 700,
    italic: false,
  });
});
