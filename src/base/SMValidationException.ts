export class SMValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SMValidationException';
  }
}
