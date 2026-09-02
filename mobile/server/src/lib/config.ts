if (!process.env.JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
    'Server refused to start. Set a strong secret (min 32 chars) in your .env file.'
  );
}

export const JWT_SECRET: string = process.env.JWT_SECRET;
