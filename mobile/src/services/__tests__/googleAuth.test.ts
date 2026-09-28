// The real @react-native-google-signin/google-signin package calls a native module
// at import time (statusCodes derives from NativeModule.getConstants()), so it must
// be mocked entirely for these tests — only the pieces googleAuth.ts actually uses.
jest.mock('@react-native-google-signin/google-signin', () => ({
  __esModule: true,
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  isSuccessResponse: jest.fn(),
  isErrorWithCode: (error: any) => typeof error === 'object' && error !== null && 'code' in error,
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
}));

import {
  getGoogleSignInErrorMessage,
  isGoogleSignInCancelled,
  logGoogleSignInError,
} from '../googleAuth';

describe('getGoogleSignInErrorMessage', () => {
  test('non-code error: generic message', () => {
    expect(getGoogleSignInErrorMessage(new Error('boom'))).toBe('Google sign-in failed. Please try again.');
  });

  test('named SIGN_IN_CANCELLED: cancellation message', () => {
    expect(getGoogleSignInErrorMessage({ code: 'SIGN_IN_CANCELLED' })).toBe('Sign-in was cancelled.');
  });

  test('numeric 12501 (raw Android cancellation code): cancellation message', () => {
    expect(getGoogleSignInErrorMessage({ code: '12501' })).toBe('Sign-in was cancelled.');
    expect(getGoogleSignInErrorMessage({ code: 12501 })).toBe('Sign-in was cancelled.');
  });

  test('IN_PROGRESS: named message', () => {
    expect(getGoogleSignInErrorMessage({ code: 'IN_PROGRESS' })).toBe('A sign-in is already in progress.');
  });

  test('PLAY_SERVICES_NOT_AVAILABLE: named message', () => {
    expect(getGoogleSignInErrorMessage({ code: 'PLAY_SERVICES_NOT_AVAILABLE' })).toBe(
      'Google Play Services is not available or is out of date on this device.'
    );
  });

  test('code 10 (DEVELOPER_ERROR): names the configuration/client-ID-mismatch cause', () => {
    expect(getGoogleSignInErrorMessage({ code: '10' })).toBe(
      'Google sign-in failed (code 10: app not registered with Google).'
    );
    expect(getGoogleSignInErrorMessage({ code: 10 })).toBe(
      'Google sign-in failed (code 10: app not registered with Google).'
    );
  });

  test('code 7 (NETWORK_ERROR): names the network cause', () => {
    expect(getGoogleSignInErrorMessage({ code: '7' })).toBe(
      'Google sign-in failed (code 7: network error). Check your connection and try again.'
    );
  });

  test('code 12500: names the sign-in configuration cause', () => {
    expect(getGoogleSignInErrorMessage({ code: '12500' })).toBe(
      'Google sign-in failed (code 12500: sign-in configuration error).'
    );
  });

  test('an unrecognized code: still names the code instead of a fully generic message', () => {
    expect(getGoogleSignInErrorMessage({ code: '99999' })).toBe('Google sign-in failed (code 99999). Please try again.');
  });
});

describe('isGoogleSignInCancelled', () => {
  test('true for the named SIGN_IN_CANCELLED code', () => {
    expect(isGoogleSignInCancelled({ code: 'SIGN_IN_CANCELLED' })).toBe(true);
  });

  test('true for the raw numeric 12501 code (string or number)', () => {
    expect(isGoogleSignInCancelled({ code: '12501' })).toBe(true);
    expect(isGoogleSignInCancelled({ code: 12501 })).toBe(true);
  });

  test('false for any other code', () => {
    expect(isGoogleSignInCancelled({ code: '10' })).toBe(false);
  });

  test('false for a non-code error or non-object value', () => {
    expect(isGoogleSignInCancelled(new Error('boom'))).toBe(false);
    expect(isGoogleSignInCancelled(null)).toBe(false);
    expect(isGoogleSignInCancelled(undefined)).toBe(false);
  });
});

describe('logGoogleSignInError', () => {
  test('logs code and message via console.warn for a code-bearing error, never throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logGoogleSignInError({ code: '10', message: 'DEVELOPER_ERROR' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[Google Sign-In] Native sign-in failed:',
      expect.objectContaining({ code: '10', message: 'DEVELOPER_ERROR' })
    );
    warnSpy.mockRestore();
  });

  test('logs a fallback line for an error with no code, never throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => logGoogleSignInError(new Error('boom'))).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
