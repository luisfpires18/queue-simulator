// Typed fetch wrapper for the app's own /api routes: parses JSON, and on a
// non-2xx throws an ApiClientError carrying the server's `{ error }` string
// (every route responds with that shape). Replaces the hand-rolled
// parse-the-error-body blocks that were copy-pasted across forms/modals.

export class ApiClientError extends Error {
  status: number;
  /** The raw `error` payload - usually a string, but zod validation failures
   * respond with a flattened issues object. */
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : null;
    const message = typeof error === "string" ? error : `Request failed (${res.status})`;
    throw new ApiClientError(message, res.status, error);
  }
  return body as T;
}

/** apiFetch with a JSON body + content-type header. */
export function apiPost<T>(path: string, payload?: unknown, method = "POST"): Promise<T> {
  return apiFetch<T>(path, {
    method,
    ...(payload !== undefined
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }
      : {}),
  });
}
