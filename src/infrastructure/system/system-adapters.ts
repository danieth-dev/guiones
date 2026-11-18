import type { Clock, IdGenerator, IdPrefix } from '../../application';

/** Ids globalmente únicos ("bt_3f2a…") con el generador criptográfico del navegador. */
export class CryptoIdGenerator implements IdGenerator {
  next(prefix: IdPrefix): string {
    return `${prefix}_${crypto.randomUUID()}`;
  }
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
