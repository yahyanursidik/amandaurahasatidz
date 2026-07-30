export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST", details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource tidak ditemukan.", details?: Record<string, unknown>) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Autentikasi diperlukan.", details?: Record<string, unknown>) {
    super(message, 401, "UNAUTHENTICATED", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Anda tidak memiliki akses.", details?: Record<string, unknown>) {
    super(message, 403, "FORBIDDEN", details);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Data input tidak valid.", details?: Record<string, unknown>) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Terjadi konflik status data.", details?: Record<string, unknown>) {
    super(message, 409, "CONFLICT", details);
  }
}
