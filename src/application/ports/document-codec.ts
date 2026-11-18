import type { Result } from '../../domain';
import type { AppError } from '../shared/app-error';

/**
 * Guion como documento portable (Markdown, Obsidian). Solo lo que se escribe:
 * las grabaciones viven en la app.
 */
export interface ScriptDocument {
  readonly title: string;
  readonly formatId: string;
  readonly wordsPerMinute: number;
  readonly phrases: readonly PhraseDocument[];
}

export interface PhraseDocument {
  readonly section: string;
  /** `null`: se usa el plano sugerido. */
  readonly shot: string | null;
  readonly energy: string;
  readonly note: string;
  readonly text: string;
}

/**
 * Puerto del formato de archivo. `parseScript` informa los errores con el
 * número de línea para que se puedan corregir a mano.
 */
export interface DocumentCodec {
  readonly extension: string;
  readonly mimeType: string;
  serializeScript(document: ScriptDocument): string;
  parseScript(text: string): Result<ScriptDocument, AppError>;
}
