import sharp from "sharp";
import type { MediaKind } from "./service.ts";

export type OptimizedMedia = {
  bytes: Uint8Array;
  contentType: "image/webp" | "image/gif";
  extension: "webp" | "gif";
};

const MAX_DECODED_PIXELS = 40_000_000;
const MAX_ANIMATION_FRAMES = 180;

export async function optimizeMedia(
  kind: MediaKind,
  contentType: string,
  bytes: Uint8Array,
): Promise<OptimizedMedia> {
  const square = kind === "avatar" || kind === "clan-logo";
  const image = sharp(bytes, {
    animated: contentType === "image/gif",
    failOn: "warning",
    limitInputPixels: MAX_DECODED_PIXELS,
  });
  const metadata = await image.metadata();
  const pages = metadata.pages ?? 1;
  const width = metadata.width ?? 0;
  const pageHeight = metadata.pageHeight ?? metadata.height ?? 0;
  if (
    width < 1 || pageHeight < 1 ||
    pages > MAX_ANIMATION_FRAMES ||
    width * pageHeight * pages > MAX_DECODED_PIXELS
  ) {
    throw new Error("media exceeds decoded image complexity limits");
  }

  const resized = image.rotate().resize({
    width: square ? 512 : 1_920,
    height: square ? 512 : 1_080,
    fit: square ? "cover" : "inside",
    withoutEnlargement: true,
  });

  if (contentType === "image/gif") {
    const output = await resized.gif({
      colours: 128,
      effort: 8,
      dither: 0.65,
      interFrameMaxError: 8,
      interPaletteMaxError: 12,
    }).toBuffer();
    return { bytes: new Uint8Array(output), contentType: "image/gif", extension: "gif" };
  }

  const output = await resized.webp({
    quality: 78,
    alphaQuality: 82,
    effort: 5,
    smartSubsample: true,
  }).toBuffer();
  return { bytes: new Uint8Array(output), contentType: "image/webp", extension: "webp" };
}
