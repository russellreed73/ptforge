"use client";

import { useId, useMemo, useRef, useState } from "react";

export type PickerItem = {
  id: string;
  name: string;
  muscles: string[];
  family: string | null;
  tags: string[];
  competition: boolean;
  hasVideo: boolean;
};

export function searchLibrary(library: PickerItem[], q: string, limit = 8): PickerItem[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { e: PickerItem; score: number }[] = [];
  for (const e of library) {
    const name = e.name.toLowerCase();
    const hay = [name, e.family ?? "", ...e.muscles, ...e.tags].join(" ").toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    const score = name.startsWith(words[0]) ? 0 : name.includes(words[0]) ? 1 : 2;
    scored.push({ e, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map((s) => s.e);
}

/**
 * Type to search the exercise library (name, muscle, family or tag) and pick
 * one; its video and details come with it, like Jacob's Builder. Typing a
 * name that isn't in the library is allowed (no video).
 */
export function ExercisePicker({
  library,
  name,
  exerciseId,
  onChange,
  placeholder = "Search the library…",
  className = "",
  ariaLabel,
  autoFocus,
}: {
  library: PickerItem[];
  name: string;
  exerciseId: string | null;
  onChange: (next: { name: string; exerciseId: string | null }) => void;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matches = useMemo(() => searchLibrary(library, name), [library, name]);
  const exact = exerciseId ? library.find((e) => e.id === exerciseId) : undefined;
  const showList = open && matches.length > 0 && !(exact && exact.name === name);

  const choose = (e: PickerItem) => {
    onChange({ name: e.name, exerciseId: e.id });
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoFocus={autoFocus}
        value={name}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          // Typing changes the exercise; it's linked again when picked from the list.
          const same = library.find((x) => x.name.toLowerCase() === v.trim().toLowerCase());
          onChange({ name: v, exerciseId: same?.id ?? null });
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="border-border bg-background text-foreground placeholder:text-muted focus:border-primary w-full border px-3 py-2 text-sm font-semibold focus:outline-none"
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="border-border bg-surface absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto border shadow-xl"
        >
          {matches.map((e, i) => (
            <li
              key={e.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(ev) => {
                ev.preventDefault();
                if (blurTimer.current) clearTimeout(blurTimer.current);
                choose(e);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm ${
                i === active ? "bg-background" : ""
              }`}
            >
              <span>
                <span className="font-semibold">{e.name}</span>
                <span className="text-muted ml-2 text-xs">
                  {[e.muscles.join(", "), e.family].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="flex shrink-0 gap-1.5 text-[0.65rem] font-semibold tracking-[0.12em] uppercase">
                {e.competition && <span className="text-primary">SBD</span>}
                {e.hasVideo && <span className="text-accent">▶</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
