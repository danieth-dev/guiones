import type { ScriptView } from '../dto/script-view';

export type ExportFormat = 'txt' | 'md';

export interface ExportFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly content: string;
}

/** Convierte la vista del guion en un archivo descargable. */
export interface ScriptExporter {
  readonly format: ExportFormat;
  export(script: ScriptView): ExportFile;
}
