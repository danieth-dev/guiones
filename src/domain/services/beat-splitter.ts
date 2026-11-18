import { domainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';
import { SpokenText } from '../script/spoken-text';
import { foldPreservingLength } from './text-folding';

/** Conectores orales ante los que es natural tomar aire (el conector pasa al segundo beat). */
const BREATH_CONNECTORS: readonly (readonly string[])[] = [
  ['pero'],
  ['porque'],
  ['entonces'],
  ['aunque'],
  ['mientras'],
  ['cuando'],
  ['ademas'],
  ['y', 'luego'],
  ['asi', 'que'],
  ['por', 'eso'],
  ['sin', 'embargo'],
];

const PAUSE_PUNCTUATION = /[,.;:!?…]$/u;
const TRAILING_SOFT_PUNCTUATION = /[,;]+$/u;
const EDGE_PUNCTUATION = /^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu;

export interface SplitResult {
  readonly first: SpokenText;
  readonly second: SpokenText;
}

const bareWord = (token: string): string =>
  foldPreservingLength(token).replace(EDGE_PUNCTUATION, '');

const startsWithConnector = (tokens: readonly string[], index: number): boolean =>
  BREATH_CONNECTORS.some((connector) =>
    connector.every((word, offset) => {
      const token = tokens[index + offset];
      return token !== undefined && bareWord(token) === word;
    }),
  );

const capitalize = (text: string): string => text.charAt(0).toLocaleUpperCase('es') + text.slice(1);

/**
 * Divide un beat en dos respiraciones. Prefiere cortar en una pausa natural
 * (puntuación o conector oral) lo más cerca posible del centro; si no hay
 * ninguna, corta por la mitad.
 */
export const splitBeatText = (text: SpokenText): Result<SplitResult> => {
  const tokens = text.value.split(' ').filter((t) => t !== '');
  if (tokens.length < 2) {
    return err(
      domainError('CANNOT_SPLIT', 'Un beat necesita al menos dos palabras para dividirse.'),
    );
  }

  const middle = tokens.length / 2;
  let bestCut = Math.floor(middle);
  let bestDistance = Number.POSITIVE_INFINITY;

  // `cut` = cantidad de tokens que quedan en el primer beat.
  for (let cut = 1; cut < tokens.length; cut++) {
    const previous = tokens[cut - 1] ?? '';
    const isNaturalPause = PAUSE_PUNCTUATION.test(previous) || startsWithConnector(tokens, cut);
    const distance = Math.abs(cut - middle);
    if (isNaturalPause && distance < bestDistance) {
      bestCut = cut;
      bestDistance = distance;
    }
  }

  const first = tokens.slice(0, bestCut).join(' ').replace(TRAILING_SOFT_PUNCTUATION, '');
  const second = capitalize(tokens.slice(bestCut).join(' '));
  return ok({ first: SpokenText.of(first), second: SpokenText.of(second) });
};
