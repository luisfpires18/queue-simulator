// Client-side banner downscaling. The server deliberately has no image
// library (adding `sharp` for one feature isn't worth a native dependency),
// so the browser does the resizing: a 6 MB phone photo becomes a ~100 KB
// webp before it ever reaches the network.

export const BANNER_WIDTH = 1600;
export const BANNER_HEIGHT = 400;

export class ImageResizeError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageResizeError("That file could not be read as an image."));
    };
    img.src = url;
  });
}

/**
 * Cover-crops `file` to the banner aspect ratio and re-encodes it as webp.
 * Throws ImageResizeError with a message meant for direct display.
 */
export async function resizeToBanner(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new ImageResizeError("Pick an image file.");
  }

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = BANNER_WIDTH;
  canvas.height = BANNER_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageResizeError("Your browser blocked canvas rendering.");

  // Cover: scale so the shorter side fills, then centre the overflow.
  const scale = Math.max(BANNER_WIDTH / img.width, BANNER_HEIGHT / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (BANNER_WIDTH - w) / 2, (BANNER_HEIGHT - h) / 2, w, h);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new ImageResizeError("Could not encode that image.");
  return blob;
}
