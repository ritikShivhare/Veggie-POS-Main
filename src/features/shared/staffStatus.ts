import type { StaffMember } from './types';

/** Older rows omitted status; preserve their active/default behavior. */
export function isActiveStaff(staff: Pick<StaffMember, 'status'>): boolean {
  return staff.status == null || (typeof staff.status === 'string' && staff.status.toLowerCase() === 'active');
}
export function countActiveStaff(staff: Pick<StaffMember, 'status'>[] = []): number {
  return staff.filter(isActiveStaff).length;
}
