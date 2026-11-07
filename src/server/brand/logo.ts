import sharp, { type Metadata as SharpMetadata } from "sharp";

/** What a logo upload produces. Each becomes a row in business_assets. */
export const LOGO_ASSETS = ["header", "icon-192", "icon-512", "maskable-512", "apple-180"] as const;
export type LogoAsset = (typeof LOGO_ASSETS)[number];

export type GeneratedImage = {
  kind: LogoAsset;
  contentType: "image/png";
  width: number;
  height: number;
  data: Buffer;
};

/** Vercel rejects request bodies over 4.5 MB, so stay under that. */
export const MAX_LOGO_BYTES = 4 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp", "svg"]);

export class LogoError extends Error {}

/**
 * Turns one uploaded logo into every size PTForge needs:
 *   header        up to 96 px tall, transparent, for the top of the app and emails
 *   icon-192/512  home-screen icons (transparent padding)
 *   maskable-512  Android adaptive icon: logo inside the 80% safe zone on a solid colour
 *   apple-180     iPhone home-screen icon on a solid colour (iOS adds the rounded corners)
 *
 * SVGs are rasterised here and never served as SVG, so an uploaded SVG can't
 * run scripts in visitors' browsers.
 */
export async function generateLogoAssets(
  input: Buffer,
  background: string,
): Promise<{ images: GeneratedImage[]; warnings: string[] }> {
  if (input.byteLength > MAX_LOGO_BYTES) throw new LogoError("The logo must be 4 MB or smaller.");

  let meta: SharpMetadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new LogoError("That file isn't an image PTForge can read. Use PNG, JPG, WebP or SVG.");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new LogoError("Use a PNG, JPG, WebP or SVG file.");
  }

  // Render SVGs large so the icons stay sharp; trim empty borders.
  const isSvg = meta.format === "svg";
  const base = await sharp(input, { density: isSvg ? 600 : 72 })
    .rotate()
    .ensureAlpha()
    .trim({ threshold: 1 })
    .png()
    .toBuffer({ resolveWithObject: true });

  const warnings: string[] = [];
  const shortest = Math.min(base.info.width, base.info.height);
  if (!isSvg && shortest < 512) {
    warnings.push(
      `This logo is only ${base.info.width}×${base.info.height} pixels, so phone icons may look blurry. A 1024 px PNG or an SVG works best.`,
    );
  }

  const square = async (size: number, padding: number, bg: string | null) => {
    const inner = Math.round(size * (1 - padding * 2));
    const logo = await sharp(base.data)
      .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: logo, gravity: "centre" }])
      .png()
      .toBuffer();
  };

  const header = await sharp(base.data)
    .resize({ height: 96, width: 480, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });

  const images: GeneratedImage[] = [
    {
      kind: "header",
      contentType: "image/png",
      width: header.info.width,
      height: header.info.height,
      data: header.data,
    },
    {
      kind: "icon-192",
      contentType: "image/png",
      width: 192,
      height: 192,
      data: await square(192, 0.08, background),
    },
    {
      kind: "icon-512",
      contentType: "image/png",
      width: 512,
      height: 512,
      data: await square(512, 0.08, background),
    },
    // Android crops maskable icons to a circle or squircle: keep the logo inside the middle 80%.
    {
      kind: "maskable-512",
      contentType: "image/png",
      width: 512,
      height: 512,
      data: await square(512, 0.18, background),
    },
    {
      kind: "apple-180",
      contentType: "image/png",
      width: 180,
      height: 180,
      data: await square(180, 0.1, background),
    },
  ];
  return { images, warnings };
}
