import type { Reservation } from '../api/types';
import { buildGateRegistrationReport } from './print';

/** Reprint the registration roster unchanged, using the guard department heading. */
export function buildGuardAdmissionReport(rows: Reservation[], date: string): string {
  return buildGateRegistrationReport(rows, date, true);
}
