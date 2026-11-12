"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { parseVideoLink, VIDEO_KIND_LABELS } from "@/lib/video";
import { refreshVideoStatus } from "@/app/[tenant]/(app)/exercises/actions";

export type PlayerVideo =
  | { type: "link"; url: string }
  | { type: "upload"; iframeUrl: string; status: string; videoAssetId: string };

/** Plays an exercise's demo video, or explains why it can't yet. */
export function VideoPlayer({
  slug,
  title,
  video,
}: {
  slug: string;
  title: string;
  video: PlayerVideo;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(video.type === "upload" ? video.status : "ready");

  // Uploaded videos take a minute or two to process on Cloudflare.
  useEffect(() => {
    if (video.type !== "upload" || status === "ready" || status === "error") return;
    const t = setInterval(async () => {
      const r = await refreshVideoStatus(slug, video.videoAssetId);
      setStatus(r.status);
      if (r.status === "ready") router.refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [video, status, slug, router]);

  if (video.type === "upload") {
    if (status !== "ready") {
      return (
        <div className="border-border bg-background text-subtle flex aspect-video items-center justify-center border p-6 text-center text-sm">
          {status === "error"
            ? "Cloudflare couldn't process this video. Try uploading it again."
            : "Processing the video… it'll play here in a minute or two."}
        </div>
      );
    }
    return <Frame src={video.iframeUrl} title={title} />;
  }

  const link = parseVideoLink(video.url);
  if (!link) return null;
  if (link.kind === "other") {
    return (
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="border-border bg-background hover:border-primary flex aspect-video items-center justify-center border p-6 text-center"
      >
        <span className="font-heading text-sm font-semibold tracking-[0.15em] uppercase">
          ▶ Open video
        </span>
      </a>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Frame src={link.embedUrl} title={title} />
      <p className="text-muted text-xs">
        {VIDEO_KIND_LABELS[link.kind]} ·{" "}
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary underline"
        >
          open in a new tab
        </a>
        {link.kind === "drive" &&
          " · If it doesn't play, set the file's sharing to “Anyone with the link”."}
      </p>
    </div>
  );
}

function Frame({ src, title }: { src: string; title: string }) {
  return (
    <div className="border-border relative aspect-video w-full overflow-hidden border bg-black">
      <iframe
        src={src}
        title={`${title} demo video`}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
