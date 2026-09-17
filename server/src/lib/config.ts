import dotenv from 'dotenv';
dotenv.config();

// This file's checks run as a side effect of the FIRST time anything imports from
// it — which can happen very early in the require chain (e.g. routes/auth.ts imports
// JWT_SECRET from here near the top of index.ts's own import list), potentially before
// index.ts's own later dotenv.config() call. Loading dotenv here too guarantees these
// checks always see .env values regardless of which module imports this one first;
// dotenv.config() is safe to call more than once (subsequent calls are no-ops for
// keys already present in process.env).
if (!process.env.JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
    'Server refused to start. Set a strong secret (min 32 chars) in your .env file.'
  );
}

export const JWT_SECRET: string = process.env.JWT_SECRET;

if (!process.env.SUPABASE_URL) {
  throw new Error(
    'FATAL: SUPABASE_URL environment variable is not set. ' +
    'Server refused to start. Set it in your .env file.'
  );
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY) {
  throw new Error(
    'FATAL: Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY is set. ' +
    'Server refused to start. Set one of them in your .env file.'
  );
}

export const SUPABASE_URL: string = process.env.SUPABASE_URL;
// Service role is preferred (needed for private-bucket admin operations); anon key is
// accepted as a fallback if that's all that's configured — this preference order is
// unchanged from before, only the hardcoded third-tier literal fallback was removed.
export const SUPABASE_KEY: string = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)!;

// Deliberately NOT fail-fast (unlike JWT_SECRET above): Google Sign-In is an
// additive, optional feature. If this is unset/misconfigured, POST /auth/google
// must fail cleanly on its own at request time — it must never prevent the server
// process from starting, since that would take down every other route (/login,
// /register, etc.) along with it.
export const GOOGLE_CLIENT_ID: string | undefined = process.env.GOOGLE_CLIENT_ID;
