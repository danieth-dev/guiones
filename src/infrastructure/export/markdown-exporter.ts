import type { ExportFile, ScriptExporter, ScriptView } from '../../application';
import { slugify } from '../../application';

const escapeCell = (text: string): string => text.replace(/\|/gu, '\\|') || '—';

/** Tabla de rodaje en Markdown: qué se dice, con qué plano y con cuánta energía. */
export class MarkdownExporter implements ScriptExporter {
  readonly format = 'md';

  export(script: ScriptView): ExportFile {
    const content = [
      `# ${script.title}`,
      '',
      `**Formato:** ${script.format.label} (${script.format.durationLabel}) · ` +
        `**Duración estimada:** ${String(script.estimatedSec)} s · ${String(script.wordsPerMinute)} palabras/min`,
      '',
      '| # | Parte | Se dice | Plano | Energía | s |',
      '|---|---|---|---|---|---|',
      ...script.phrases.map((p) => {
        const shot = p.note ? `${p.shotLabel}: ${p.note}` : p.shotLabel;
        return `| ${String(p.order)} | ${p.sectionLabel} | ${escapeCell(p.text)} | ${escapeCell(shot)} | ${p.energyLabel} | ${String(p.seconds)} |`;
      }),
      '',
    ].join('\n');
    return {
      fileName: `${slugify(script.title)}-rodaje.md`,
      mimeType: 'text/markdown;charset=utf-8',
      content,
    };
  }
}
