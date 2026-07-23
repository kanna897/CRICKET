export type PosterQuality = "hd" | "4k";

const TARGET_LONG_EDGE: Record<PosterQuality, number> = {
  hd: 1920,
  "4k": 3840,
};

export function posterPixelRatio(element: HTMLElement, quality: PosterQuality) {
  const naturalLongEdge = Math.max(element.offsetWidth, element.offsetHeight, 1);
  return Math.max(1, Math.min(6, TARGET_LONG_EDGE[quality] / naturalLongEdge));
}

export function posterQualityLabel(quality: PosterQuality) {
  return quality === "4k" ? "4K" : "HD";
}

export async function downloadPosterDataUrl(dataUrl: string, filename: string) {
  const blob = await (await fetch(dataUrl)).blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = objectUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}
