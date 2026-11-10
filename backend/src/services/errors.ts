export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}
