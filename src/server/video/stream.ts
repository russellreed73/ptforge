import "server-only";

/**
 * Cloudflare Stream, for uploaded demo videos. Optional: without these
 * settings, coaches can still use YouTube, Vimeo or Google Drive links.
 *
 *   CLOUDFLARE_ACCOUNT_ID            Cloudflare dashboard → Account home → Account ID
 *   CLOUDFLARE_STREAM_API_TOKEN      API token with "Stream: Edit" permission
 *   CLOUDFLARE_STREAM_CUSTOMER_CODE  optional; the "customer-xxxx" part of your Stream
 *                                    playback URLs (Stream → any video → Embed)
 */
export type StreamConfig = { accountId: string; token: string; customerCode: string | null };

export function streamConfig(env: NodeJS.ProcessEnv = process.env): StreamConfig | null {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_STREAM_API_TOKEN?.trim();
  if (!accountId || !token) return null;
  const code = env.CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim().replace(/^customer-/, "") || null;
  return { accountId, token, customerCode: code };
}

/** Longest demo video we accept (Stream reserves storage minutes up front). */
export const MAX_VIDEO_SECONDS = 10 * 60;
/** Basic (non-resumable) uploads are limited to 200 MB by Stream. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

type CfResponse<T> = { success: boolean; errors?: { message: string }[]; result: T };

async function cf<T>(cfg: StreamConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/stream${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    },
  );
  const body = (await res.json().catch(() => null)) as CfResponse<T> | null;
  if (!res.ok || !body?.success) {
    const msg = body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(`Cloudflare Stream: ${msg}`);
  }
  return body.result;
}

/**
 * A one-time URL the coach's browser uploads the file to directly, so the
 * video never passes through PTForge's servers and the API token stays secret.
 */
export async function createDirectUpload(
  cfg: StreamConfig,
  meta: { tenantId: string; name: string },
): Promise<{ uid: string; uploadURL: string }> {
  return cf(cfg, "/direct_upload", {
    method: "POST",
    body: JSON.stringify({
      maxDurationSeconds: MAX_VIDEO_SECONDS,
      creator: meta.tenantId,
      meta: { name: meta.name.slice(0, 200), tenant: meta.tenantId },
    }),
  });
}

export type StreamVideoState = {
  ready: boolean;
  /** pendingupload | downloading | queued | inprogress | ready | error */
  state: string;
  durationSeconds: number | null;
  errorReason: string | null;
};

export async function getStreamVideo(cfg: StreamConfig, uid: string): Promise<StreamVideoState> {
  const v = await cf<{
    readyToStream?: boolean;
    duration?: number;
    status?: { state?: string; errorReasonText?: string };
  }>(cfg, `/${encodeURIComponent(uid)}`);
  return {
    ready: v.readyToStream === true,
    state: v.status?.state ?? "unknown",
    durationSeconds: typeof v.duration === "number" && v.duration > 0 ? v.duration : null,
    errorReason: v.status?.errorReasonText || null,
  };
}

/** Where to play a Stream video in an <iframe>. */
export function streamIframeUrl(cfg: StreamConfig | null, uid: string): string {
  const id = encodeURIComponent(uid);
  return cfg?.customerCode
    ? `https://customer-${cfg.customerCode}.cloudflarestream.com/${id}/iframe`
    : `https://iframe.videodelivery.net/${id}`;
}

export async function deleteStreamVideo(cfg: StreamConfig, uid: string): Promise<void> {
  await cf(cfg, `/${encodeURIComponent(uid)}`, { method: "DELETE" }).catch((err) =>
    console.error("[stream] delete failed", uid, err),
  );
}
