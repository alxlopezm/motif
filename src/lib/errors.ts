/** An expected, user-presentable failure (permission, state conflict, validation). */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}
