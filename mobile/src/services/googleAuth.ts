import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';

// The same web-type OAuth client used by the website (VITE_GOOGLE_CLIENT_ID / server's
// GOOGLE_CLIENT_ID). Passed to GoogleSignin.configure() as `webClientId` so the ID
// token this library returns is audienced to that same client — exactly what
// POST /api/auth/google already verifies against. No backend change needed.
//
// Note what's deliberately NOT here: the Android-type OAuth client (package
// com.jdcarrental.mobile + SHA-1, already created in Google Cloud Console) is never
// referenced anywhere in this file, or passed as any parameter at all. That's by
// design — Android-type clients aren't used via a client_id-style parameter the way
// expo-auth-session's browser-redirect flow (the previous, now-removed approach)
// assumed. Google Play Services matches the signed-in app to that Android client
// automatically, out-of-band, by inspecting the installed APK's actual package name
// and signing certificate — confirmed as the intended mechanism by this session's
// research into why the previous approach failed with "invalid_request".
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

/** The numeric Google Cloud project prefix only (before the first "-") — safe to
 * log/display; never the full client ID. */
function clientIdProjectPrefix(id: string | undefined): string | null {
  if (!id) return null;
  return id.split('-')[0] || null;
}

// Startup diagnostic — lets a failing preview/production build be told apart from a
// misconfigured one at a glance, without ever printing the actual client ID.
console.log(
  WEB_CLIENT_ID
    ? `[Google Sign-In] webClientId is set (project ${clientIdProjectPrefix(WEB_CLIENT_ID)}).`
    : '[Google Sign-In] webClientId is NOT set — the sign-in button will stay hidden.'
);

/** True once the web client ID is configured — until then, Google Sign-In stays
 * hidden on the Login screen rather than rendering a button that would just fail. */
export const isGoogleSignInConfigured = Boolean(WEB_CLIENT_ID);

let configured = false;
function ensureConfigured() {
  if (configured || !WEB_CLIENT_ID) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
}

/**
 * Runs the native Google Sign-In flow (Android Credential Manager via Google Play
 * Services — requires Play Services to be present on the device/emulator). Returns
 * the verified ID token on success, or null if the user cancelled (not an error).
 * Throws for any other failure — callers should catch and show a message via
 * getGoogleSignInErrorMessage().
 */
export async function signInWithGoogleNative(): Promise<string | null> {
  ensureConfigured();

  // Clear any lingering native session first, so the account picker always shows —
  // without this, Play Services silently re-signs the user into whichever Google
  // account was used last time (even across a JD Car Rental logout, since our own
  // logout only clears our own token, not the separate native Google session).
  // signOut(), never revokeAccess() — revoking would force the user to re-grant
  // permissions on every single sign-in instead of just re-picking an account.
  if (GoogleSignin.hasPreviousSignIn()) {
    try {
      await GoogleSignin.signOut();
    } catch (err) {
      console.warn('[Google Sign-In] Failed to clear the previous session before signing in (continuing anyway):', err);
    }
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (isSuccessResponse(response)) {
    return response.data.idToken;
  }
  return null;
}

/**
 * Signs out of the native Google session only (never revokeAccess — that would make
 * the user re-grant permissions on every future sign-in instead of just re-picking
 * an account). Call this from every JD Car Rental logout path so a later "Sign in
 * with Google" always shows the account picker instead of silently reusing the
 * previous session. Never throws and is a no-op if Google Sign-In isn't configured
 * or no native session exists — safe to call unconditionally on every logout,
 * regardless of how the user actually signed in.
 */
export async function signOutFromGoogle(): Promise<void> {
  if (!isGoogleSignInConfigured) return;
  try {
    await GoogleSignin.signOut();
  } catch (err) {
    console.warn('[Google Sign-In] signOut failed (ignored — logout continues):', err);
  }
}

// Raw Android GoogleSignInStatusCodes that surface as error.code but have no named
// constant in this library's own `statusCodes` object (which only exposes
// SIGN_IN_CANCELLED / IN_PROGRESS / PLAY_SERVICES_NOT_AVAILABLE / SIGN_IN_REQUIRED).
// See https://developers.google.com/android/reference/com/google/android/gms/auth/api/signin/GoogleSignInStatusCodes
const DEVELOPER_ERROR_CODE = '10';
const NETWORK_ERROR_CODE = '7';
const SIGN_IN_FAILED_CODE = '12500'; // "sign-in configuration error" per this task's own wording
const SIGN_IN_CANCELLED_NUMERIC_CODE = '12501';

function codeToString(code: unknown): string | undefined {
  return code === undefined || code === null ? undefined : String(code);
}

/** True for a plain user cancellation — callers should not show an alert for this. */
export function isGoogleSignInCancelled(error: unknown): boolean {
  if (!isErrorWithCode(error)) return false;
  const code = codeToString(error.code);
  return code === codeToString(statusCodes.SIGN_IN_CANCELLED) || code === SIGN_IN_CANCELLED_NUMERIC_CODE;
}

/** Maps a thrown GoogleSignin error to a user-facing message that names the real
 * code, so a build-specific misconfiguration (e.g. code 10) is visible immediately
 * instead of a generic "try again". */
export function getGoogleSignInErrorMessage(error: unknown): string {
  if (!isErrorWithCode(error)) {
    return 'Google sign-in failed. Please try again.';
  }

  const code = codeToString(error.code);

  if (code === codeToString(statusCodes.SIGN_IN_CANCELLED) || code === SIGN_IN_CANCELLED_NUMERIC_CODE) {
    return 'Sign-in was cancelled.';
  }
  if (code === codeToString(statusCodes.IN_PROGRESS)) {
    return 'A sign-in is already in progress.';
  }
  if (code === codeToString(statusCodes.PLAY_SERVICES_NOT_AVAILABLE)) {
    return 'Google Play Services is not available or is out of date on this device.';
  }
  if (code === DEVELOPER_ERROR_CODE) {
    return 'Google sign-in failed (code 10: app not registered with Google).';
  }
  if (code === NETWORK_ERROR_CODE) {
    return 'Google sign-in failed (code 7: network error). Check your connection and try again.';
  }
  if (code === SIGN_IN_FAILED_CODE) {
    return 'Google sign-in failed (code 12500: sign-in configuration error).';
  }
  return `Google sign-in failed${code ? ` (code ${code})` : ''}. Please try again.`;
}

/** Logs the real code/message for a native GoogleSignin failure — never swallowed,
 * so a misconfigured preview/production build is diagnosable from device logs. */
export function logGoogleSignInError(error: unknown): void {
  if (isErrorWithCode(error)) {
    console.warn('[Google Sign-In] Native sign-in failed:', { code: error.code, message: error.message });
  } else {
    console.warn('[Google Sign-In] Native sign-in failed with an unrecognized error shape:', error);
  }
}
