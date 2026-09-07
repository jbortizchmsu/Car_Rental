// Test-only environment setup, loaded before any test module via jest.config.js's `setupFiles`.
// server/src/lib/config.ts throws at import time if JWT_SECRET is unset, so route-handler tests
// that import auth.ts (directly or transitively) need this set before that import happens.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-only-jwt-secret-do-not-use-in-production-32chars';
}

// server/src/lib/email.ts constructs `new Resend(process.env.RESEND_API_KEY)` at module load
// time, and the Resend SDK throws immediately if the key is undefined (not just the console
// warning the file logs first). Route files that import email-sending helpers (e.g. auth.ts)
// therefore crash on import in a test process unless this is set to some placeholder value.
if (!process.env.RESEND_API_KEY) {
  process.env.RESEND_API_KEY = 're_test_placeholder_not_a_real_key';
}
