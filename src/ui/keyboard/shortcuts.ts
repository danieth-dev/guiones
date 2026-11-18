/** Acciones sobre una frase disparables por teclado (patrón Command). */
export type ShortcutCommand =
  'MOVE_UP' | 'MOVE_DOWN' | 'NEW_PHRASE_AFTER' | 'SPLIT' | 'RECORD' | 'PLAY' | 'DICTATE';

/** Lo mínimo de un KeyboardEvent: permite probar los atajos sin DOM. */
export interface KeyChord {
  readonly key: string;
  /** Tecla física ("KeyR"): estable aunque Alt cambie el carácter (macOS). */
  readonly code: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}

export interface Shortcut {
  readonly command: ShortcutCommand;
  /** Texto para mostrar en tooltips y en la ayuda. */
  readonly hint: string;
  matches(chord: KeyChord): boolean;
}

const primary = (c: KeyChord): boolean => c.ctrlKey || c.metaKey;
const altOnly = (c: KeyChord): boolean => c.altKey && !primary(c) && !c.shiftKey;
const altLetter = (letter: string) => (c: KeyChord) => altOnly(c) && c.code === `Key${letter}`;

export const SHORTCUTS: readonly Shortcut[] = [
  { command: 'MOVE_UP', hint: 'Alt + ↑', matches: (c) => altOnly(c) && c.key === 'ArrowUp' },
  { command: 'MOVE_DOWN', hint: 'Alt + ↓', matches: (c) => altOnly(c) && c.key === 'ArrowDown' },
  {
    command: 'SPLIT',
    hint: 'Ctrl + Shift + Enter',
    matches: (c) => primary(c) && c.shiftKey && c.key === 'Enter',
  },
  {
    command: 'NEW_PHRASE_AFTER',
    hint: 'Ctrl + Enter',
    matches: (c) => primary(c) && !c.shiftKey && c.key === 'Enter',
  },
  { command: 'RECORD', hint: 'Alt + R', matches: altLetter('R') },
  { command: 'PLAY', hint: 'Alt + P', matches: altLetter('P') },
  { command: 'DICTATE', hint: 'Alt + D', matches: altLetter('D') },
];

export const matchShortcut = (chord: KeyChord): ShortcutCommand | null =>
  SHORTCUTS.find((shortcut) => shortcut.matches(chord))?.command ?? null;

export const hintFor = (command: ShortcutCommand): string =>
  SHORTCUTS.find((s) => s.command === command)?.hint ?? '';
