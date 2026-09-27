import React, { useEffect, useRef } from 'react';

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
  const buttonRef = useRef<HTMLDivElement>(null);
  const onIdTokenRef = useRef(onIdToken);
  onIdTokenRef.current = onIdToken;

  useEffect(() => {
    if (!CLIENT_ID || disabled) return;

    let cancelled = false;
    let attempts = 0;

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

      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          width: 384,
          text: 'signin_with',
        });
      }
    };

    tryInit();
    return () => { cancelled = true; };
  }, [disabled]);

  if (!CLIENT_ID) return null;

  return <div ref={buttonRef} style={{ display: 'flex', justifyContent: 'center' }} />;
};

export default GoogleSignInButton;
