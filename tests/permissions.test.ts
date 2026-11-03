import { describe, expect, it } from "vitest";
import { can, invitableRoles, parseRoles } from "@/server/auth/permissions";

describe("parseRoles", () => {
  it("splits Better Auth's comma-separated roles and drops unknown ones", () => {
    expect(parseRoles("manager,trainer")).toEqual(["manager", "trainer"]);
    expect(parseRoles(" admin , owner ")).toEqual(["admin"]);
    expect(parseRoles(null)).toEqual([]);
  });
});

describe("can()", () => {
  it("lets administrators do everything", () => {
    expect(can(["admin"], { billing: ["manage"], settings: ["update"] })).toBe(true);
  });

  it("lets managers see all athletes and invite, but not bill or remove people", () => {
    expect(can(["manager"], { athlete: ["view_all", "assign_trainer"] })).toBe(true);
    expect(can(["manager"], { invitation: ["create"] })).toBe(true);
    expect(can(["manager"], { billing: ["manage"] })).toBe(false);
    expect(can(["manager"], { member: ["delete"] })).toBe(false);
    expect(can(["manager"], { settings: ["update"] })).toBe(false);
  });

  it("keeps trainers to their own athletes", () => {
    expect(can(["trainer"], { athlete: ["view_all"] })).toBe(false);
    expect(can(["trainer"], { program: ["create", "assign"] })).toBe(true);
  });

  it("combines roles: manager + trainer gets both", () => {
    expect(can(["manager", "trainer"], { athlete: ["view_all"] })).toBe(true);
    expect(can(["manager", "trainer"], { program: ["assign"] })).toBe(true);
  });

  it("gives athletes almost nothing", () => {
    expect(can(["athlete"], { program: ["create"] })).toBe(false);
    expect(can(["athlete"], { exercise: ["create"] })).toBe(false);
    expect(can([], { athlete: ["read"] })).toBe(false);
  });
});

describe("invitableRoles()", () => {
  it("lets managers invite trainers and athletes only", () => {
    expect(invitableRoles(["manager"])).toEqual(["trainer", "athlete"]);
  });
  it("lets trainers invite athletes only", () => {
    expect(invitableRoles(["trainer"])).toEqual(["athlete"]);
  });
  it("lets admins invite anyone", () => {
    expect(invitableRoles(["admin"])).toEqual(["admin", "manager", "trainer", "athlete"]);
  });
});
