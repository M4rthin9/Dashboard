export class ApiError extends Error {
  status: string;
  constructor(message: string, status = 'error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class AuthExpiredError extends ApiError {
  constructor() {
    super('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    this.name = 'AuthExpiredError';
  }
}
