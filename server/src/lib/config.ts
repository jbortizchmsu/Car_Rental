if (!process.env.JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
    'Server refused to start. Set a strong secret (min 32 chars) in your .env file.'
  );
}

export const JWT_SECRET: string = process.env.JWT_SECRET;

// Deliberately NOT fail-fast (unlike JWT_SECRET above): Google Sign-In is an
// additive, optional feature. If this is unset/misconfigured, POST /auth/google
// must fail cleanly on its own at request time — it must never prevent the server
// process from starting, since that would take down every other route (/login,
// /register, etc.) along with it.
export const GOOGLE_CLIENT_ID: string | undefined = process.env.GOOGLE_CLIENT_ID;
