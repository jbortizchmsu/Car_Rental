import type { Request } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';

/**
 * Removes a trailing port from an IP string, leaving anything without one untouched.
 *
 * Azure App Service's front end appends the client's source port to X-Forwarded-For
 * ("143.44.168.170:49467"), and Express with `trust proxy` hands that string back verbatim
 * as `req.ip`. Left as-is, every new connection from the same client gets a different
 * "ip:port" rate-limit key, so no limit ever accumulates.
 *
 *   "1.2.3.4:5678"   -> "1.2.3.4"
 *   "[::1]:5678"     -> "::1"      (IPv6 is bracketed when it carries a port)
 *   "[::1]"          -> "::1"
 *   "2001:db8::1"    -> unchanged  (bare IPv6 has several colons, so it is never treated as ip:port)
 *   "1.2.3.4"        -> unchanged
 */
export function stripPort(raw: string): string {
  const value = raw.trim();

  const bracketedIpv6 = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(value);
  if (bracketedIpv6) return bracketedIpv6[1];

  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(value);
  if (ipv4WithPort) return ipv4WithPort[1];

  return value;
}

/**
 * express-rate-limit `keyGenerator` that keys on the client IP with any port removed.
 *
 * IPv6 addresses are passed through the library's `ipKeyGenerator`, which groups them by
 * subnet (/56 by default) so one IPv6 user can't dodge a limit by rotating addresses inside
 * their own allocation. It must be referenced inside this function's own body: the library
 * inspects a custom keyGenerator's source text and refuses to start if it sees `req.ip`
 * without `ipKeyGenerator`. Supplying a keyGenerator also replaces the library's default
 * one, which is where its ERR_ERL_INVALID_IP_ADDRESS check (a raw `ip:port` fails
 * `net.isIP`) lives, so that log noise goes away too.
 *
 * Falls back to the socket address when `req.ip` is missing, and to the literal "unknown"
 * (a single shared bucket) when neither is available.
 */
export function clientIpKeyGenerator(req: Request): string {
  const raw = req.ip || req.socket?.remoteAddress;
  if (!raw) return 'unknown';

  const cleaned = stripPort(raw);
  if (!cleaned) return 'unknown';

  return ipKeyGenerator(cleaned);
}
