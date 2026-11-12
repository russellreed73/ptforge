/**
 * Demo video links. Coaches can paste a YouTube, Vimeo or Google Drive link
 * (Jacob's videos live on Google Drive today) or any other https link.
 * Client-safe.
 */
export type VideoLink =
  | { kind: "youtube"; id: string; embedUrl: string; url: string }
  | { kind: "vimeo"; id: string; embedUrl: string; url: string }
  | { kind: "drive"; id: string; embedUrl: string; url: string }
  | { kind: "other"; url: string };

export const VIDEO_KIND_LABELS = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  drive: "Google Drive",
  other: "Link",
} as const;

/** Reads a pasted link; null if it isn't an http(s) URL. */
export function parseVideoLink(input: string | null | undefined): VideoLink | null {
  if (!input) return null;
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const url = u.toString();
  const host = u.hostname.replace(/^www\.|^m\./, "");

  // YouTube: watch?v=, youtu.be/, shorts/, embed/, live/
  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1).split("/")[0];
  else if (
    host === "youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "music.youtube.com"
  ) {
    yt =
      u.searchParams.get("v") ??
      u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] ??
      null;
  }
  if (yt && /^[\w-]{6,20}$/.test(yt)) {
    const start = u.searchParams.get("t")?.replace(/s$/, "");
    const startParam = start && /^\d+$/.test(start) ? `?start=${start}` : "";
    return {
      kind: "youtube",
      id: yt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}${startParam}`,
      url,
    };
  }

  // Vimeo: vimeo.com/123456789 or player.vimeo.com/video/123456789 (optionally /hash)
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:\/video)?\/(\d{6,12})(?:\/([0-9a-f]{6,20}))?/);
    if (m) {
      const hash = m[2] ?? u.searchParams.get("h");
      return {
        kind: "vimeo",
        id: m[1],
        embedUrl: `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ""}`,
        url,
      };
    }
  }

  // Google Drive: /file/d/<id>/view, open?id=<id>, uc?id=<id>
  if (host === "drive.google.com") {
    const id = u.pathname.match(/\/file\/d\/([\w-]{10,})/)?.[1] ?? u.searchParams.get("id");
    if (id && /^[\w-]{10,}$/.test(id)) {
      return {
        kind: "drive",
        id,
        embedUrl: `https://drive.google.com/file/d/${id}/preview`,
        url,
      };
    }
  }

  return { kind: "other", url };
}
