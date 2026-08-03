"use client";

import { createWorker, PSM, type Worker } from "tesseract.js";

export type AuctionCardText = {
  playerName: string;
  playingRole: string;
  registrationNumber: number | null;
  contactNumber: string | null;
  battingStyle: string;
  bowlingStyle: string;
};

let workerPromise: Promise<Worker> | null = null;

function getWorker() {
  workerPromise ??= createWorker("eng", 1);
  return workerPromise;
}

async function loadImage(url: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return image;
}

function cropAndPrepare(
  image: HTMLImageElement,
  region: { x: number; y: number; width: number; height: number },
) {
  const scaleX = image.naturalWidth / 1080;
  const scaleY = image.naturalHeight / 1080;
  const outputScale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = region.width * outputScale;
  canvas.height = region.height * outputScale;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Unable to prepare the player card for text scanning.");

  context.drawImage(
    image,
    region.x * scaleX,
    region.y * scaleY,
    region.width * scaleX,
    region.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const grey = Math.round(
      pixels.data[index] * 0.299
      + pixels.data[index + 1] * 0.587
      + pixels.data[index + 2] * 0.114
    );
    const value = grey > 145 ? 0 : 255;
    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

function cleanText(value: string) {
  return value
    .replace(/[|_[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9.)'-]+$/, "")
    .trim();
}

function cleanPlayerName(value: string) {
  return cleanText(value).replace(/^([A-Za-z])\s+([A-Za-z])(?=\s)/, "$1$2");
}

export function extractPhoneNumber(value: string) {
  const compact = value.replace(/[^0-9+]/g, "");
  const digits = compact.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? compact : null;
}

export async function recognizeAuctionCard(url: string): Promise<AuctionCardText> {
  const [image, worker] = await Promise.all([loadImage(url), getWorker()]);
  const nameCanvas = cropAndPrepare(image, { x: 500, y: 285, width: 540, height: 155 });
  const roleCanvas = cropAndPrepare(image, { x: 590, y: 430, width: 460, height: 125 });
  const battingCanvas = cropAndPrepare(image, { x: 590, y: 555, width: 390, height: 105 });
  const bowlingCanvas = cropAndPrepare(image, { x: 590, y: 675, width: 390, height: 105 });
  const phoneCanvas = cropAndPrepare(image, { x: 590, y: 760, width: 390, height: 110 });

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .'-()",
  });
  const nameResult = await worker.recognize(nameCanvas);
  const roleResult = await worker.recognize(roleCanvas);
  const battingResult = await worker.recognize(battingCanvas);
  const bowlingResult = await worker.recognize(bowlingCanvas);
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: "0123456789+ -()",
  });
  const phoneResult = await worker.recognize(phoneCanvas);

  return {
    playerName: cleanPlayerName(nameResult.data.text),
    playingRole: cleanText(roleResult.data.text),
    // Decorative numeric fonts are unreliable for OCR. Preserve the
    // filename/database S.NO; admins can still correct it in the dialog.
    registrationNumber: null,
    contactNumber: extractPhoneNumber(phoneResult.data.text),
    battingStyle: cleanText(battingResult.data.text),
    bowlingStyle: cleanText(bowlingResult.data.text),
  };
}
