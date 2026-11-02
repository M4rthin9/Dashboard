import { callAction } from './client';
import type { Reservation } from './types';

export interface AttendanceRecord {
  ref: string;
  visitDateISO: string;
  guestKey: string;
  guestName: string;
  checkedInAt: string;
  checkedInBy: string;
}
export interface EntryCheck {
  reservation: Reservation;
  ref: string;
  visitDateISO: string;
  bookingType: string;
  paymentStatus: string;
  paymentConfirmed: boolean;
  allowed: boolean;
  blockedReason: string;
  guests: {
    guestKey: string; name: string; id: string; relation: string; age: string;
    religion: string; allergy: string; main: boolean; approval: string;
    approved: boolean; attendance: AttendanceRecord | null;
  }[];
}
export interface AttendanceTable {
  ref: string; visitDateISO: string; bookingType: string; visitorName: string; visitorPhone: string;
  prisonerName: string; visitorCount: number; total: number; paymentStatus: string;
  paymentConfirmed: boolean; active: boolean; eligible: boolean; blockedReason: string;
  expectedCount: number; approvedCount: number; checkedInCount: number; remainingCount: number;
  registrationStatus: 'not_registered' | 'partial' | 'registered';
  guests: { guestKey: string; name: string; approved: boolean; checkedInAt: string; checkedInBy: string }[];
}
export const checkVisitorEntry = (qr: string) => callAction<{ status: string; entry: EntryCheck }>('checkVisitorEntry', { qr }, { auth: true });
export const checkInVisitor = (qr: string, guestKey: string) => callAction<{ status: string; entry: EntryCheck; alreadyCheckedIn: boolean }>('checkInVisitor', { qr, guestKey }, { auth: true });
export const getAttendance = (date: string) => callAction<{ status: string; rows: AttendanceRecord[]; tables: AttendanceTable[]; asOf: string }>('getAttendance', { date }, { auth: true });
