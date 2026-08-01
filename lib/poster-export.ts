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
  if (!dataUrl.startsWith("data:image/") && !dataUrl.startsWith("blob:")) {
    throw new Error("Poster export did not produce a downloadable image.");
  }
  let downloadUrl = dataUrl;
  if (dataUrl.startsWith("data:image/")) {
    const [metadata, encoded] = dataUrl.split(",", 2);
    if (!encoded) throw new Error("Poster image data is incomplete.");
    const mimeType = metadata.match(/^data:([^;]+)/)?.[1] || "image/jpeg";
    const binary = metadata.includes(";base64") ? window.atob(encoded) : decodeURIComponent(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    downloadUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  }
  const link = document.createElement("a");
  link.download = filename;
  link.href = downloadUrl;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (downloadUrl !== dataUrl) window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 10_000);
}
