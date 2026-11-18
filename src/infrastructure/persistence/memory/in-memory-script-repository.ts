import type { ScriptRepository } from '../../../application';
import type { Script, ScriptId } from '../../../domain';
import { fromRecord, toRecord } from '../script-record-mapper';
import type { ScriptRecord } from '../script-record';

/**
 * Repositorio en memoria. Guarda registros clonados (no las entidades) para
 * comportarse igual que IndexedDB: tests y fallback sin almacenamiento.
 */
export class InMemoryScriptRepository implements ScriptRepository {
  private readonly records = new Map<string, ScriptRecord>();

  save(script: Script): Promise<void> {
    this.records.set(script.id, structuredClone(toRecord(script)));
    return Promise.resolve();
  }

  findById(id: ScriptId): Promise<Script | null> {
    const record = this.records.get(id);
    return Promise.resolve(record ? fromRecord(structuredClone(record)) : null);
  }

  findAll(): Promise<readonly Script[]> {
    return Promise.resolve(
      [...this.records.values()].map((record) => fromRecord(structuredClone(record))),
    );
  }

  delete(id: ScriptId): Promise<void> {
    this.records.delete(id);
    return Promise.resolve();
  }
}
