"use client";

import { createWorker, PSM, type Worker } from "tesseract.js";

export type AuctionCardText = {
  playerName: string;
  playingRole: string;
  registrationNumber: number | null;
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
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.)'-]+$/g, "")
    .trim();
}

export async function recognizeAuctionCard(url: string): Promise<AuctionCardText> {
  const [image, worker] = await Promise.all([loadImage(url), getWorker()]);
  const nameCanvas = cropAndPrepare(image, { x: 500, y: 285, width: 540, height: 155 });
  const roleCanvas = cropAndPrepare(image, { x: 590, y: 430, width: 460, height: 125 });
  const serialCanvas = cropAndPrepare(image, { x: 115, y: 735, width: 330, height: 230 });

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_LINE,
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .'-()",
  });
  const nameResult = await worker.recognize(nameCanvas);
  const roleResult = await worker.recognize(roleCanvas);

  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_WORD,
    tessedit_char_whitelist: "0123456789",
  });
  const serialResult = await worker.recognize(serialCanvas);
  const serialMatch = serialResult.data.text.match(/\d{1,4}/);

  return {
    playerName: cleanText(nameResult.data.text),
    playingRole: cleanText(roleResult.data.text),
    registrationNumber: serialMatch ? Number(serialMatch[0]) : null,
  };
}
