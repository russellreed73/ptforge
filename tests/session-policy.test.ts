import { describe, expect, it } from "vitest";
import { isStaff, staffSessionExpired } from "@/server/auth/session-policy";

const now = new Date("2026-11-20T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

describe("session policy", () => {
  it("treats admins, managers and trainers as staff", () => {
    expect(isStaff(["trainer"])).toBe(true);
    expect(isStaff(["athlete"])).toBe(false);
    expect(isStaff([])).toBe(false);
  });

  it("ends a coach's sign-in after 7 days", () => {
    expect(staffSessionExpired(daysAgo(6.9), ["trainer"], now)).toBe(false);
    expect(staffSessionExpired(daysAgo(7.1), ["manager", "trainer"], now)).toBe(true);
  });

  it("leaves athletes signed in (Better Auth's 90 days applies)", () => {
    expect(staffSessionExpired(daysAgo(60), ["athlete"], now)).toBe(false);
  });

  it("counts staff in any business, even if they're an athlete elsewhere", () => {
    expect(staffSessionExpired(daysAgo(8), ["athlete", "trainer"], now)).toBe(true);
  });
});
