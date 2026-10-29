import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  api,
  clearSession,
  errorMessage,
  readSession,
  readToken,
  setUnauthorizedHandler,
  writeSession,
} from './api';

function fakeResponse(status: number, body = '', statusText = ''): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText,
    text: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe('session storage', () => {
  it('writes and reads a session', () => {
    writeSession({ id: 'u1', username: 'user@example.com', email: 'user@example.com' }, 'token-1');

    expect(readToken()).toBe('token-1');
    expect(readSession()).toEqual({
      id: 'u1',
      username: 'user@example.com',
      email: 'user@example.com',
    });
  });

  it('defaults a missing username to the email', () => {
    window.localStorage.setItem(
      'utilisim.user',
      JSON.stringify({ id: 'u1', email: 'user@example.com' }),
    );

    expect(readSession()?.username).toBe('user@example.com');
  });

  it('returns null for missing, malformed or incomplete sessions', () => {
    expect(readSession()).toBeNull();

    window.localStorage.setItem('utilisim.user', '{not json');
    expect(readSession()).toBeNull();

    window.localStorage.setItem('utilisim.user', JSON.stringify({ id: 'u1' }));
    expect(readSession()).toBeNull();

    window.localStorage.setItem('utilisim.user', JSON.stringify({ email: 'a@b.c' }));
    expect(readSession()).toBeNull();
  });

  it('returns null when storage reads throw', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(readToken()).toBeNull();
    expect(readSession()).toBeNull();
    spy.mockRestore();
  });

  it('ignores storage writes and clears that throw', () => {
    const setSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const removeSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() =>
      writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 't'),
    ).not.toThrow();
    expect(() => clearSession()).not.toThrow();

    setSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('clearSession removes both keys', () => {
    writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 't');
    clearSession();

    expect(readToken()).toBeNull();
    expect(readSession()).toBeNull();
  });
});

describe('api', () => {
  it('sends a JSON body and bearer token by default', async () => {
    writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 'secret');
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, '{"ok":true}'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api<{ ok: boolean }>('/api/thing', {
      method: 'POST',
      body: { name: 'x' },
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/thing', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer secret',
      },
      body: JSON.stringify({ name: 'x' }),
    });
  });

  it('omits the token when auth is false and omits content-type without a body', async () => {
    writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 'secret');
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(200, '[]'));
    vi.stubGlobal('fetch', fetchMock);

    await api('/api/thing', { auth: false });

    expect(fetchMock).toHaveBeenCalledWith('/api/thing', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      body: undefined,
    });
  });

  it('returns undefined for 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(204)));

    await expect(api('/api/thing', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('returns raw text when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(200, 'plain')));

    await expect(api('/api/thing')).resolves.toBe('plain');
  });

  it('returns null for an empty successful body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(200, '')));

    await expect(api('/api/thing')).resolves.toBeNull();
  });

  it('wraps network failures in an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(api('/api/thing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
    });
  });

  it('uses the server message for failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fakeResponse(400, '{"error":"Bad Request","message":"bad"}')),
    );

    await expect(api('/api/thing')).rejects.toMatchObject({ status: 400, message: 'bad' });
  });

  it('falls back to the error field, then the raw text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(400, '{"error":"Nope"}'))
      .mockResolvedValueOnce(fakeResponse(400, 'plain failure'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api('/a')).rejects.toThrow('Nope');
    await expect(api('/b')).rejects.toThrow('plain failure');
  });

  it('falls back to status text and then a generic message', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(500, '{}', 'Server Error'))
      .mockResolvedValueOnce(fakeResponse(418, '{}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api('/a')).rejects.toThrow('500 Server Error');
    await expect(api('/b')).rejects.toThrow('Request failed (418)');
  });

  it('clears the session and notifies the handler on 401', async () => {
    writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 'secret');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const fetchMock = vi.fn().mockResolvedValue(fakeResponse(401, '{"message":"nope"}'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api('/api/private')).rejects.toMatchObject({ status: 401, message: 'nope' });

    expect(readToken()).toBeNull();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not clear the session on an unauthenticated 401', async () => {
    writeSession({ id: 'u1', username: 'u', email: 'u@example.com' }, 'secret');
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse(401, '{}')));

    await expect(api('/api/auth/login', { auth: false })).rejects.toBeInstanceOf(ApiError);

    expect(readToken()).toBe('secret');
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('errorMessage', () => {
  it('handles ApiError, Error and unknown values', () => {
    expect(errorMessage(new ApiError(400, 'bad'))).toBe('bad');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('nope')).toBe('Something went wrong. Please try again.');
  });
});
