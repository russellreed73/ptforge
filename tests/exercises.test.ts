import { afterEach, describe, expect, it, vi } from "vitest";
import { exerciseSchema, exerciseSummary, parseList, parseTags } from "@/lib/exercises";
import { parseVideoLink } from "@/lib/video";

vi.mock("server-only", () => ({}));

describe("parseVideoLink", () => {
  it.each([
    [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "youtube",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ],
    [
      "https://youtu.be/dQw4w9WgXcQ?t=42",
      "youtube",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=42",
    ],
    [
      "https://youtube.com/shorts/abcDEF12345",
      "youtube",
      "https://www.youtube-nocookie.com/embed/abcDEF12345",
    ],
    ["https://vimeo.com/123456789", "vimeo", "https://player.vimeo.com/video/123456789"],
    [
      "https://vimeo.com/123456789/abcdef1234",
      "vimeo",
      "https://player.vimeo.com/video/123456789?h=abcdef1234",
    ],
    [
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/view?usp=sharing",
      "drive",
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/preview",
    ],
    [
      "https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUv",
      "drive",
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUv/preview",
    ],
  ])("%s", (url, kind, embed) => {
    const v = parseVideoLink(url);
    expect(v?.kind).toBe(kind);
    expect(v && "embedUrl" in v ? v.embedUrl : null).toBe(embed);
  });

  it("keeps other https links as plain links and rejects non-links", () => {
    expect(parseVideoLink("https://example.com/squat.mp4")?.kind).toBe("other");
    expect(parseVideoLink("javascript:alert(1)")).toBeNull();
    expect(parseVideoLink("not a url")).toBeNull();
    expect(parseVideoLink("")).toBeNull();
  });
});

describe("exercise fields", () => {
  it("cleans tags and lists", () => {
    expect(parseTags("Biceps, arms ,curl, biceps,  ")).toEqual(["biceps", "arms", "curl"]);
    expect(parseList("Quads, glutes, quads")).toEqual(["Quads", "glutes"]);
  });

  it("keeps the sbd tag and competition switch in step", () => {
    const a = exerciseSchema.parse({ name: "Comp Squat", tags: "squat", competitionLift: true });
    expect(a.tags).toEqual(["squat", "sbd"]);
    expect(a.isCompetitionLift).toBe(true);
    const b = exerciseSchema.parse({ name: "Comp Bench", tags: "bench, SBD" });
    expect(b.isCompetitionLift).toBe(true);
  });

  it("stores one video: an upload wins over a link", () => {
    const id = crypto.randomUUID();
    const v = exerciseSchema.parse({
      name: "Curl",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      videoAssetId: id,
    });
    expect(v.demoVideoUrl).toBeNull();
    expect(v.videoAssetId).toBe(id);
  });

  it("rejects bad links and empty names", () => {
    expect(exerciseSchema.safeParse({ name: "Curl", videoUrl: "youtube" }).success).toBe(false);
    expect(exerciseSchema.safeParse({ name: " " }).success).toBe(false);
  });

  it("doesn't repeat the same word in the summary", () => {
    expect(
      exerciseSummary({
        primaryMuscles: ["Back"],
        category: "Back",
        equipment: "Cable",
        movement: null,
      }),
    ).toBe("Back · Cable");
  });

  it("summarises like the prototype's cards", () => {
    expect(
      exerciseSummary({
        primaryMuscles: ["Quads"],
        category: "Squat accessory",
        equipment: "Band",
        movement: "Single leg",
      }),
    ).toBe("Quads · Squat accessory · Band · Single leg");
  });
});

describe("Cloudflare Stream", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is off until both settings exist", async () => {
    const { streamConfig, streamIframeUrl } = await import("@/server/video/stream");
    expect(
      streamConfig({ CLOUDFLARE_ACCOUNT_ID: "acc" } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
    const cfg = streamConfig({
      CLOUDFLARE_ACCOUNT_ID: "acc",
      CLOUDFLARE_STREAM_API_TOKEN: "tok",
      CLOUDFLARE_STREAM_CUSTOMER_CODE: "customer-abc123",
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg).toEqual({ accountId: "acc", token: "tok", customerCode: "abc123" });
    expect(streamIframeUrl(cfg, "uid1")).toBe(
      "https://customer-abc123.cloudflarestream.com/uid1/iframe",
    );
    expect(streamIframeUrl(null, "uid1")).toBe("https://iframe.videodelivery.net/uid1");
  });

  it("creates a direct upload and reads video status", async () => {
    const { createDirectUpload, getStreamVideo } = await import("@/server/video/stream");
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        const result = url.endsWith("/direct_upload")
          ? { uid: "u1", uploadURL: "https://upload.videodelivery.net/u1" }
          : { readyToStream: true, duration: 12.5, status: { state: "ready" } };
        return new Response(JSON.stringify({ success: true, result }), { status: 200 });
      }),
    );
    const cfg = { accountId: "acc", token: "tok", customerCode: null };
    const up = await createDirectUpload(cfg, { tenantId: "t1", name: "squat.mp4" });
    expect(up).toEqual({ uid: "u1", uploadURL: "https://upload.videodelivery.net/u1" });
    expect(calls[0].url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acc/stream/direct_upload",
    );
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      maxDurationSeconds: 600,
      creator: "t1",
    });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(await getStreamVideo(cfg, "u1")).toEqual({
      ready: true,
      state: "ready",
      durationSeconds: 12.5,
      errorReason: null,
    });
  });

  it("reports Cloudflare's error message", async () => {
    const { createDirectUpload } = await import("@/server/video/stream");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ success: false, errors: [{ message: "Authentication error" }] }),
            {
              status: 403,
            },
          ),
      ),
    );
    await expect(
      createDirectUpload(
        { accountId: "a", token: "bad", customerCode: null },
        { tenantId: "t", name: "x" },
      ),
    ).rejects.toThrow("Authentication error");
  });
});
