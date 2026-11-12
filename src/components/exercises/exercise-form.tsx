"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  Button,
  ErrorText,
  Field,
  inputClass,
  labelTextClass,
  TextAreaField,
} from "@/components/ui";
import {
  EQUIPMENT_SUGGESTIONS,
  FAMILY_SUGGESTIONS,
  MOVEMENT_SUGGESTIONS,
  MUSCLE_SUGGESTIONS,
} from "@/lib/exercises";
import { parseVideoLink, VIDEO_KIND_LABELS } from "@/lib/video";
import {
  createExercise,
  refreshVideoStatus,
  startVideoUpload,
  updateExercise,
} from "@/app/[tenant]/(app)/exercises/actions";

export type ExerciseFormValues = {
  name: string;
  muscles: string;
  family: string;
  equipment: string;
  movement: string;
  tags: string;
  cues: string;
  competitionLift: boolean;
  videoUrl: string;
  videoAssetId: string | null;
  videoFileName: string | null;
};

export const EMPTY_EXERCISE: ExerciseFormValues = {
  name: "",
  muscles: "",
  family: "",
  equipment: "",
  movement: "",
  tags: "",
  cues: "",
  competitionLift: false,
  videoUrl: "",
  videoAssetId: null,
  videoFileName: null,
};

type VideoMode = "none" | "link" | "upload";

/** Add or edit an exercise, with its demo video (link or upload). */
export function ExerciseForm({
  slug,
  exerciseId,
  initial,
  uploadsEnabled,
}: {
  slug: string;
  exerciseId?: string;
  initial: ExerciseFormValues;
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [mode, setMode] = useState<VideoMode>(
    initial.videoAssetId ? "upload" : initial.videoUrl ? "link" : "none",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const bind = (k: keyof ExerciseFormValues) => ({
    name: k,
    value: v[k] as string,
    onChange: (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value }),
  });
  const link = parseVideoLink(v.videoUrl);

  async function upload(file: File) {
    setError(null);
    setUploadNote(null);
    const startRes = await startVideoUpload(slug, {
      name: file.name,
      size: file.size,
      type: file.type,
    });
    if (!startRes.ok) return setError(startRes.error);
    setProgress(0);
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", startRes.uploadURL);
      xhr.upload.onprogress = (e) =>
        e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    });
    setProgress(null);
    if (!ok) return setError("The upload didn't finish. Check your connection and try again.");
    setV((cur) => ({ ...cur, videoAssetId: startRes.videoAssetId, videoFileName: file.name }));
    const s = await refreshVideoStatus(slug, startRes.videoAssetId);
    setUploadNote(
      s.status === "ready"
        ? "Uploaded and ready."
        : "Uploaded. Cloudflare is processing it; it'll play in a minute or two.",
    );
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const payload = {
          name: v.name,
          muscles: v.muscles,
          family: v.family,
          equipment: v.equipment,
          movement: v.movement,
          tags: v.tags,
          cues: v.cues,
          competitionLift: v.competitionLift,
          videoUrl: mode === "link" ? v.videoUrl : "",
          videoAssetId: mode === "upload" ? v.videoAssetId : null,
        };
        start(async () => {
          const r = exerciseId
            ? await updateExercise(slug, exerciseId, payload)
            : await createExercise(slug, payload);
          if (!r.ok) return setError(r.error);
          router.push(`/${slug}/exercises/${r.id}`);
          router.refresh();
        });
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field className="sm:col-span-2" label="Name" required maxLength={120} {...bind("name")} />
        <Field
          label="Muscle group"
          list="ex-muscles"
          placeholder="e.g. Biceps"
          hint="Separate several with commas."
          {...bind("muscles")}
        />
        <Field
          label="Lift family"
          list="ex-families"
          placeholder="e.g. Arms / Squat / Bench"
          {...bind("family")}
        />
        <Field
          label="Equipment"
          list="ex-equipment"
          placeholder="e.g. Dumbbell"
          {...bind("equipment")}
        />
        <Field
          label="Movement type"
          list="ex-movements"
          placeholder="e.g. Isolation / Compound"
          {...bind("movement")}
        />
        <Field
          className="sm:col-span-2"
          label="Tags (comma separated)"
          placeholder="biceps, arms, curl"
          hint="Used for search. Add “sbd” for competition lifts."
          {...bind("tags")}
        />
        <label className="flex items-center gap-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={v.competitionLift}
            onChange={(e) => setV({ ...v, competitionLift: e.target.checked })}
            className="accent-primary size-4"
          />
          Competition lift (squat, bench or deadlift): loads follow the SBD unit setting
        </label>
        <TextAreaField
          className="sm:col-span-2"
          label="Coach cues / notes"
          maxLength={4000}
          {...bind("cues")}
        />
      </div>
      <datalist id="ex-muscles">
        {MUSCLE_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="ex-families">
        {FAMILY_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="ex-equipment">
        {EQUIPMENT_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <datalist id="ex-movements">
        {MOVEMENT_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <fieldset className="flex flex-col gap-4">
        <legend className={`${labelTextClass} mb-3`}>Demo video</legend>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Video">
          {(
            [
              ["none", "No video"],
              ["link", "Paste a link"],
              ["upload", "Upload a file"],
            ] as const
          ).map(([m, label]) => (
            <label
              key={m}
              className={`font-heading cursor-pointer border px-4 py-2 text-xs font-semibold tracking-[0.15em] uppercase ${
                mode === m ? "border-primary text-primary" : "border-border text-subtle"
              }`}
            >
              <input
                type="radio"
                name="videoMode"
                className="sr-only"
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              {label}
            </label>
          ))}
        </div>

        {mode === "link" && (
          <Field
            label="Video link"
            type="url"
            placeholder="https://drive.google.com/… or https://youtu.be/…"
            hint={
              link
                ? link.kind === "other"
                  ? "This will show as a link that opens in a new tab."
                  : `${VIDEO_KIND_LABELS[link.kind]} video: it will play right on the page.${link.kind === "drive" ? " Set its sharing to “Anyone with the link”." : ""}`
                : "YouTube, Vimeo and Google Drive links play on the page; other links open in a new tab."
            }
            {...bind("videoUrl")}
          />
        )}

        {mode === "upload" &&
          (uploadsEnabled ? (
            <div className="flex flex-col gap-2">
              {v.videoAssetId && (
                <p className="text-sm">
                  Current video:{" "}
                  <span className="text-subtle">{v.videoFileName ?? "uploaded video"}</span>
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                disabled={progress !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
                className={`${inputClass} text-subtle text-sm`}
              />
              <p className="text-muted text-xs">MP4 or MOV, up to 200 MB and 10 minutes.</p>
              {progress !== null && (
                <div
                  className="border-border h-2 w-full border"
                  aria-label={`Uploading ${progress}%`}
                >
                  <div
                    className="bg-primary h-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
              {uploadNote && <p className="text-success text-sm">{uploadNote}</p>}
            </div>
          ) : (
            <p className="text-subtle text-sm">
              Uploading needs Cloudflare Stream, which isn&apos;t set up yet (see the README). For
              now, paste a YouTube, Vimeo or Google Drive link.
            </p>
          ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending || progress !== null}>
          {pending ? "Saving…" : exerciseId ? "Save" : "Add to library"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
