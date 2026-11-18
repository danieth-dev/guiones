/**
 * Forma persistida de un guion (versión actual: 5). Solo guarda datos fuente:
 * duraciones y sugerencias se recalculan al leer.
 *
 * v5: guion simple (formato de video + frases con plano y energía).
 */
export const CURRENT_SCHEMA_VERSION = 5;

export interface PhraseRecord {
  readonly id: string;
  readonly section: string;
  readonly text: string;
  readonly guide: string;
  readonly shot: string | null;
  readonly energy: string;
  readonly note: string;
  readonly take: string | null;
}

export interface ScriptRecordV5 {
  readonly schemaVersion: 5;
  readonly id: string;
  readonly title: string;
  readonly formatId: string;
  readonly wordsPerMinute: number;
  readonly phrases: readonly PhraseRecord[];
  /** ISO 8601. */
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ScriptRecord = ScriptRecordV5;
