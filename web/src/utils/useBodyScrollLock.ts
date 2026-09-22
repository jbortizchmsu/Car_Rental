import { useEffect, useRef } from 'react';

/**
 * Locks background page scroll while a modal is open. Captures whatever
 * document.body.style.overflow already was right before applying the lock, and
 * restores exactly that value on cleanup — not a hardcoded ''. This makes nested/
 * simultaneous modals (e.g. a ConfirmActionModal opened on top of BookingRequestModal)
 * safe without an explicit reference count: the inner modal's lock captures 'hidden'
 * (since the outer one already applied it) and simply restores 'hidden' again when it
 * closes first, leaving the outer modal's own lock intact until it closes too.
 */
export function useBodyScrollLock(isOpen: boolean): void {
  const previousOverflowRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflowRef.current ?? '';
    };
  }, [isOpen]);
}
