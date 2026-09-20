import { useEffect, useRef } from 'react';

/**
 * True only for the FIRST loading cycle a component instance ever sees. Once `loading`
 * has gone false one time, this permanently returns false from then on — even if
 * `loading` becomes true again later (e.g. a background refetch triggered by
 * useNotificationRefresh). This is what lets a page show a skeleton on first mount
 * only, never on a live refetch, without any change to the fetch function or the
 * `loading` state itself — purely a derived read of that same state.
 */
export function useInitialLoad(loading: boolean): boolean {
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    if (!loading) {
      hasLoadedOnceRef.current = true;
    }
  }, [loading]);

  return loading && !hasLoadedOnceRef.current;
}
