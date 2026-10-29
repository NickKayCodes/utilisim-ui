/**
 * Thin fetch wrapper around the verified API.
 *
 * - Attaches the bearer token when present.
 * - Normalises Spring's `{error, message}` error bodies into `ApiError`.
 * - Treats a 204 as `undefined`.
 * - Clears the session and notifies the auth provider on a 401.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
}

const TOKEN_KEY = 'utilisim.token';
const USER_KEY = 'utilisim.user';

/* ------------------------------------------------------------- session */

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function readSession(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionUser>;
    if (typeof parsed?.id === 'string' && typeof parsed?.email === 'string') {
      return {
        id: parsed.id,
        username: typeof parsed.username === 'string' ? parsed.username : parsed.email,
        email: parsed.email,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSession(user: SessionUser, token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* storage can be disabled; the in-memory session still works for this tab */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

type UnauthorizedHandler = (() => void) | null;

let unauthorizedHandler: UnauthorizedHandler = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

/* --------------------------------------------------------------- client */

const env = import.meta.env as Record<string, string | undefined>;
const API_BASE = (env.PUBLIC_API_BASE ?? '').replace(/\/+$/, '');

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Send the token. Defaults to true. */
  auth?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = readToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the UtiliSim API. Is the backend running on port 8080?');
  }

  if (response.status === 401 && auth) {
    clearSession();
    unauthorizedHandler?.();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(payload, response));
  }

  return payload as T;
}

function extractMessage(payload: unknown, response: Response): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
    if (typeof record.error === 'string' && record.error.trim()) return record.error;
  }
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (response.statusText) return `${response.status} ${response.statusText}`;
  return `Request failed (${response.status})`;
}

/** Safe, human-readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
