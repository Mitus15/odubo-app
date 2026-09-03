/**
 * Typed fetch for the Release surface.
 *
 * `Response.json()` is `unknown` under this TypeScript config, so every call
 * site would otherwise cast. One helper instead — and it gives the error
 * shape one place to live: the API routes always answer failures with
 * `{ error: string }`, so that is what surfaces to the user rather than a
 * bare status code.
 */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body — fall through to the status */
  }
  if (!res.ok) {
    const message =
      (body as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return body as T;
}

/** POST/PATCH/PUT JSON in one line. */
export function apiSend<T>(
  input: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown
): Promise<T> {
  return apiFetch<T>(input, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
