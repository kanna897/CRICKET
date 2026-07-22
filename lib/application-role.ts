export type ApplicationRole = "master_admin" | "organizer";

/** Map legacy administrator roles without ever elevating an organizer. */
export function resolveApplicationRole(role: string | null | undefined): ApplicationRole | null {
  if (role === "organizer") return "organizer";
  if (["admin", "super_admin", "master_admin"].includes(role ?? "")) return "master_admin";
  return null;
}
