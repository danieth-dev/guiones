import type { ExportFile, ScriptExporter, ScriptView } from '../../application';
import { slugify } from '../../application';

/** Texto plano para leer en voz alta o pegar en un teleprompter externo. */
export class TextExporter implements ScriptExporter {
  readonly format = 'txt';

  export(script: ScriptView): ExportFile {
    const lines = [
      script.title.toUpperCase(),
      `${script.format.label} · ~${String(script.estimatedSec)} s · ${String(script.wordsPerMinute)} palabras/min`,
      '',
    ];
    for (const phrase of script.phrases) {
      if (!phrase.text) continue;
      lines.push(
        `[${phrase.sectionLabel} · ${phrase.shotLabel} · energía ${phrase.energyLabel.toLowerCase()}]`,
        phrase.text,
        '',
      );
    }
    return {
      fileName: `${slugify(script.title)}.txt`,
      mimeType: 'text/plain;charset=utf-8',
      content: `${lines.join('\n').trimEnd()}\n`,
    };
  }
}
