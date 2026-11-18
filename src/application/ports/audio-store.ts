import type { AudioId, ScriptId } from '../../domain';

export interface VoiceTake {
  readonly id: AudioId;
  /** Guion al que pertenece, para poder borrar todas sus tomas de una vez. */
  readonly ownerId: ScriptId;
  readonly audio: Blob;
}

/** Puerto de almacenamiento de las tomas de voz (VoiceCheck). */
export interface AudioStore {
  save(take: VoiceTake): Promise<void>;
  /** `null` si no existe. */
  load(id: AudioId): Promise<Blob | null>;
  delete(id: AudioId): Promise<void>;
  deleteByOwner(ownerId: ScriptId): Promise<void>;
}
