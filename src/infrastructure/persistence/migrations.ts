import { asNumber, asObject, InvalidDataError, type JsonObject } from '../shared/json-guards';
import { CURRENT_SCHEMA_VERSION } from './script-record';

/** Transforma un registro de la versión N a la N+1. */
export type Migration = (record: JsonObject) => JsonObject;

/**
 * Migraciones por versión de origen. Para cambiar el esquema:
 * 1) sube CURRENT_SCHEMA_VERSION, 2) agrega aquí `[versiónAnterior]: (r) => …`.
 * v5 es el primer esquema publicado: no hay registros anteriores que migrar.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

/** Lleva un registro crudo (de cualquier versión conocida) a la versión actual. */
export const migrateToCurrent = (
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): JsonObject => {
  let record = asObject(raw, 'script');
  let version = asNumber(record.schemaVersion, 'script.schemaVersion');

  if (version > targetVersion) {
    throw new InvalidDataError(
      `script.schemaVersion: la versión ${version} es más nueva que la que entiende la app (${targetVersion}).`,
    );
  }
  while (version < targetVersion) {
    const migrate = migrations[version];
    if (!migrate) {
      throw new InvalidDataError(
        `script.schemaVersion: no hay migración desde la versión ${version}.`,
      );
    }
    record = migrate(record);
    version += 1;
  }
  return record;
};
