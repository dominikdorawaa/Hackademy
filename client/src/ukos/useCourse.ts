import { useCallback, useEffect, useRef, useState } from "react";
import { courseRequest, type CourseState } from "./api";
import { lessons } from "./content";

function localStep(key: string) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isInteger(value) && value >= 0 && value <= lessons.length
      ? value
      : 0;
  } catch {
    return 0;
  }
}

export function useCourse(account: string, sessionKey: string) {
  const key = `ukos-progress-v1:${account}`;
  const [completed, setCompleted] = useState(() => localStep(key));
  const [state, setState] = useState<CourseState | null>(null);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const liveCompletions = useRef(new Set<number>());
  const desired = useRef(completed);
  const active = useRef(true);
  const pending = useRef<Promise<void> | null>(null);

  const accept = useCallback(
    (next: CourseState) => {
      if (!active.current) return;
      desired.current = Math.max(desired.current, next.completedSteps);
      setCompleted(desired.current);
      setState(next);
      setError("");
      try {
        localStorage.setItem(key, String(desired.current));
        setStorageError("");
        return true;
      } catch {
        setStorageError(
          "Przeglądarka nie pozwala zapisać postępu lokalnie. Nie zamykaj strony przed synchronizacją.",
        );
        return false;
      }
    },
    [key],
  );

  const sync = useCallback((): Promise<void> => {
    if (pending.current) return pending.current;
    setSyncing(true);
    const operation = (async () => {
      try {
        let next = await courseRequest(sessionKey);
        let confirmed: number[] = [];
        if (desired.current > next.completedSteps) {
          const target = desired.current;
          const fresh = [...liveCompletions.current].filter(step => step > next.completedSteps && step <= target);
          next = await courseRequest(sessionKey, target);
          confirmed = fresh.filter(step => step <= next.completedSteps);
        }
        if (accept(next) && confirmed.length > 0) setSuccessCount(count => count + confirmed.length);
        for (const step of liveCompletions.current) {
          if (step <= next.completedSteps) liveCompletions.current.delete(step);
        }
      } catch (failure) {
        liveCompletions.current.clear();
        if (active.current)
          setError(
            failure instanceof Error
              ? failure.message
              : "Brak połączenia. Postęp czeka na synchronizację.",
          );
      } finally {
        pending.current = null;
        if (active.current) setSyncing(false);
      }
    })();
    pending.current = operation;
    return operation;
  }, [sessionKey, accept]);

  useEffect(() => {
    active.current = true;
    void sync();
    const online = () => {
      void sync();
    };
    const visible = () => {
      if (!document.hidden) void sync();
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active.current = false;
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [sync]);

  useEffect(() => {
    if (completed <= (state?.completedSteps ?? -1)) return;
    const timer = setTimeout(() => {
      void sync();
    }, 800);
    return () => clearTimeout(timer);
  }, [completed, state?.completedSteps, sync]);

  const progress = useCallback(
    (step: number, restored = false) => {
      if (
        !Number.isInteger(step) ||
        step < 0 ||
        step > lessons.length ||
        step <= desired.current
      )
        return;
      desired.current = step;
      setCompleted(step);
      try {
        localStorage.setItem(key, String(step));
        setStorageError("");
        if (!restored) liveCompletions.current.add(step);
      } catch {
        setStorageError(
          "Nie udało się zachować lokalnego postępu. Pozostaw stronę otwartą do synchronizacji.",
        );
      }
    },
    [key],
  );

  return {
    state,
    completed,
    error,
    storageError,
    syncing,
    successCount,
    progress,
    sync,
    synchronized: state !== null && completed <= state.completedSteps && !error,
  };
}
