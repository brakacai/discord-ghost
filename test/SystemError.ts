/**
 **
 * Basic implementation of https://nodejs.org/api/errors.html#errors_class_systemerror
 */
export class SystemError extends Error {
  public code?: string;
  public constructor(name?: string, code?: string) {
    super(name);
    this.code = code;
  }
}
