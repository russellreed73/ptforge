import { describe, expect, it } from "vitest";
import { describeRoles, validateRoleSet } from "@/lib/roles";

describe("validateRoleSet()", () => {
  it("accepts staff combinations", () => {
    expect(validateRoleSet(["manager", "trainer"])).toBeNull();
    expect(validateRoleSet(["admin"])).toBeNull();
    expect(validateRoleSet(["athlete"])).toBeNull();
  });
  it("rejects empty, unknown and athlete-plus-staff sets", () => {
    expect(validateRoleSet([])).toMatch(/at least one/);
    expect(validateRoleSet(["owner"])).toMatch(/Unknown/);
    expect(validateRoleSet(["athlete", "trainer"])).toMatch(/athlete/);
  });
});

describe("describeRoles()", () => {
  it("joins labels", () => {
    expect(describeRoles(["manager", "trainer"])).toBe("Manager + Trainer");
  });
});
