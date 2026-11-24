import { describe, expect, it, vi } from "vitest";
import {
  backdownFactor,
  fitWeeks,
  formatRpe,
  programContentSchema,
  programDetailsSchema,
  programSummary,
  readProgramContent,
  rpeTarget,
  withNewIds,
  type ProgramContent,
} from "@/lib/programs";
import { searchLibrary } from "@/components/programs/exercise-picker";

vi.mock("server-only", () => ({}));

const block: ProgramContent = {
  days: [
    {
      id: "day0001",
      title: "Day 1 — Squat 1",
      notes: "",
      warmups: [{ id: "warm001", exerciseId: null, name: "Hip CARs", dose: "6e" }],
      exercises: [
        {
          id: "exer001",
          exerciseId: null,
          name: "Competition Squat",
          notes: "",
          showEstimatedLoad: true,
          sets: [
            { id: "set0001", reps: "5", rpe: ["6.5", "7", "7.5", "8"], backdownPct: null },
            { id: "set0002", reps: "5", rpe: ["", "", "", ""], backdownPct: 8 },
          ],
        },
      ],
    },
  ],
};

describe("program content", () => {
  it("accepts Jacob's block shape", () => {
    expect(programContentSchema.safeParse(block).success).toBe(true);
  });

  it.each(["7", "7.5", "6-7", "8.5 - 9", "10", ""])("RPE target %s is valid", (v) => {
    expect(rpeTarget.safeParse(v).success).toBe(true);
  });
  it.each(["11", "7.3", "seven", "0"])("RPE target %s is rejected", (v) => {
    expect(rpeTarget.safeParse(v).success).toBe(false);
  });

  it("resizes RPE targets when the number of weeks changes", () => {
    const six = fitWeeks(block, 6);
    expect(six.days[0].exercises[0].sets[0].rpe).toEqual(["6.5", "7", "7.5", "8", "", ""]);
    const two = fitWeeks(block, 2);
    expect(two.days[0].exercises[0].sets[0].rpe).toEqual(["6.5", "7"]);
  });

  it("gives a copy fresh ids but keeps everything else", () => {
    let n = 0;
    const copy = withNewIds(block, () => `new${++n}xyz`);
    expect(copy.days[0].id).not.toBe(block.days[0].id);
    expect(copy.days[0].exercises[0].sets[1].id).not.toBe("set0002");
    expect(copy.days[0].exercises[0].sets[1].backdownPct).toBe(8);
    expect(copy.days[0].warmups[0].name).toBe("Hip CARs");
  });

  it("never crashes on bad stored JSON", () => {
    expect(readProgramContent({ days: "nope" })).toEqual({ days: [] });
    expect(readProgramContent(null)).toEqual({ days: [] });
  });

  it("formats and summarises", () => {
    expect(backdownFactor(8)).toBe(0.92);
    expect(formatRpe("7-8")).toBe("RPE 7–8");
    expect(formatRpe("")).toBe("");
    expect(programSummary(block, 4)).toBe("1 day · 4 weeks · 1 exercise");
  });

  it("validates block details", () => {
    expect(programDetailsSchema.safeParse({ name: "Y1M2", goals: "", weeks: 4 }).success).toBe(
      true,
    );
    expect(programDetailsSchema.safeParse({ name: "", goals: "", weeks: 4 }).success).toBe(false);
    expect(programDetailsSchema.safeParse({ name: "X", goals: "", weeks: 13 }).success).toBe(false);
  });
});

describe("library search in the builder", () => {
  const lib = [
    {
      id: "1",
      name: "Dumbbell Biceps Curl",
      muscles: ["Biceps"],
      family: "Arms",
      tags: ["biceps", "curl"],
      competition: false,
      hasVideo: false,
    },
    {
      id: "2",
      name: "Hammer Curl",
      muscles: ["Biceps"],
      family: "Arms",
      tags: ["brachialis"],
      competition: false,
      hasVideo: true,
    },
    {
      id: "3",
      name: "Competition Squat",
      muscles: ["Quads"],
      family: "Squat",
      tags: ["sbd"],
      competition: true,
      hasVideo: false,
    },
  ];
  it("finds by name, muscle, family or tag, best name match first", () => {
    expect(searchLibrary(lib, "biceps").map((e) => e.id)).toEqual(["1", "2"]);
    expect(searchLibrary(lib, "ham").map((e) => e.id)).toEqual(["2"]);
    expect(searchLibrary(lib, "sbd").map((e) => e.id)).toEqual(["3"]);
    expect(searchLibrary(lib, "")).toEqual([]);
  });
});

describe("current week of a block", () => {
  it("counts weeks from the start date", async () => {
    const { currentWeek } = await import("@/server/programs/view");
    const today = new Date("2026-11-20T12:00:00");
    expect(currentWeek(null, 4, today)).toBe(1);
    expect(currentWeek("2026-11-25", 4, today)).toBe(1);
    expect(currentWeek("2026-11-14", 4, today)).toBe(1);
    expect(currentWeek("2026-11-13", 4, today)).toBe(2);
    expect(currentWeek("2026-09-01", 4, today)).toBe(4);
  });
});
