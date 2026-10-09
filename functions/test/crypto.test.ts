import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, secureRandom } from '../src/crypto';

describe('cifrado de credenciales', () => {
  const key = randomBytes(32).toString('base64');

  it('cifra y descifra', () => {
    const c = encrypt('APP_USR-123', key);
    expect(c).not.toContain('APP_USR');
    expect(decrypt(c, key)).toBe('APP_USR-123');
  });

  it('falla con otra clave o si el texto fue alterado', () => {
    const c = encrypt('APP_USR-123', key);
    expect(() => decrypt(c, randomBytes(32).toString('base64'))).toThrow();
    const parts = c.split('.');
    parts[3] = Buffer.from('otro').toString('base64');
    expect(() => decrypt(parts.join('.'), key)).toThrow();
  });

  it('genera números en [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const r = secureRandom();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });
});
