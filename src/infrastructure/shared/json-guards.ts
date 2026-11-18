/**
 * Validadores mínimos para datos externos (JSON semilla, registros de IndexedDB).
 * Lanzan `InvalidDataError` con la ruta del campo para facilitar el diagnóstico.
 */
export class InvalidDataError extends Error {
  override readonly name = 'InvalidDataError';
}

export type JsonObject = Readonly<Record<string, unknown>>;

export const asObject = (value: unknown, path: string): JsonObject => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidDataError(`${path}: se esperaba un objeto.`);
  }
  return value as JsonObject;
};

export const asArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) throw new InvalidDataError(`${path}: se esperaba una lista.`);
  return value as readonly unknown[];
};

export const asString = (value: unknown, path: string): string => {
  if (typeof value !== 'string') throw new InvalidDataError(`${path}: se esperaba un texto.`);
  return value;
};

export const asNullableString = (value: unknown, path: string): string | null =>
  value === null ? null : asString(value, path);

export const asNumber = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InvalidDataError(`${path}: se esperaba un número.`);
  }
  return value;
};

export const asEnum = <T extends string>(
  value: unknown,
  guard: (v: string) => v is T,
  path: string,
): T => {
  const text = asString(value, path);
  if (!guard(text)) throw new InvalidDataError(`${path}: valor no permitido "${text}".`);
  return text;
};
