import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from './api';

interface ResourceState<T> {
  /** The `version` this state was produced for. `-1` means "never loaded". */
  version: number;
  data: T | null;
  error: string | null;
}

export interface ApiResource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Minimal data loader. Pass a stable `loader` (wrap it in `useCallback`).
 *
 * Loading is derived rather than set inside the effect, so a `reload()` flips
 * straight back to a loading state without an extra render cascade.
 */
export function useApiResource<T>(loader: () => Promise<T>): ApiResource<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({
    version: -1,
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    loader()
      .then((data) => {
        if (!cancelled) setState({ version, data, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ version, data: null, error: errorMessage(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [loader, version]);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return {
    data: state.data,
    error: state.error,
    loading: state.version !== version,
    reload,
  };
}
