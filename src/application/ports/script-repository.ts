import type { Script, ScriptId } from '../../domain';

/**
 * Puerto de persistencia de guiones. Los adaptadores pueden lanzar ante fallos
 * de E/S; la capa de aplicación los traduce a `STORAGE_FAILURE`.
 */
export interface ScriptRepository {
  save(script: Script): Promise<void>;
  /** `null` si no existe. */
  findById(id: ScriptId): Promise<Script | null>;
  /** Todos los guiones legibles; los registros corruptos se omiten. */
  findAll(): Promise<readonly Script[]>;
  delete(id: ScriptId): Promise<void>;
}
