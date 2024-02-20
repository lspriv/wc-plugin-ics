/**
 * An error that occurred during parsing.
 */
export class ICalError extends Error {
  constructor(message?: string) {
    super(message);
    message && (this.message = message);
    this.name = 'ICalError';
  }
}
