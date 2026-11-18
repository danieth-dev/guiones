import type { DomainError } from './domain-error';

/** Éxito de una operación de dominio. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** Fallo esperado de una operación de dominio (el dominio no lanza excepciones). */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = DomainError> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** Encadena operaciones que pueden fallar, cortando en el primer error. */
export const andThen = <T, U, E>(
  result: Result<T, E>,
  next: (value: T) => Result<U, E>,
): Result<U, E> => (result.ok ? next(result.value) : result);
