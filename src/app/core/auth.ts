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
export function rolesForPerson(id: string): Role[] {
  return ["employee", "evaluator", ...(managerGrants[id] ?? [])];
}
export function homeForRole(role: Role, personId: string) {
  if (role === "evaluator") return "/evaluations/inbox";
  if (role === "employee") return `/people/${personId}`;
  if (role === "owner") return "/jobs";
  if (role === "manager") return "/dashboard/unit";
  if (role === "executive") return "/dashboard/executive";
  return "/dashboard/hr";
}
