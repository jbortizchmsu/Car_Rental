import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

// Required once per app so the system browser correctly hands control back to this app
// after the OAuth redirect completes (a no-op on native if called more than once).
WebBrowser.maybeCompleteAuthSession();

// Android-only for now (see this session's inspection report) — created manually in
// Google Cloud Console as an "Android" type OAuth client (package com.jdcarrental.mobile
// + the dev/EAS build's SHA-1 fingerprint). This is NOT the same client ID the backend
// verifies against — it only identifies this app to Google for the on-device sign-in
// handshake. The ID token Google returns still carries the WEB client ID as its
// audience (see webClientId below), which is what POST /api/auth/google verifies —
// identical to web's flow, no backend change needed.
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

// The same web client ID used by the website (VITE_GOOGLE_CLIENT_ID / server's
// GOOGLE_CLIENT_ID) — passed here so Google issues an ID token whose `aud` claim
// matches what the backend already verifies against, unchanged.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** True once both client IDs are configured — until then, Google Sign-In stays hidden
 * on the Login screen rather than rendering a button that would just fail on tap. */
export const isGoogleSignInConfigured = Boolean(ANDROID_CLIENT_ID && WEB_CLIENT_ID);

/**
 * Wraps expo-auth-session's Google provider. NOTE (found via inspection, not assumed):
 * the installed expo-auth-session (57.0.12) marks GoogleAuthRequestConfig/this whole
 * provider module as @deprecated in its own type declarations, pointing to Expo's
 * general "Google authentication" guide rather than this specific helper. It still
 * functions and is what this task explicitly asked for, but a future pass may want to
 * migrate to a plain AuthRequest built against Google's discovery document directly
 * instead of this provider — flagging this now so it isn't mistaken for an oversight
 * later.
 *
 * Must still be called unconditionally (rules of hooks) even when unconfigured — the
 * screen using this decides whether to render a button based on
 * `isGoogleSignInConfigured`, not by conditionally calling this hook.
 */
export function useGoogleIdTokenAuthRequest() {
  return Google.useIdTokenAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId: WEB_CLIENT_ID,
  });
}
