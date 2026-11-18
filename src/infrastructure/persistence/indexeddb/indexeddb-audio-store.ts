import type { AudioStore, VoiceTake } from '../../../application';
import type { AudioId, ScriptId } from '../../../domain';
import { AUDIO_BY_OWNER, committed, promisify, STORES } from './database';

/**
 * Se guarda el audio como ArrayBuffer + tipo MIME en lugar de Blob: es más
 * portable entre navegadores (Safari tuvo problemas históricos con Blobs en IDB).
 */
interface AudioRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly mimeType: string;
  readonly data: ArrayBuffer;
}

/** Tomas de voz en IndexedDB, indexadas por guion. */
export class IndexedDbAudioStore implements AudioStore {
  constructor(private readonly db: IDBDatabase) {}

  async save(take: VoiceTake): Promise<void> {
    // El buffer se lee antes de abrir la transacción: IDB la cerraría al esperar.
    const record: AudioRecord = {
      id: take.id,
      ownerId: take.ownerId,
      mimeType: take.audio.type,
      data: await take.audio.arrayBuffer(),
    };
    const tx = this.db.transaction(STORES.audio, 'readwrite');
    tx.objectStore(STORES.audio).put(record);
    await committed(tx);
  }

  async load(id: AudioId): Promise<Blob | null> {
    const store = this.db.transaction(STORES.audio, 'readonly').objectStore(STORES.audio);
    const record = (await promisify(store.get(id))) as AudioRecord | undefined;
    return record ? new Blob([record.data], { type: record.mimeType }) : null;
  }

  async delete(id: AudioId): Promise<void> {
    const tx = this.db.transaction(STORES.audio, 'readwrite');
    tx.objectStore(STORES.audio).delete(id);
    await committed(tx);
  }

  async deleteByOwner(ownerId: ScriptId): Promise<void> {
    const tx = this.db.transaction(STORES.audio, 'readwrite');
    const store = tx.objectStore(STORES.audio);
    const keys = await promisify(store.index(AUDIO_BY_OWNER).getAllKeys(ownerId));
    for (const key of keys) store.delete(key);
    await committed(tx);
  }
}
