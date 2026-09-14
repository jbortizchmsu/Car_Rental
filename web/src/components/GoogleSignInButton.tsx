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

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response: { credential: string }) => {
          onIdTokenRef.current(response.credential);
        },
      });

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
