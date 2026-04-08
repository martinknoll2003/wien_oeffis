export type UpstreamStatus = 404 | 502 | 504;

export class UpstreamServiceError extends Error {
  constructor(
    message: string,
    readonly status: UpstreamStatus = 502,
    readonly code = 'UPSTREAM_ERROR',
  ) {
    super(message);
    this.name = 'UpstreamServiceError';
  }
}
