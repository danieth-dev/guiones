import type { AppError, DocumentCodec, PhraseDocument, ScriptDocument } from '../../application';
import {
  domainError,
  ENERGIES,
  ENERGY_LABELS,
  err,
  FORMAT_IDS,
  ok,
  SECTION_LABELS,
  SECTIONS,
  SHOT_LABELS,
  SHOTS,
  VideoFormat,
  type Result,
  type Section,
} from '../../domain';

/*
 * Formato Markdown de Guiones (legible y editable a mano, p. ej. en Obsidian):
 *
 *   ---
 *   scriptflow: guion
 *   titulo: "Por qué tu primer video no despega"
 *   formato: vertical corto
 *   ppm: 160
 *   ---
 *
 *   # Por qué tu primer video no despega
 *
 *   ## Inicio
 *   - [primer plano] [energía: alta] Grabé 30 videos con buena luz.
 *
 *   ## Desarrollo
 *   - [b-roll] Cambié la cámara y el micrófono.
 *     > La cámara nueva sobre la mesa
 *   - Una frase sin etiquetas usa el plano sugerido y energía normal.
 *
 *   ## Cierre
 *   - Pruébalo en tu próximo video.
 *
 * Los valores aceptan el id o la etiqueta en español, sin importar mayúsculas
 * ni tildes ("Primer plano", "primer-plano" y "CLOSE_UP" valen igual).
 */

const normalize = (value: string): string =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[-_]+/gu, ' ').trim();

/** Diccionario etiqueta/id → id, tolerante a tildes, guiones y mayúsculas. */
const vocabulary = <T extends string>(
  ids: readonly T[],
  labels: Partial<Record<T, string>> = {},
  aliases: Readonly<Record<string, T>> = {},
): ((raw: string) => T | null) => {
  const map = new Map<string, T>();
  for (const id of ids) {
    map.set(normalize(id), id);
    const label = labels[id];
    if (label) map.set(normalize(label), id);
  }
  for (const [alias, id] of Object.entries(aliases)) map.set(normalize(alias), id);
  return (raw) => map.get(normalize(raw)) ?? null;
};

const FORMAT_LABELS = Object.fromEntries(VideoFormat.ALL.map((f) => [f.id, f.label]));
const FORMATS = vocabulary(FORMAT_IDS, FORMAT_LABELS, {
  short: 'SHORT_VERTICAL',
  tiktok: 'SHORT_VERTICAL',
  reel: 'SHORT_VERTICAL',
  youtube: 'LONG_HORIZONTAL',
});
const SECTION_NAMES = vocabulary(SECTIONS, SECTION_LABELS, { hook: 'OPENING', cta: 'CLOSING' });
const SHOT_NAMES = vocabulary(SHOTS, SHOT_LABELS, { broll: 'BROLL', texto: 'TEXT' });
const ENERGY_NAMES = vocabulary(ENERGIES, ENERGY_LABELS, { baja: 'CALM', media: 'NORMAL' });

const fail = (line: number, message: string): Result<never, AppError> =>
  err(domainError('INVALID_VALUE', `Línea ${String(line)}: ${message}`));

interface Line {
  readonly n: number;
  readonly text: string;
}

/** Separa el bloque de metadatos `---` del cuerpo. */
const splitFrontmatter = (
  text: string,
): Result<{ meta: Map<string, string>; body: readonly Line[] }, AppError> => {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  const meta = new Map<string, string>();
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
    if (end < 0) return fail(1, 'el bloque de metadatos "---" no está cerrado.');
    for (let i = 1; i < end; i += 1) {
      const raw = lines[i] ?? '';
      if (raw.trim() === '') continue;
      const match = /^([\w-]+)\s*:\s*(.*)$/u.exec(raw);
      if (!match) return fail(i + 1, `metadato mal escrito: «${raw.trim()}». Usa "clave: valor".`);
      const [, key = '', value = ''] = match;
      let parsed = value.trim();
      if (parsed.startsWith('"')) {
        try {
          parsed = String(JSON.parse(parsed));
        } catch {
          return fail(i + 1, `texto entre comillas mal cerrado en «${key}».`);
        }
      }
      meta.set(key.toLowerCase(), parsed);
    }
    start = end + 1;
  }
  return ok({
    meta,
    body: lines.slice(start).map((line, i) => ({ n: start + i + 1, text: line })),
  });
};

/** Tokens `[…]` al inicio de una línea; devuelve el resto como texto. */
const takeTokens = (line: string): { tokens: string[]; rest: string } => {
  const tokens: string[] = [];
  let rest = line;
  for (;;) {
    const match = /^\s*\[([^\]]*)\]/u.exec(rest);
    if (!match) break;
    tokens.push(match[1]?.trim() ?? '');
    rest = rest.slice(match[0].length);
  }
  return { tokens, rest: rest.trim() };
};

interface Draft {
  section: Section;
  shot: string | null;
  energy: string;
  text: string[];
  note: string[];
}

const joinText = (parts: readonly string[]): string => parts.join(' ').replace(/\s+/gu, ' ').trim();

export class MarkdownDocumentCodec implements DocumentCodec {
  readonly extension = 'md';
  readonly mimeType = 'text/markdown';

  serializeScript(doc: ScriptDocument): string {
    const format = VideoFormat.ALL.find((f) => f.id === doc.formatId);
    const out: string[] = [
      '---',
      'scriptflow: guion',
      `titulo: ${JSON.stringify(doc.title)}`,
      `formato: ${format ? format.label.toLowerCase() : doc.formatId}`,
      `ppm: ${String(doc.wordsPerMinute)}`,
      '---',
      '',
      `# ${doc.title}`,
    ];
    let section: string | null = null;
    for (const phrase of doc.phrases) {
      if (phrase.section !== section) {
        section = phrase.section;
        out.push('', `## ${SECTION_LABELS[phrase.section as Section]}`, '');
      }
      const tokens: string[] = [];
      if (phrase.shot)
        tokens.push(`[${SHOT_LABELS[phrase.shot as keyof typeof SHOT_LABELS].toLowerCase()}]`);
      if (phrase.energy !== 'NORMAL') {
        tokens.push(
          `[energía: ${ENERGY_LABELS[phrase.energy as keyof typeof ENERGY_LABELS].toLowerCase()}]`,
        );
      }
      out.push(`- ${[...tokens, phrase.text].filter(Boolean).join(' ')}`.trimEnd());
      if (phrase.note) out.push(`  > ${phrase.note}`);
    }
    return `${out.join('\n').trimEnd()}\n`;
  }

  parseScript(text: string): Result<ScriptDocument, AppError> {
    const split = splitFrontmatter(text);
    if (!split.ok) return split;
    const { meta, body } = split.value;
    const kind = meta.get('scriptflow');
    if (kind !== undefined && normalize(kind) !== 'guion') {
      return fail(1, `este archivo es «${kind}», no un guion.`);
    }
    const formatRaw = meta.get('formato') ?? 'vertical corto';
    const formatId = FORMATS(formatRaw);
    if (!formatId) {
      return fail(
        1,
        `formato desconocido «${formatRaw}» (vertical corto, vertical medio u horizontal largo).`,
      );
    }
    const ppmRaw = meta.get('ppm') ?? '160';
    const wordsPerMinute = Number(ppmRaw);
    if (!Number.isInteger(wordsPerMinute))
      return fail(1, `"ppm" debe ser un número entero: «${ppmRaw}».`);

    let title = meta.get('titulo') ?? '';
    let section: Section | null = null;
    const drafts: Draft[] = [];
    for (const { n, text: raw } of body) {
      const line = raw.trim();
      if (line === '') continue;
      if (/^#\s/u.test(line)) {
        if (!title) title = line.slice(2).trim();
        continue;
      }
      if (line.startsWith('## ')) {
        const heading = line.slice(3).trim();
        section = SECTION_NAMES(heading);
        if (!section)
          return fail(n, `parte desconocida «${heading}». Usa "Inicio", "Desarrollo" o "Cierre".`);
        continue;
      }
      if (!section)
        return fail(
          n,
          'texto fuera de una parte. Ponlo bajo "## Inicio", "## Desarrollo" o "## Cierre".',
        );
      // "-" solo es una frase vacía (todavía sin escribir).
      if (line === '-' || line.startsWith('- ')) {
        const draft = this.parsePhrase(line.slice(1).trim(), section, n);
        if (!draft.ok) return draft;
        drafts.push(draft.value);
        continue;
      }
      const last = drafts.at(-1);
      if (!last) return fail(n, 'cada frase empieza con "- " al inicio de la línea.');
      const note = /^>\s?(.*)$/u.exec(line)?.[1];
      if (note !== undefined) last.note.push(note);
      else last.text.push(line);
    }

    return ok({
      title: title || 'Guion importado',
      formatId,
      wordsPerMinute,
      phrases: drafts.map((d): PhraseDocument => ({
        section: d.section,
        shot: d.shot,
        energy: d.energy,
        text: joinText(d.text),
        note: joinText(d.note),
      })),
    });
  }

  private parsePhrase(line: string, section: Section, n: number): Result<Draft, AppError> {
    const { tokens, rest } = takeTokens(line);
    const draft: Draft = {
      section,
      shot: null,
      energy: 'NORMAL',
      text: rest ? [rest] : [],
      note: [],
    };
    for (const token of tokens) {
      const colon = token.indexOf(':');
      const key = colon < 0 ? 'plano' : normalize(token.slice(0, colon));
      const value = colon < 0 ? token : token.slice(colon + 1).trim();
      if (key === 'plano') {
        const shot = SHOT_NAMES(value);
        if (!shot)
          return fail(n, `plano desconocido «${value}» (primer plano, plano medio, b-roll…).`);
        draft.shot = shot;
      } else if (key === 'energia') {
        const energy = ENERGY_NAMES(value);
        if (!energy) return fail(n, `energía desconocida «${value}» (calma, normal o alta).`);
        draft.energy = energy;
      } else {
        return fail(n, `dato desconocido «${key}» en la frase.`);
      }
    }
    return ok(draft);
  }
}
