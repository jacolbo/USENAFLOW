import sharp from "sharp";

/**
 * Preview rendering — the pure part.
 *
 * Deliberately free of database and storage imports so it can be exercised on
 * its own, which is what you want from the code that decides how a client's
 * photographs actually look.
 *
 * Two derivatives per photograph, because one image cannot do both jobs:
 *
 *   thumb    grid. Small enough that four hundred of them load.
 *   preview  lightbox and full screen. Large enough that nobody can tell it
 *            from the original on a screen.
 *
 * "Indistinguishable" is a resolution claim, not a marketing one: PREVIEW_EDGE
 * is wider than a 4K display, so at these settings the limiting factor is the
 * screen, not the file. It is deliberately still not the master — the original
 * keeps its full pixel dimensions and its metadata, and only reaches a client
 * after the studio has approved delivery.
 */

export const THUMB_EDGE = Number(process.env.DELIVERY_THUMB_EDGE || 640);
export const THUMB_QUALITY = Number(process.env.DELIVERY_THUMB_QUALITY || 82);

export const PREVIEW_EDGE = Number(process.env.DELIVERY_PREVIEW_EDGE || 3200);
export const PREVIEW_QUALITY = Number(process.env.DELIVERY_PREVIEW_QUALITY || 92);

/**
 * sharp decodes untrusted image data. This cap stops a malformed or hostile
 * file turning a decode into an out-of-memory kill.
 */
function reader(buffer: Buffer) {
  return sharp(buffer, {
    limitInputPixels: 400_000_000, // ~20000x20000, well past any camera
    sequentialRead: true,
  });
}

export interface Rendered {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
}

async function render(source: Buffer, edge: number, quality: number): Promise<Rendered> {
  const output = await reader(source)
    // Honour the EXIF orientation flag and then drop it, so the pixels are
    // already the right way up. A client's browser is not guaranteed to read it.
    .rotate()
    .resize({
      width: edge,
      height: edge,
      // "inside" bounds the LONG edge, so a portrait frame is limited by its
      // height rather than being blown up to `edge` wide.
      fit: "inside",
      withoutEnlargement: true,
      // Lanczos. It is already the default, but a resampling kernel is exactly
      // the kind of thing that should be stated rather than inherited.
      kernel: "lanczos3",
    })
    .jpeg({
      quality,
      // No chroma subsampling. 4:2:0 is invisible on most images and very
      // visible on saturated edges — a red dress against skin, which is
      // precisely what a photographer notices first.
      chromaSubsampling: "4:4:4",
      mozjpeg: true,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: output.data,
    contentType: "image/jpeg",
    width: output.info.width,
    height: output.info.height,
  };
}

export function renderThumb(source: Buffer): Promise<Rendered> {
  return render(source, THUMB_EDGE, THUMB_QUALITY);
}

export function renderPreview(source: Buffer): Promise<Rendered> {
  return render(source, PREVIEW_EDGE, PREVIEW_QUALITY);
}
