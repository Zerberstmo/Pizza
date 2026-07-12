import { useCallback, useEffect, useRef, useState } from "react";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasData = useRef(false);
  const run = useCallback(() => {
    let active = true;
    // Ladeanzeige nur beim ersten Laden; bei reload (z.B. Realtime) alte Daten sichtbar lassen (kein Flackern).
    if (!hasData.current) setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (active) {
          hasData.current = true;
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e as Error);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => run(), [run]);
  return { data, loading, error, reload: run };
}
