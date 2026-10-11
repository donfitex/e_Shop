// An error whose message is safe to show to the customer when `expose` is true (default for 4xx).
export class HttpError extends Error {
  constructor(status, message, code = "bad_request", expose = status < 500) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = expose;
  }
}
