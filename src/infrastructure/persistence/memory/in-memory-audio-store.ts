import type { AudioStore, VoiceTake } from '../../../application';
import type { AudioId, ScriptId } from '../../../domain';

/** Almacén de tomas en memoria (tests y fallback sin IndexedDB). */
export class InMemoryAudioStore implements AudioStore {
  private readonly takes = new Map<string, VoiceTake>();

  save(take: VoiceTake): Promise<void> {
    this.takes.set(take.id, take);
    return Promise.resolve();
  }

  load(id: AudioId): Promise<Blob | null> {
    return Promise.resolve(this.takes.get(id)?.audio ?? null);
  }

  delete(id: AudioId): Promise<void> {
    this.takes.delete(id);
    return Promise.resolve();
  }

  deleteByOwner(ownerId: ScriptId): Promise<void> {
    for (const [id, take] of this.takes) {
      if (take.ownerId === ownerId) this.takes.delete(id);
    }
    return Promise.resolve();
  }
}
