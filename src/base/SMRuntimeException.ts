
export class SMRuntimeException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SMRuntimeException';
  }
}
