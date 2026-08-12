export interface AuthUser {
  username: string;
  role: string;
  displayName: string;
}

export type SlipVerifyStatus = 'ok' | 'mismatch' | 'slip_verify' | 'unreadable';

/** Result of scanning + parsing the slip QR against the booking. */
export interface SlipVerifyResult {
  status: SlipVerifyStatus;
  kind: 'paymentQr' | 'slipVerify' | 'trueMoneySlipVerify' | 'none';
  qrCount: number;
  at: string;
  detail?: Record<string, unknown> | null;
  match?: Record<string, unknown> | null;
  mismatch?: string[];
}

export interface LoginResponse {
  status: string;
  user: AuthUser;
  mustChangePassword: boolean;
  accessToken: string;
  refreshToken: string;
}

export interface Prisoner {
  prisonerId: string;
  prisonerName: string;
  wing: string;
  status: string;
  vinaiDate: string;
  note: string;
}

export interface Reservation {
  [key: string]: unknown;
  ref: string;
  timestamp?: string;
  visitorName?: string;
  visitorId?: string;
  visitorPhone?: string;
  relation?: string;
  religion?: string;
  allergy?: string;
  extraVisitorReligions?: string;
  extraVisitorAllergies?: string;
  extraVisitorNames?: string;
  visitorApproved?: string;
  extraVisitorApproved?: string;
  prisonerName?: string;
  prisonerId?: string;
  wing?: string;
  visitDate?: string;
  visitDateISO?: string;
  visitorCount?: number;
  totalPersons?: number;
  total?: number;
  adultCount?: number;
  child5to8Count?: number;
  childUnder5Count?: number;
  status?: string;
  slipImage?: string;
  slip_verify_status?: string;
  slip_verify_json?: string;
  slip_verify_at?: string;
  cancelReason?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  createdBy?: string;
  source?: string;
  _archived?: boolean;
}

export interface RolePermission {
  roleName: string;
  permissions: string[];
}

export interface EventLog {
  timestamp: string;
  username: string;
  action: string;
  targetRef: string;
  details: string;
  result: string;
  ip: string;
  userAgent: string;
}

export interface ApiResult {
  status: string;
  [key: string]: unknown;
}

export interface Paginated<T> {
  status: string;
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PublicUser {
  username: string;
  role: string;
  displayName: string;
  createdAt: string;
}
