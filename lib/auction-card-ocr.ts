"use client";

import { createWorker, PSM, type Worker } from "tesseract.js";
import type { OcrResult, OcrRuntimeParamsInput } from "@paddleocr/paddleocr-js";

export type AuctionCardText = {
  playerName: string;
  playingRole: string;
  registrationNumber: number | null;
  contactNumber: string | null;
  battingStyle: string;
  bowlingStyle: string;
};

let workerPromise: Promise<Worker> | null = null;
type PaddleEngine = { predict: (input: unknown, params?: OcrRuntimeParamsInput) => Promise<OcrResult[]> };
let paddlePromise: Promise<PaddleEngine> | null = null;

function getWorker() {
  workerPromise ??= createWorker("eng", 1);
  return workerPromise;
}

function getPaddleEngine() {
  paddlePromise ??= import("@paddleocr/paddleocr-js")
    .then(({ PaddleOCR }) => PaddleOCR.create({
      textDetectionModelName: "PP-OCRv6_tiny_det",
      textRecognitionModelName: "PP-OCRv6_tiny_rec",
      worker: true,
      textRecognitionBatchSize: 5,
      ortOptions: {
        backend: "wasm",
        wasmPaths: "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/",
        numThreads: 1,
        simd: true,
      },
    }));
  return paddlePromise!;
}

async function loadImage(url: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return image;
}

function cropCardRegion(
  image: HTMLImageElement,
  region: { x: number; y: number; width: number; height: number },
  binary = false,
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

  if (binary) {
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
  }
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
  const compact = value.replace(/[\s().-]/g, "");
  if (/^\d{10}$/.test(compact)) return compact;
  if (/^\+94\d{9}$/.test(compact)) return compact;
  return null;
}

export function cleanPlayingStyle(value: string) {
  const cleaned = cleanText(value).replace(/[^A-Za-z -]/g, "").replace(/\s+/g, " ").trim();
  if (/right.*hand/i.test(cleaned)) return "Right Hand";
  if (/left.*hand/i.test(cleaned)) return "Left Hand";
  return cleaned;
}

function paddleText(result: OcrResult | undefined, minimumScore: number) {
  if (!result) return "";
  return result.items
    .filter((item) => item.score >= minimumScore)
    .sort((left, right) => Math.min(...left.poly.map((point) => point[1])) - Math.min(...right.poly.map((point) => point[1])))
    .map((item) => item.text)
    .join(" ");
}

function usablePlayerName(value: string) {
  const cleaned = cleanPlayerName(value);
  return /[A-Za-z]{3}/.test(cleaned) && !/^player$/i.test(cleaned) ? cleaned : "";
}

async function recognizeWithTesseract(canvases: HTMLCanvasElement[]) {
  const worker = await getWorker();
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .'-()",
  });
  const textResults = [];
  for (const canvas of canvases.slice(0, 4)) textResults.push(await worker.recognize(canvas));
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: "0123456789+ -()",
  });
  const phoneResult = await worker.recognize(canvases[4]);
  return [...textResults.map((result) => result.data.text), phoneResult.data.text];
}

export async function recognizeAuctionCard(url: string): Promise<AuctionCardText> {
  const image = await loadImage(url);
  const regions = [
    { x: 500, y: 285, width: 540, height: 155 },
    { x: 590, y: 430, width: 460, height: 125 },
    { x: 590, y: 555, width: 390, height: 105 },
    { x: 590, y: 675, width: 390, height: 105 },
    { x: 590, y: 760, width: 390, height: 110 },
  ];
  const paddleCanvases = regions.map((region) => cropCardRegion(image, region));
  let values = ["", "", "", "", ""];

  try {
    const paddle = await getPaddleEngine();
    const results = await paddle.predict(paddleCanvases, { textRecScoreThresh: 0.5 });
    values = results.map((result) => paddleText(result, 0.55));
  } catch (reason) {
    // Model/CDN/browser failures must not disable card scanning completely.
    console.warn("PaddleOCR unavailable; using Tesseract fallback.", reason);
  }

  if (!usablePlayerName(values[0]) || values.some((value, index) => index > 0 && !value)) {
    const fallbackCanvases = regions.map((region) => cropCardRegion(image, region, true));
    const fallback = await recognizeWithTesseract(fallbackCanvases);
    values = values.map((value, index) => value || fallback[index]);
  }

  return {
    playerName: usablePlayerName(values[0]),
    playingRole: cleanText(values[1]),
    // Decorative numeric fonts are unreliable for OCR. Preserve the
    // filename/database S.NO; admins can still correct it in the dialog.
    registrationNumber: null,
    contactNumber: extractPhoneNumber(values[4]),
    battingStyle: cleanPlayingStyle(values[2]),
    bowlingStyle: cleanPlayingStyle(values[3]),
  };
}
