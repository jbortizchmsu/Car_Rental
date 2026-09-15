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
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (isSuccessResponse(response)) {
    return response.data.idToken;
  }
  return null;
}

/** Maps a thrown GoogleSignin error to a user-facing message. */
export function getGoogleSignInErrorMessage(error: unknown): string {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.IN_PROGRESS:
        return 'A sign-in is already in progress.';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services is not available or is out of date on this device.';
      default:
        return 'Google sign-in failed. Please try again.';
    }
  }
  return 'Google sign-in failed. Please try again.';
}
