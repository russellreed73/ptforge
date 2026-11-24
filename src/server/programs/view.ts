import "server-only";
import type { PlayerVideo } from "@/components/exercises/video-player";
import type { ViewExerciseInfo } from "@/components/programs/program-view";
import type { ProgramContent } from "@/lib/programs";
import type { TenantContext } from "../db/tenant";
import { streamConfig, streamIframeUrl } from "../video/stream";
import { exerciseDetailsFor } from "./queries";

/** Videos and SBD flags for every exercise in a block, ready for ProgramView. */
export async function programViewInfo(
  ctx: TenantContext,
  content: ProgramContent,
): Promise<Record<string, ViewExerciseInfo>> {
  const details = await exerciseDetailsFor(ctx, content);
  const cfg = streamConfig();
  const out: Record<string, ViewExerciseInfo> = {};
  for (const [id, d] of details) {
    let video: PlayerVideo | null = null;
    if (d.asset)
      video = {
        type: "upload",
        iframeUrl: streamIframeUrl(cfg, d.asset.providerRef),
        status: d.asset.status,
        videoAssetId: d.asset.id,
      };
    else if (d.demoVideoUrl) video = { type: "link", url: d.demoVideoUrl };
    out[id] = { competition: d.competition, video };
  }
  return out;
}

/** Which week of the block today falls in (1 if not started or no start date). */
export function currentWeek(startDate: string | null, weeks: number, today = new Date()): number {
  if (!startDate) return 1;
  const start = new Date(`${startDate}T00:00:00`);
  const days = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return 1;
  return Math.min(weeks, Math.floor(days / 7) + 1);
}
