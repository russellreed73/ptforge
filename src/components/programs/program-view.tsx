"use client";

import { useState } from "react";
import { VideoPlayer, type PlayerVideo } from "@/components/exercises/video-player";
import { formatRpe, type ProgramContent } from "@/lib/programs";

export type ViewExerciseInfo = { competition: boolean; video: PlayerVideo | null };

/**
 * What the athlete sees (Jacob's Program tab, read-only for now): pick a day
 * and a week, then the warm-up and each exercise with its sets, reps and RPE
 * target for that week. Logging weights arrives in the next step.
 */
export function ProgramView({
  slug,
  name,
  goals,
  weeks,
  initialWeek,
  content,
  info,
}: {
  slug: string;
  name: string;
  goals: string | null;
  weeks: number;
  initialWeek: number;
  content: ProgramContent;
  info: Record<string, ViewExerciseInfo>;
}) {
  const [dayIdx, setDayIdx] = useState(0);
  const [week, setWeek] = useState(initialWeek);
  const [openVideo, setOpenVideo] = useState<string | null>(null);
  const day = content.days[Math.min(dayIdx, content.days.length - 1)];

  if (!day) return <p className="text-subtle">This block has no days yet.</p>;

  const videoButton = (key: string, exerciseId: string | null) => {
    const v = exerciseId ? info[exerciseId]?.video : null;
    if (!v) return null;
    const open = openVideo === key;
    return (
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpenVideo(open ? null : key)}
        className={`font-heading shrink-0 border px-2.5 py-1 text-[0.7rem] font-semibold tracking-[0.12em] uppercase ${
          open ? "border-primary bg-primary text-primary-foreground" : "border-primary text-primary"
        }`}
      >
        {open ? "Close video" : "▶ Video"}
      </button>
    );
  };
  const videoPanel = (key: string, exerciseId: string | null, title: string) => {
    const v = exerciseId ? info[exerciseId]?.video : null;
    return openVideo === key && v ? (
      <div className="mt-3">
        <VideoPlayer slug={slug} title={title} video={v} />
      </div>
    ) : null;
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow mb-2">{name}</p>
        {goals && <p className="text-subtle text-sm">Goals: {goals}</p>}
      </div>

      {content.days.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Day">
          {content.days.map((d, i) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={i === dayIdx}
              onClick={() => {
                setDayIdx(i);
                setOpenVideo(null);
              }}
              className={`font-heading shrink-0 border px-3 py-2 text-xs font-semibold tracking-[0.12em] whitespace-nowrap uppercase ${
                i === dayIdx
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-subtle"
              }`}
            >
              {d.title.split("—")[0].trim() || `Day ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="display text-3xl">{day.title}</h2>
        <div className="flex gap-1.5" role="group" aria-label="Week">
          {Array.from({ length: weeks }, (_, w) => (
            <button
              key={w}
              type="button"
              aria-pressed={week === w + 1}
              onClick={() => setWeek(w + 1)}
              className={`font-heading border px-2.5 py-1 text-xs font-semibold tracking-[0.12em] ${
                week === w + 1 ? "border-primary text-primary" : "border-border text-subtle"
              }`}
            >
              W{w + 1}
            </button>
          ))}
        </div>
      </div>
      {day.notes && <p className="text-subtle text-sm whitespace-pre-line">{day.notes}</p>}

      {day.warmups.length > 0 && (
        <section className="border-border bg-surface border p-4" aria-label="Warm-up">
          <h3 className="font-heading text-muted text-xs font-semibold tracking-[0.15em] uppercase">
            Pre — warm-up
          </h3>
          <ul className="divide-border mt-2 divide-y">
            {day.warmups.map((w) => (
              <li key={w.id} className="py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{w.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-subtle tabular-nums">{w.dose}</span>
                    {videoButton(w.id, w.exerciseId)}
                  </span>
                </div>
                {videoPanel(w.id, w.exerciseId, w.name)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {day.exercises.map((ex) => {
        const sbd = ex.exerciseId ? info[ex.exerciseId]?.competition : false;
        return (
          <section key={ex.id} className="border-border bg-surface border p-4" aria-label={ex.name}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold tracking-[0.06em] uppercase">
                {ex.name}
                {sbd && <span className="text-primary ml-2 text-xs">SBD</span>}
              </h3>
              {videoButton(ex.id, ex.exerciseId)}
            </div>
            {ex.notes && <p className="text-subtle mt-1 text-sm">{ex.notes}</p>}
            {videoPanel(ex.id, ex.exerciseId, ex.name)}
            <ol className="mt-3 flex flex-col gap-1.5">
              {ex.sets.map((s, si) => (
                <li
                  key={s.id}
                  className="border-border bg-background flex items-center justify-between gap-3 border px-3 py-2 text-sm"
                >
                  <span className="font-heading text-muted text-xs font-semibold tracking-[0.12em] uppercase">
                    Set {si + 1}
                  </span>
                  <span className="tabular-nums">
                    {s.reps ? `${s.reps} reps` : "—"}
                    <span className="text-primary ml-3 font-semibold">
                      {s.backdownPct !== null
                        ? `Backdown: ${s.backdownPct}% lighter`
                        : formatRpe(s.rpe[week - 1])}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
      {day.exercises.length === 0 && <p className="text-subtle">No exercises on this day.</p>}
    </div>
  );
}
