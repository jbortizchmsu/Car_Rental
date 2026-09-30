import React, { useEffect, useRef } from 'react';

// Google documents only a maximum for GsiButtonConfiguration's `width` (400px,
// https://developers.google.com/identity/gsi/web/reference/js-reference) — no
// minimum is documented. 384 is this app's existing desktop design width (already
// under the 400px ceiling); 200 is a practical floor we chose ourselves (not a
// Google-documented value) to avoid asking Google's own button to lay out its icon
// and label inside something so narrow that its *internal* rendering breaks in a
// way we can't control or predict — see the wrapper's own overflow:hidden below
// for what happens on the rare viewport where even 200px doesn't fit.
const MAX_BUTTON_WIDTH = 384;
const MIN_BUTTON_WIDTH = 200;

declare global {
  interface Window {
    google?: any;
  }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

interface GoogleSignInButtonProps {
  onIdToken: (idToken: string) => void;
  disabled?: boolean;
}

// google.accounts.id.initialize() is a global, one-time registration — it isn't scoped
// to a DOM node or component instance, so calling it more than once per page load is
// exactly what Google's own "initialize() is called multiple times" console warning is
// about. It was previously called inside the effect below, which re-runs on every
// `disabled` toggle (LoginPage passes `disabled={googleLoading}`, which flips during a
// sign-in attempt) and again on every mount — doubled further in dev by React
// StrictMode's mount→cleanup→mount, and multiplied again if more than one
// <GoogleSignInButton> is ever mounted at once. These module-level values make
// initialize() itself run only once per page load, while `activeOnIdToken` is
// repointed at whichever button instance is currently mounted, so the credential still
// reaches the right handler across toggles, unmounts, and remounts.
let googleInitialized = false;
let activeOnIdToken: ((idToken: string) => void) | null = null;

function ensureGoogleInitialized() {
  if (googleInitialized) return;
  googleInitialized = true;
  window.google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (response: { credential: string }) => {
      activeOnIdToken?.(response.credential);
    },
  });
}

/**
 * Renders Google's own GSI button (google.accounts.id.renderButton) rather than a
 * custom-styled one, per Google's branding requirements. Silently renders nothing if
 * VITE_GOOGLE_CLIENT_ID isn't configured or the GSI script hasn't loaded yet — the
 * existing email/password form above/below it is completely unaffected either way.
 */
const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onIdToken, disabled }) => {
  // wrapperRef is measured for available width and carries the overflow safety net;
  // buttonRef is the actual node Google's renderButton draws into. Two nodes, not
  // one, specifically so the safety net (maxWidth/overflow on the outer node) can
  // never itself be wiped out by renderButton's own innerHTML replacement.
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const onIdTokenRef = useRef(onIdToken);
  onIdTokenRef.current = onIdToken;
  // Persists across effect re-runs (e.g. the `disabled` toggle during a sign-in
  // attempt) so a re-run that doesn't actually change the available width is a
  // no-op instead of clearing and re-drawing the button for no visual change.
  const renderedWidthRef = useRef<number | null>(null);

  useEffect(() => {
    if (!CLIENT_ID || disabled) return;

    let cancelled = false;
    let attempts = 0;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    const getTargetWidth = () => {
      const available = wrapperRef.current?.getBoundingClientRect().width;
      if (!available) return MAX_BUTTON_WIDTH;
      return Math.round(Math.min(MAX_BUTTON_WIDTH, Math.max(MIN_BUTTON_WIDTH, available)));
    };

    const renderButtonAtWidth = (width: number) => {
      if (!buttonRef.current || !window.google?.accounts?.id) return;
      if (renderedWidthRef.current === width) return; // already correct — do not duplicate
      renderedWidthRef.current = width;
      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width,
        text: 'signin_with',
      });
    };

    // The GSI script tag is `async defer` (index.html) — it may not have executed yet
    // by the time this component mounts, so poll briefly for window.google to appear
    // rather than assuming it's already there.
    const tryInit = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        attempts += 1;
        if (attempts < 40) setTimeout(tryInit, 250);
        return;
      }

      ensureGoogleInitialized();
      // This instance is now the one whose callback should fire — covers remounts
      // (disabled toggling off then on) and re-renders alike.
      activeOnIdToken = (idToken: string) => onIdTokenRef.current(idToken);

      renderButtonAtWidth(getTargetWidth());

      // Re-measures on any wrapper size change, which already covers window resize,
      // orientation change, and container-driven width changes uniformly (all of
      // them are, from the wrapper's point of view, just "my width changed") — a
      // separate resize/orientationchange window listener would duplicate this and
      // could fire when the wrapper's own width hasn't actually moved (e.g. a
      // purely vertical resize), causing a pointless re-render/flicker.
      if (wrapperRef.current && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (resizeTimeout) clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            if (!cancelled) renderButtonAtWidth(getTargetWidth());
          }, 150);
        });
        resizeObserver.observe(wrapperRef.current);
      }
    };

    tryInit();
    return () => {
      cancelled = true;
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver?.disconnect();
    };
  }, [disabled]);

  if (!CLIENT_ID) return null;

  return (
    <div
      ref={wrapperRef}
      style={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '100%', overflow: 'hidden' }}
    >
      <div ref={buttonRef} />
    </div>
  );
};

export default GoogleSignInButton;
