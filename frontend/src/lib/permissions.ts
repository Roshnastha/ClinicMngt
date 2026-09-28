/**
 * Role permission map — single source of truth for UI gating.
 *
 * The backend remains the authority (403 on every admin-only route); this
 * map only decides what to hide/disable in the UI so staff never see
 * actions they cannot perform.
 */

export type Role = "ADMIN" | "STAFF";

export type Permission =
  | "therapist.manage" // add / edit / delete therapists
  | "schedule.override" // create per-date schedule overrides
  | "invoice.void" // void invoices (DELETE /billing/invoices/{id})
  | "invoice.payment_details" // edit payment method / discount
  | "patient.delete" // permanently remove patient records
  | "users.manage"; // user administration (future)

const ADMIN_ONLY: Permission[] = [
  "therapist.manage",
  "schedule.override",
  "invoice.void",
  "invoice.payment_details",
  "patient.delete",
  "users.manage",
];

const STAFF_ALLOWED: Permission[] = [];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ADMIN_ONLY, // admins hold every permission
  STAFF: STAFF_ALLOWED,
};

export function can(role: Role | string | undefined | null, permission: Permission): boolean {
  return ROLE_PERMISSIONS[(role as Role) ?? "STAFF"]?.includes(permission) ?? false;
}

/** Convenience hook-free helper for components that already have the user. */
export function permissionsFor(role: Role | string | undefined | null): Permission[] {
  return ROLE_PERMISSIONS[(role as Role) ?? "STAFF"] ?? [];
}
