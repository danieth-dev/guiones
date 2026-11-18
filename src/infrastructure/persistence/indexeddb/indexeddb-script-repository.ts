import type { ScriptRepository } from '../../../application';
import type { Script, ScriptId } from '../../../domain';
import { fromRecord, toRecord } from '../script-record-mapper';
import { committed, promisify, STORES } from './database';

/** Guiones en IndexedDB: un registro versionado por guion. */
export class IndexedDbScriptRepository implements ScriptRepository {
  constructor(
    private readonly db: IDBDatabase,
    private readonly onCorrupted: (id: unknown, error: unknown) => void = (id, error) => {
      console.warn(`Se omitió el guion ${String(id)} por datos inválidos`, error);
    },
  ) {}

  async save(script: Script): Promise<void> {
    const tx = this.db.transaction(STORES.scripts, 'readwrite');
    tx.objectStore(STORES.scripts).put(toRecord(script));
    await committed(tx);
  }

  async findById(id: ScriptId): Promise<Script | null> {
    const store = this.db.transaction(STORES.scripts, 'readonly').objectStore(STORES.scripts);
    const raw: unknown = await promisify(store.get(id));
    return raw === undefined ? null : fromRecord(raw);
  }

  async findAll(): Promise<readonly Script[]> {
    const store = this.db.transaction(STORES.scripts, 'readonly').objectStore(STORES.scripts);
    const records: readonly unknown[] = await promisify(store.getAll());
    return records.flatMap((raw) => {
      try {
        return [fromRecord(raw)];
      } catch (error) {
        this.onCorrupted((raw as { id?: unknown } | null)?.id, error);
        return [];
      }
    });
  }

  async delete(id: ScriptId): Promise<void> {
    const tx = this.db.transaction(STORES.scripts, 'readwrite');
    tx.objectStore(STORES.scripts).delete(id);
    await committed(tx);
  }
}
