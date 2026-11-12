"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ButtonLink, ErrorText, SuccessText } from "@/components/ui";
import {
  copyStarterExercise,
  setExerciseArchived,
  setShowStarterExercises,
  type ExerciseActionResult,
} from "./actions";

/** Edit / copy / archive buttons on an exercise's page. */
export function ExerciseActions({
  slug,
  id,
  isStarter,
  copyId,
  archived,
  canEdit,
  canArchive,
}: {
  slug: string;
  id: string;
  isStarter: boolean;
  copyId: string | null;
  archived: boolean;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ExerciseActionResult | null>(null);
  const base = `/${slug}/exercises`;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-3">
        {isStarter ? (
          copyId ? (
            <ButtonLink href={`${base}/${copyId}`} variant="secondary">
              Open your copy
            </ButtonLink>
          ) : (
            canEdit && (
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await copyStarterExercise(slug, id);
                    setResult(r);
                    if (r.ok) router.push(`${base}/${r.id}/edit`);
                  })
                }
              >
                Copy to customise
              </Button>
            )
          )
        ) : (
          <>
            {canEdit && !archived && <ButtonLink href={`${base}/${id}/edit`}>Edit</ButtonLink>}
            {canArchive && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await setExerciseArchived(slug, id, !archived);
                    setResult(r);
                    if (r.ok) router.refresh();
                  })
                }
              >
                {archived ? "Restore" : "Archive"}
              </Button>
            )}
          </>
        )}
      </div>
      {isStarter && !copyId && canEdit && (
        <p className="text-muted max-w-xs text-xs sm:text-right">
          Starter exercises are shared by every PTForge business. Copy it to change the name, cues
          or video; your copy replaces it in your library.
        </p>
      )}
      {result &&
        (result.ok ? (
          <SuccessText>{result.message}</SuccessText>
        ) : (
          <ErrorText>{result.error}</ErrorText>
        ))}
    </div>
  );
}

/** Administrators: show or hide PTForge's starter exercises. */
export function StarterToggle({ slug, show }: { slug: string; show: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [checked, setChecked] = useState(show);
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setChecked(next);
          start(async () => {
            const r = await setShowStarterExercises(slug, next);
            if (!r.ok) setChecked(!next);
            router.refresh();
          });
        }}
        className="accent-primary size-4"
      />
      Show PTForge starter exercises
    </label>
  );
}
