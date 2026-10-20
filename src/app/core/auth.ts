import { Role } from "./models";

/** Local presentation-only credentials; no backend authorization or protected secrets. */
export const DEFAULT_PASSWORD = "Royesh1405!";
export const SESSION_KEY = "royesh.session.v1";

/** All employed people can view their own work and assess assignments.
 * Management capabilities are granted only to explicitly designated people. */
const managerGrants: Record<string, Role[]> = {
  p1: ["hr"],
  p2: ["manager"],
  p11: ["executive", "manager"],
  p12: ["owner"],
};
/** Legacy demo defaults for newly hired people and old LocalStorage snapshots only. */
export const roleOrder: Role[] = ["employee", "evaluator", "hr", "manager", "executive", "owner"];
export function rolesForPerson(id: string): Role[] {
  return ["employee", "evaluator", ...(managerGrants[id] ?? [])];
}
/** A stored list is authoritative even if a legacy default has since been removed. */
export function normalizeRoleAssignments(
  people: {id:string}[], stored?: Record<string,unknown> | null,
): Record<string,Role[]> {
  const result: Record<string,Role[]> = Object.create(null);
  for (const person of people) {
    const fromStorage = stored && Object.prototype.hasOwnProperty.call(stored, person.id)
      ? stored[person.id] : undefined;
    const list = Array.isArray(fromStorage)
      ? [...new Set(fromStorage.filter((role): role is Role => roleOrder.includes(role as Role)))]
      : rolesForPerson(person.id);
    result[person.id] = list.length ? roleOrder.filter(role => list.includes(role)) : ["employee"];
  }
  // A migrated or corrupted snapshot cannot strand the system without an HR administrator.
  if (people.length && !Object.values(result).some(roles => roles.includes("hr"))) {
    const recovery = people.find(person => person.id === "p1") ?? people[0];
    result[recovery.id].push("hr");
  }
  return result;
}
export function homeForRole(role: Role, personId: string) {
  if (role === "evaluator") return "/evaluations/inbox";
  if (role === "employee") return `/people/${personId}`;
  if (role === "owner") return "/jobs";
  if (role === "manager") return "/dashboard/unit";
  if (role === "executive") return "/dashboard/executive";
  return "/dashboard/hr";
}
