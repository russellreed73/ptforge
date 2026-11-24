"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Button,
  ErrorText,
  inputClass,
  labelTextClass,
  Pill,
  SuccessText,
  TextButton,
} from "@/components/ui";
import {
  MAX_WEEKS,
  PROGRAM_STATUS_LABELS,
  fitWeeks,
  type ProgramContent,
  type ProgramDay,
  type ProgramExercise,
  type ProgramSet,
  type ProgramStatus,
} from "@/lib/programs";
import {
  assignProgram,
  saveAsTemplate,
  saveProgram,
  type ProgramActionResult,
} from "@/app/[tenant]/(app)/programs/actions";
import { ExercisePicker, searchLibrary, type PickerItem } from "./exercise-picker";

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

const small =
  "border-border bg-background text-foreground placeholder:text-muted focus:border-primary border px-2 py-1.5 text-sm focus:outline-none";

export type BuilderProgram = {
  id: string;
  name: string;
  goals: string;
  weeks: number;
  startDate: string;
  status: ProgramStatus;
  content: ProgramContent;
  isTemplate: boolean;
};

/** Jacob's Builder tab: build a block of days, warm-ups, exercises and sets. */
export function ProgramBuilder({
  slug,
  program,
  library,
  backHref,
  previewHref,
  canAssign,
}: {
  slug: string;
  program: BuilderProgram;
  library: PickerItem[];
  backHref: string;
  previewHref: string | null;
  canAssign: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(program.name);
  const [goals, setGoals] = useState(program.goals);
  const [weeks, setWeeks] = useState(program.weeks);
  const [startDate, setStartDate] = useState(program.startDate);
  const [content, setContent] = useState<ProgramContent>(() =>
    fitWeeks(program.content, program.weeks),
  );
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<ProgramActionResult | null>(null);
  const [pending, start] = useTransition();
  const libById = useMemo(() => new Map(library.map((e) => [e.id, e])), [library]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (fn: (c: ProgramContent) => ProgramContent) => {
    setContent((c) => fn(c));
    setDirty(true);
    setResult(null);
  };
  const updateDay = (di: number, fn: (d: ProgramDay) => ProgramDay) =>
    update((c) => ({ days: c.days.map((d, i) => (i === di ? fn(d) : d)) }));
  const updateExercise = (di: number, ei: number, fn: (e: ProgramExercise) => ProgramExercise) =>
    updateDay(di, (d) => ({ ...d, exercises: d.exercises.map((e, i) => (i === ei ? fn(e) : e)) }));
  const updateSet = (di: number, ei: number, si: number, fn: (s: ProgramSet) => ProgramSet) =>
    updateExercise(di, ei, (e) => ({ ...e, sets: e.sets.map((s, i) => (i === si ? fn(s) : s)) }));

  const blankSet = (): ProgramSet => ({
    id: newId(),
    reps: "",
    rpe: Array.from({ length: weeks }, () => ""),
    backdownPct: null,
  });
  const copyDay = (d: ProgramDay): ProgramDay => ({
    ...d,
    id: newId(),
    title: `${d.title} (copy)`,
    warmups: d.warmups.map((w) => ({ ...w, id: newId() })),
    exercises: d.exercises.map((e) => ({
      ...e,
      id: newId(),
      sets: e.sets.map((s) => ({ ...s, id: newId() })),
    })),
  });

  const details = { name, goals, weeks, startDate };
  const save = (then?: () => Promise<ProgramActionResult>) =>
    start(async () => {
      const r = await saveProgram(slug, program.id, { details, content });
      if (!r.ok) return setResult(r);
      setDirty(false);
      const r2 = then ? await then() : r;
      setResult(r2);
      router.refresh();
    });

  const editable = program.status !== "archived";

  return (
    <div className="flex flex-col gap-6 pb-28">
      <section className="border-border bg-surface grid gap-5 border p-5 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className={labelTextClass}>
            {program.isTemplate ? "Template name" : "Block name"}
          </span>
          <input
            className={inputClass}
            value={name}
            maxLength={80}
            placeholder="e.g. Y1M2"
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className={labelTextClass}>Weeks</span>
          <select
            className={inputClass}
            value={weeks}
            onChange={(e) => {
              const w = Number(e.target.value);
              setWeeks(w);
              update((c) => fitWeeks(c, w));
            }}
          >
            {Array.from({ length: MAX_WEEKS }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {w} week{w === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
        {!program.isTemplate ? (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className={labelTextClass}>Start date</span>
            <input
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDirty(true);
              }}
            />
          </label>
        ) : (
          <div />
        )}
        <label className="flex flex-col gap-1.5 text-sm sm:col-span-3">
          <span className={labelTextClass}>Goals for this block</span>
          <textarea
            className={`${inputClass} resize-y`}
            rows={2}
            maxLength={1000}
            value={goals}
            placeholder="e.g. Keep building work capacity · work around the knee · build SBD strength"
            onChange={(e) => {
              setGoals(e.target.value);
              setDirty(true);
            }}
          />
        </label>
      </section>

      {content.days.map((day, di) => (
        <section
          key={day.id}
          className="border-border bg-surface border p-5"
          aria-label={day.title}
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label={`Day ${di + 1} title`}
              className={`${inputClass} font-heading min-w-0 flex-1 py-2 font-semibold tracking-[0.08em] uppercase`}
              value={day.title}
              maxLength={120}
              onChange={(e) => updateDay(di, (d) => ({ ...d, title: e.target.value }))}
            />
            <TextButton
              aria-label="Move day up"
              disabled={di === 0}
              onClick={() => update((c) => ({ days: move(c.days, di, di - 1) }))}
            >
              ↑
            </TextButton>
            <TextButton
              aria-label="Move day down"
              disabled={di === content.days.length - 1}
              onClick={() => update((c) => ({ days: move(c.days, di, di + 1) }))}
            >
              ↓
            </TextButton>
            <TextButton
              onClick={() =>
                update((c) => ({
                  days: [...c.days.slice(0, di + 1), copyDay(day), ...c.days.slice(di + 1)],
                }))
              }
            >
              Duplicate day
            </TextButton>
            <TextButton
              className="hover:text-danger"
              onClick={() => {
                if (day.exercises.length && !confirm(`Delete ${day.title}?`)) return;
                update((c) => ({ days: c.days.filter((_, i) => i !== di) }));
              }}
            >
              Delete
            </TextButton>
          </div>

          <p className={`${labelTextClass} mt-6`}>Pre — warm-up</p>
          <div className="mt-2 flex flex-col gap-2">
            {day.warmups.map((w, wi) => (
              <div key={w.id} className="flex items-start gap-2">
                <ExercisePicker
                  className="flex-1"
                  library={library}
                  name={w.name}
                  exerciseId={w.exerciseId}
                  ariaLabel={`Warm-up ${wi + 1}`}
                  placeholder="Search the library, e.g. hips…"
                  onChange={(v) =>
                    updateDay(di, (d) => ({
                      ...d,
                      warmups: d.warmups.map((x, i) => (i === wi ? { ...x, ...v } : x)),
                    }))
                  }
                />
                <input
                  aria-label={`Warm-up ${wi + 1} dose`}
                  className={`${small} w-24`}
                  placeholder="10e"
                  maxLength={40}
                  value={w.dose}
                  onChange={(e) =>
                    updateDay(di, (d) => ({
                      ...d,
                      warmups: d.warmups.map((x, i) =>
                        i === wi ? { ...x, dose: e.target.value } : x,
                      ),
                    }))
                  }
                />
                <TextButton
                  aria-label={`Remove warm-up ${w.name || wi + 1}`}
                  className="hover:text-danger py-2"
                  onClick={() =>
                    updateDay(di, (d) => ({ ...d, warmups: d.warmups.filter((_, i) => i !== wi) }))
                  }
                >
                  ✕
                </TextButton>
              </div>
            ))}
          </div>
          <TextButton
            className="text-primary mt-1 px-0"
            onClick={() =>
              updateDay(di, (d) => ({
                ...d,
                warmups: [...d.warmups, { id: newId(), exerciseId: null, name: "", dose: "" }],
              }))
            }
          >
            + Warm-up item
          </TextButton>

          <div className="mt-4 flex flex-col gap-4">
            {day.exercises.map((ex, ei) => {
              const lib = ex.exerciseId ? libById.get(ex.exerciseId) : undefined;
              return (
                <div key={ex.id} className="border-border border p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <ExercisePicker
                      className="min-w-[14rem] flex-1"
                      library={library}
                      name={ex.name}
                      exerciseId={ex.exerciseId}
                      ariaLabel={`Exercise ${ei + 1} of ${day.title}`}
                      onChange={(v) => updateExercise(di, ei, (e) => ({ ...e, ...v }))}
                    />
                    {lib?.competition && <Pill tone="primary">SBD</Pill>}
                    <span className="ml-auto flex items-center">
                      <TextButton
                        aria-label="Move exercise up"
                        disabled={ei === 0}
                        onClick={() =>
                          updateDay(di, (d) => ({ ...d, exercises: move(d.exercises, ei, ei - 1) }))
                        }
                      >
                        ↑
                      </TextButton>
                      <TextButton
                        aria-label="Move exercise down"
                        disabled={ei === day.exercises.length - 1}
                        onClick={() =>
                          updateDay(di, (d) => ({ ...d, exercises: move(d.exercises, ei, ei + 1) }))
                        }
                      >
                        ↓
                      </TextButton>
                      <TextButton
                        onClick={() =>
                          updateDay(di, (d) => ({
                            ...d,
                            exercises: [
                              ...d.exercises.slice(0, ei + 1),
                              {
                                ...ex,
                                id: newId(),
                                sets: ex.sets.map((s) => ({ ...s, id: newId() })),
                              },
                              ...d.exercises.slice(ei + 1),
                            ],
                          }))
                        }
                      >
                        Duplicate
                      </TextButton>
                      <TextButton
                        className="hover:text-danger"
                        onClick={() =>
                          updateDay(di, (d) => ({
                            ...d,
                            exercises: d.exercises.filter((_, i) => i !== ei),
                          }))
                        }
                      >
                        Delete
                      </TextButton>
                    </span>
                  </div>
                  <p className={`mt-1.5 text-xs ${lib ? "text-accent" : "text-muted"}`}>
                    {lib
                      ? `${lib.hasVideo ? "▶ Video linked from the library" : "From the library (no video yet)"} · ${[lib.muscles.join(", "), lib.family].filter(Boolean).join(" · ")}`
                      : ex.name
                        ? "Not in the library, so no video. Pick from the list to link it."
                        : "Start typing and pick from the library."}
                  </p>
                  <input
                    aria-label={`Notes for ${ex.name || "exercise"}`}
                    className={`${small} mt-2 w-full`}
                    placeholder="Notes (optional), e.g. 3s eccentric"
                    maxLength={500}
                    value={ex.notes}
                    onChange={(e) =>
                      updateExercise(di, ei, (x) => ({ ...x, notes: e.target.value }))
                    }
                  />
                  <label className="text-subtle mt-2 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="accent-primary size-3.5"
                      checked={ex.showEstimatedLoad}
                      onChange={(e) =>
                        updateExercise(di, ei, (x) => ({
                          ...x,
                          showEstimatedLoad: e.target.checked,
                        }))
                      }
                    />
                    Show estimated load to athlete for this lift (they never see the E1RM behind it)
                  </label>

                  <div className="mt-3 overflow-x-auto">
                    <table className="text-sm">
                      <thead>
                        <tr className="text-muted font-heading text-[0.65rem] tracking-[0.15em] uppercase">
                          <th className="pr-2 pb-1 text-left font-semibold">Set</th>
                          <th className="pr-2 pb-1 text-left font-semibold">Reps</th>
                          {Array.from({ length: weeks }, (_, w) => (
                            <th key={w} className="pr-1 pb-1 text-left font-semibold">
                              W{w + 1} RPE
                            </th>
                          ))}
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {ex.sets.map((s, si) => (
                          <tr key={s.id}>
                            <td className="text-subtle py-1 pr-2 text-xs font-semibold whitespace-nowrap">
                              {si + 1}
                            </td>
                            <td className="py-1 pr-2">
                              <input
                                aria-label={`${ex.name} set ${si + 1} reps`}
                                className={`${small} w-16`}
                                placeholder="5"
                                maxLength={20}
                                value={s.reps}
                                onChange={(e) =>
                                  updateSet(di, ei, si, (x) => ({ ...x, reps: e.target.value }))
                                }
                              />
                            </td>
                            {s.backdownPct !== null ? (
                              <td colSpan={weeks} className="py-1 pr-1">
                                <span className="border-primary text-subtle inline-flex items-center gap-2 border px-2 py-1 text-xs">
                                  Backdown
                                  <input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    max="90"
                                    aria-label={`${ex.name} set ${si + 1} backdown percent`}
                                    className={`${small} w-16 py-0.5`}
                                    value={s.backdownPct}
                                    onChange={(e) =>
                                      updateSet(di, ei, si, (x) => ({
                                        ...x,
                                        backdownPct: Number(e.target.value) || 0,
                                      }))
                                    }
                                  />
                                  % lighter than the set before
                                </span>
                              </td>
                            ) : (
                              s.rpe.map((r, w) => (
                                <td key={w} className="py-1 pr-1">
                                  <input
                                    aria-label={`${ex.name} set ${si + 1} week ${w + 1} RPE`}
                                    className={`${small} w-14 tabular-nums`}
                                    placeholder="7"
                                    maxLength={12}
                                    value={r}
                                    onChange={(e) =>
                                      updateSet(di, ei, si, (x) => ({
                                        ...x,
                                        rpe: x.rpe.map((v, i) => (i === w ? e.target.value : v)),
                                      }))
                                    }
                                  />
                                </td>
                              ))
                            )}
                            <td className="py-1 whitespace-nowrap">
                              <TextButton
                                onClick={() =>
                                  updateExercise(di, ei, (x) => ({
                                    ...x,
                                    sets: [
                                      ...x.sets.slice(0, si + 1),
                                      { ...s, id: newId() },
                                      ...x.sets.slice(si + 1),
                                    ],
                                  }))
                                }
                              >
                                Duplicate
                              </TextButton>
                              <TextButton
                                aria-label={`Delete ${ex.name} set ${si + 1}`}
                                className="hover:text-danger"
                                onClick={() =>
                                  updateExercise(di, ei, (x) => ({
                                    ...x,
                                    sets: x.sets.filter((_, i) => i !== si),
                                  }))
                                }
                              >
                                ✕
                              </TextButton>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1 text-xs"
                      onClick={() =>
                        updateExercise(di, ei, (x) => {
                          const last = [...x.sets].reverse().find((s) => s.backdownPct === null);
                          return {
                            ...x,
                            sets: [...x.sets, last ? { ...last, id: newId() } : blankSet()],
                          };
                        })
                      }
                    >
                      + Set
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1 text-xs"
                      disabled={ex.sets.length === 0}
                      title={ex.sets.length === 0 ? "Add a working set first" : undefined}
                      onClick={() =>
                        updateExercise(di, ei, (x) => ({
                          ...x,
                          sets: [
                            ...x.sets,
                            {
                              ...blankSet(),
                              reps: x.sets[x.sets.length - 1]?.reps ?? "",
                              backdownPct: 8,
                            },
                          ],
                        }))
                      }
                    >
                      + Backdown set
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <AddExercise
            library={library}
            onAdd={(e) =>
              updateDay(di, (d) => ({
                ...d,
                exercises: [
                  ...d.exercises,
                  {
                    id: newId(),
                    exerciseId: e?.id ?? null,
                    name: e?.name ?? "",
                    notes: "",
                    showEstimatedLoad: false,
                    sets: [blankSet()],
                  },
                ],
              }))
            }
          />
        </section>
      ))}

      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            update((c) => ({
              days: [
                ...c.days,
                {
                  id: newId(),
                  title: `Day ${c.days.length + 1}`,
                  notes: "",
                  warmups: [],
                  exercises: [],
                },
              ],
            }))
          }
        >
          + Add day
        </Button>
      </div>

      <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-3">
          <Pill tone={program.status === "active" ? "accent" : "muted"}>
            {program.isTemplate ? "Template" : PROGRAM_STATUS_LABELS[program.status]}
          </Pill>
          {editable && (
            <Button disabled={pending} onClick={() => save()}>
              {pending ? "Saving…" : dirty ? "Save" : "Saved"}
            </Button>
          )}
          {!program.isTemplate && canAssign && program.status !== "active" && editable && (
            <Button
              variant="accent"
              disabled={pending}
              onClick={() => save(() => assignProgram(slug, program.id))}
            >
              Save &amp; assign to client
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              const n = prompt("Template name", program.isTemplate ? `${name} (copy)` : name);
              if (!n) return;
              save(async () => {
                const r = await saveAsTemplate(slug, program.id, n);
                return r.ok ? { ok: true, message: `Saved as template “${n}”.` } : r;
              });
            }}
          >
            {program.isTemplate ? "Duplicate template" : "Save as template"}
          </Button>
          {previewHref && (
            <Link
              href={previewHref}
              className="font-heading text-subtle hover:text-primary text-xs font-semibold tracking-[0.15em] uppercase"
            >
              Preview
            </Link>
          )}
          <Link
            href={backHref}
            className="font-heading text-subtle hover:text-primary text-xs font-semibold tracking-[0.15em] uppercase"
          >
            Done
          </Link>
          <span className="ml-auto">
            {result &&
              (result.ok ? (
                <SuccessText>{result.message}</SuccessText>
              ) : (
                <ErrorText>{result.error}</ErrorText>
              ))}
            {!result && dirty && <span className="text-muted text-sm">Unsaved changes</span>}
          </span>
        </div>
      </div>
    </div>
  );
}

/** "+ Add exercise (from library)": search, then pick. */
function AddExercise({
  library,
  onAdd,
}: {
  library: PickerItem[];
  onAdd: (e: PickerItem | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const matches = useMemo(() => searchLibrary(library, q, 12), [library, q]);
  if (!open)
    return (
      <Button
        type="button"
        variant="secondary"
        className="mt-4 px-4 py-1.5 text-xs"
        onClick={() => setOpen(true)}
      >
        + Add exercise (from library)
      </Button>
    );
  return (
    <div className="border-border bg-background mt-4 border p-3">
      <input
        autoFocus
        aria-label="Search exercises to add"
        className={`${inputClass} w-full`}
        placeholder="Search the library: name, muscle or tag (e.g. biceps)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && matches[0]) {
            e.preventDefault();
            onAdd(matches[0]);
            setQ("");
          }
        }}
      />
      <ul className="mt-2 flex flex-col">
        {matches.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="hover:bg-surface flex w-full items-center justify-between gap-3 px-2 py-2 text-left text-sm"
              onClick={() => {
                onAdd(e);
                setQ("");
              }}
            >
              <span>
                <span className="font-semibold">{e.name}</span>
                <span className="text-muted ml-2 text-xs">
                  {[e.muscles.join(", "), e.family].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="text-[0.65rem] font-semibold tracking-[0.12em] uppercase">
                {e.competition && <span className="text-primary mr-1.5">SBD</span>}
                {e.hasVideo && <span className="text-accent">▶</span>}
              </span>
            </button>
          </li>
        ))}
        {q && matches.length === 0 && (
          <li className="text-muted px-2 py-2 text-sm">No exercises match “{q}”.</li>
        )}
      </ul>
      <div className="mt-2 flex gap-4">
        <TextButton className="px-0" onClick={() => onAdd(null)}>
          Add a blank exercise
        </TextButton>
        <TextButton className="px-0" onClick={() => setOpen(false)}>
          Close
        </TextButton>
      </div>
    </div>
  );
}
