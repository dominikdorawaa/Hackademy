import { useEffect, useState } from 'react';
import type { ApiResponse } from '../services/http';

export function useApiResource<T>(
  load: (signal: AbortSignal) => Promise<ApiResponse<T>>,
  onUnauthorized: () => void,
  enabled = true,
) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const fetchData = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setState({ data: null, loading: true, error: null });
      try {
        const response = await load(controller.signal);
        if (controller.signal.aborted) return;
        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }
        if (!response.ok) {
          setState({
            data: null,
            loading: false,
            error:
              response.status === 404
                ? 'Nie znaleziono użytkownika.'
                : 'Nie udało się pobrać danych.',
          });
          return;
        }
        const data = await response.json();
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      } catch {
        if (!controller.signal.aborted)
          setState({ data: null, loading: false, error: 'Nie udało się połączyć z serwerem.' });
      }
    };
    void fetchData();
    return () => controller.abort();
  }, [load, onUnauthorized, enabled, revision]);

  return { ...state, retry: () => setRevision((value) => value + 1) };
}
