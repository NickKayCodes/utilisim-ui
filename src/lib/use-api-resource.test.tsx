import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import { useApiResource } from './use-api-resource';

describe('useApiResource', () => {
  it('loads data and exposes a loading state', async () => {
    const loader = vi.fn().mockResolvedValue({ value: 1 });

    const { result } = renderHook(() => useApiResource(loader));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('captures a human-readable error', async () => {
    const loader = vi.fn().mockRejectedValue(new ApiError(500, 'server down'));

    const { result } = renderHook(() => useApiResource(loader));

    await waitFor(() => expect(result.current.error).toBe('server down'));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('uses the fallback message for unknown errors', async () => {
    const loader = vi.fn().mockRejectedValue('nope');

    const { result } = renderHook(() => useApiResource(loader));

    await waitFor(() =>
      expect(result.current.error).toBe('Something went wrong. Please try again.'),
    );
  });

  it('reloads when requested', async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce({ value: 1 })
      .mockResolvedValueOnce({ value: 2 });

    const { result } = renderHook(() => useApiResource(loader));
    await waitFor(() => expect(result.current.data).toEqual({ value: 1 }));

    act(() => result.current.reload());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual({ value: 2 }));
    expect(result.current.loading).toBe(false);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('reloads when the loader function changes', async () => {
    const first = vi.fn().mockResolvedValue('first');
    const second = vi.fn().mockResolvedValue('second');

    const { result, rerender } = renderHook(({ loader }) => useApiResource(loader), {
      initialProps: { loader: first },
    });
    await waitFor(() => expect(result.current.data).toBe('first'));

    rerender({ loader: second });

    await waitFor(() => expect(result.current.data).toBe('second'));
    expect(second).toHaveBeenCalledOnce();
  });

  it('does not update after unmount', async () => {
    let resolveLoader: ((value: string) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useApiResource(loader));
    unmount();

    await act(async () => {
      resolveLoader?.('late');
    });

    expect(result.current.data).toBeNull();
  });
});
