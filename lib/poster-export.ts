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

export async function inlinePosterImages(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll("img"));
  const originals = images.map((image) => ({
    image,
    src: image.getAttribute("src"),
    srcset: image.getAttribute("srcset"),
  }));

  await Promise.all(images.map(async (image) => {
    const source = image.currentSrc || image.src;
    if (!source || source.startsWith("data:") || source.startsWith("blob:")) return;
    try {
      const response = await fetch(new URL(source, window.location.href), { cache: "force-cache", mode: "cors" });
      if (!response.ok) throw new Error(`Image request failed with ${response.status}`);
      const dataUrl = await blobToDataUrl(await response.blob());
      image.removeAttribute("srcset");
      image.src = dataUrl;
      try { await image.decode(); } catch { /* The loaded data URL can still be exported. */ }
    } catch {
      // Keep the original source so html-to-image can make its own final attempt.
    }
  }));

  return () => {
    for (const { image, src, srcset } of originals) {
      if (src === null) image.removeAttribute("src"); else image.setAttribute("src", src);
      if (srcset === null) image.removeAttribute("srcset"); else image.setAttribute("srcset", srcset);
    }
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image conversion failed.")), { once: true });
    reader.addEventListener("error", () => reject(reader.error || new Error("Image conversion failed.")), { once: true });
    reader.readAsDataURL(blob);
  });
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
