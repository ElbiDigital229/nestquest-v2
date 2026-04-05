/**
 * Application error classes.
 *
 * Throw these anywhere in the server — the global error handler in index.ts
 * reads `.status` and returns the right HTTP code automatically.
 *
 * Usage:
 *   throw new NotFoundError("Booking not found");
 *   throw new ForbiddenError();
 *   throw new ValidationError("Invalid input", { checkIn: ["Must be a future date"] });
 */

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/** 400 — malformed request or failed validation */
export class ValidationError extends AppError {
  public readonly details?: Record<string, string[]>;

  constructor(message: string, details?: Record<string, string[]>) {
    super(message, 400);
    this.details = details;
  }
}

/** 401 — not authenticated */
export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
  }
}

/** 403 — authenticated but not allowed */
export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403);
  }
}

/** 404 — resource does not exist */
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404);
  }
}

/** 409 — state conflict (duplicate, already exists, wrong status) */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

/** 422 — request understood but business rule violated */
export class UnprocessableError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

/** 429 — too many requests */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests") {
    super(message, 429);
  }
}
