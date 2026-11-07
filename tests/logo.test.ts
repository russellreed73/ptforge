import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { generateLogoAssets, LogoError } from "@/server/brand/logo";

const square = (size: number) =>
  sharp({ create: { width: size, height: size, channels: 4, background: "#e8171a" } })
    .png()
    .toBuffer();

describe("generateLogoAssets", () => {
  it("makes the header and every icon size", async () => {
    const { images, warnings } = await generateLogoAssets(await square(1024), "#0a0a0a");
    expect(warnings).toEqual([]);
    const sizes = Object.fromEntries(images.map((i) => [i.kind, [i.width, i.height]]));
    expect(sizes).toEqual({
      header: [96, 96],
      "icon-192": [192, 192],
      "icon-512": [512, 512],
      "maskable-512": [512, 512],
      "apple-180": [180, 180],
    });
    for (const img of images) {
      const meta = await sharp(img.data).metadata();
      expect(meta.format).toBe("png");
      expect([meta.width, meta.height]).toEqual([img.width, img.height]);
    }
  });

  it("paints icons on the theme background", async () => {
    const { images } = await generateLogoAssets(await square(1024), "#0a0a0a");
    const apple = images.find((i) => i.kind === "apple-180")!;
    const { data } = await sharp(apple.data).raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)]).toEqual([0x0a, 0x0a, 0x0a]); // top-left corner pixel
  });

  it("warns about small logos", async () => {
    const { warnings } = await generateLogoAssets(await square(200), "#ffffff");
    expect(warnings[0]).toMatch(/200×200/);
  });

  it("rasterises SVGs (never stored as SVG)", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="red"/></svg>',
    );
    const { images, warnings } = await generateLogoAssets(svg, "#ffffff");
    expect(warnings).toEqual([]);
    expect(images.every((i) => i.contentType === "image/png")).toBe(true);
    const header = images.find((i) => i.kind === "header")!;
    expect(header.height).toBe(96);
    expect(header.width).toBeCloseTo(192, -1); // 2:1, give or take anti-aliased edges
  });

  it("rejects files that aren't images", async () => {
    await expect(generateLogoAssets(Buffer.from("not an image"), "#fff")).rejects.toBeInstanceOf(
      LogoError,
    );
  });
});
