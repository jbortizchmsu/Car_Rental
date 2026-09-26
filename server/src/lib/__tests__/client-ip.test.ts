import express from 'express';
import request from 'supertest';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { stripPort, clientIpKeyGenerator } from '../client-ip';

// Only the fields the helper reads — a real Express Request isn't needed to test it.
const fakeReq = (ip: string | undefined, remoteAddress?: string) =>
  ({ ip, socket: remoteAddress === undefined ? undefined : { remoteAddress } }) as any;

describe('stripPort', () => {
  test('IPv4 with a port → port removed', () => {
    expect(stripPort('143.44.168.170:49467')).toBe('143.44.168.170');
  });

  test('IPv4 without a port → unchanged', () => {
    expect(stripPort('143.44.168.170')).toBe('143.44.168.170');
  });

  test('IPv6 in brackets with a port → brackets and port removed', () => {
    expect(stripPort('[::1]:5678')).toBe('::1');
    expect(stripPort('[2001:db8::1]:443')).toBe('2001:db8::1');
  });

  test('IPv6 in brackets without a port → brackets removed', () => {
    expect(stripPort('[2001:db8::1]')).toBe('2001:db8::1');
  });

  test('bare IPv6 is never mistaken for ip:port', () => {
    expect(stripPort('2001:db8::1')).toBe('2001:db8::1');
    expect(stripPort('::1')).toBe('::1');
    expect(stripPort('2001:db8:abcd:1234:5678:9abc:def0:1234')).toBe('2001:db8:abcd:1234:5678:9abc:def0:1234');
  });

  test('surrounding whitespace is ignored', () => {
    expect(stripPort('  1.2.3.4:80 ')).toBe('1.2.3.4');
  });
});

describe('clientIpKeyGenerator', () => {
  test('IPv4 with a port → the bare IPv4', () => {
    expect(clientIpKeyGenerator(fakeReq('143.44.168.170:49467'))).toBe('143.44.168.170');
  });

  test('IPv4 without a port → unchanged', () => {
    expect(clientIpKeyGenerator(fakeReq('143.44.168.170'))).toBe('143.44.168.170');
  });

  test('IPv6 with brackets and a port → keyed as the port-less address, via ipKeyGenerator', () => {
    const key = clientIpKeyGenerator(fakeReq('[2001:db8:abcd:1234::1]:5678'));
    expect(key).toBe(ipKeyGenerator('2001:db8:abcd:1234::1'));
    expect(key).not.toContain('[');
    expect(key).not.toContain('5678');
  });

  test('plain IPv6 → passed through ipKeyGenerator (grouped by subnet)', () => {
    const a = clientIpKeyGenerator(fakeReq('2001:db8:abcd:1234:5678:9abc:def0:1234'));
    expect(a).toBe(ipKeyGenerator('2001:db8:abcd:1234:5678:9abc:def0:1234'));
    // Two addresses inside the same /56 share one bucket; a different /56 does not.
    expect(clientIpKeyGenerator(fakeReq('2001:db8:abcd:12ff::9'))).toBe(a);
    expect(clientIpKeyGenerator(fakeReq('2001:db8:abcd:3400::9'))).not.toBe(a);
  });

  test('req.ip undefined → falls back to the socket address', () => {
    expect(clientIpKeyGenerator(fakeReq(undefined, '10.1.2.3'))).toBe('10.1.2.3');
  });

  test('socket address with a port is cleaned too', () => {
    expect(clientIpKeyGenerator(fakeReq(undefined, '10.1.2.3:9999'))).toBe('10.1.2.3');
  });

  test('req.ip undefined and no socket address → "unknown"', () => {
    expect(clientIpKeyGenerator(fakeReq(undefined))).toBe('unknown');
    expect(clientIpKeyGenerator(fakeReq(undefined, ''))).toBe('unknown');
  });
});

describe('clientIpKeyGenerator inside a real express-rate-limit limiter', () => {
  function buildApp() {
    const app = express();
    app.set('trust proxy', 1); // same setting as src/index.ts
    app.use(
      rateLimit({
        windowMs: 60_000,
        max: 2,
        keyGenerator: clientIpKeyGenerator,
        standardHeaders: false,
        legacyHeaders: false,
      })
    );
    app.get('/ping', (_req, res) => res.json({ ok: true }));
    return app;
  }

  test('is accepted by the library (its startup check rejects a keyGenerator that reads req.ip without ipKeyGenerator)', () => {
    expect(() => buildApp()).not.toThrow();
  });

  test('the same client arriving on different source ports shares ONE bucket (the Azure bug)', async () => {
    const app = buildApp();
    const send = (xff: string) => request(app).get('/ping').set('X-Forwarded-For', xff);

    expect((await send('143.44.168.170:49467')).status).toBe(200);
    expect((await send('143.44.168.170:51234')).status).toBe(200);
    // Third request from the same client, yet another port: would be 200 if ports leaked into the key.
    expect((await send('143.44.168.170:60001')).status).toBe(429);
  });

  test('a different client is not affected by the first client being limited', async () => {
    const app = buildApp();
    const send = (xff: string) => request(app).get('/ping').set('X-Forwarded-For', xff);

    await send('143.44.168.170:1');
    await send('143.44.168.170:2');
    expect((await send('143.44.168.170:3')).status).toBe(429);
    expect((await send('198.51.100.7:4000')).status).toBe(200);
  });
});
