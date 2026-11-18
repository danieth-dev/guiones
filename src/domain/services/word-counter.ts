/**
 * Cuenta palabras *habladas* en español: lo que importa es cuánto se tarda en
 * decirlo, no cuántos tokens hay escritos. "1.500" se dice "mil quinientos" (2),
 * "30%" se dice "treinta por ciento" (3) y un emoji no se dice (0).
 */

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const PUNCTUATION_OR_SYMBOL = /[\p{P}\p{S}]/u;
const NUMBER_TOKEN = /^([$€£])?(\d+(?:[.,]\d+)*)(%)?$/u;
const THOUSANDS_GROUPED = /^\d{1,3}(?:[.,]\d{3})+$/u;

/** Símbolos que se pronuncian y por tanto no se recortan de los bordes. */
const MEANINGFUL_SYMBOLS = new Set(['$', '€', '£', '%', '&', '+', '=']);

/** Palabras que se pronuncian al decir un símbolo suelto. */
const SPOKEN_SYMBOLS: Readonly<Record<string, number>> = {
  '&': 1, // "y"
  '+': 1, // "más"
  '=': 1, // "igual"
  '%': 2, // "por ciento"
  $: 1,
  '€': 1,
  '£': 1,
};

/** Número de palabras con que se lee un entero no negativo en español. */
export const spokenWordsForInteger = (n: number): number => {
  if (n <= 30) return 1; // cero…treinta (16-29 son una sola palabra: "dieciséis", "veintiuno")
  if (n < 100) return n % 10 === 0 ? 1 : 3; // "cuarenta" | "cuarenta y dos"
  if (n < 1_000) {
    const rest = n % 100;
    return 1 + (rest > 0 ? spokenWordsForInteger(rest) : 0); // "ciento" + resto
  }
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1_000);
    const rest = n % 1_000;
    const head = thousands === 1 ? 1 : spokenWordsForInteger(thousands) + 1; // "mil" | "dos mil"
    return head + (rest > 0 ? spokenWordsForInteger(rest) : 0);
  }
  const millions = Math.floor(n / 1_000_000);
  const rest = n % 1_000_000;
  const head = millions === 1 ? 2 : spokenWordsForInteger(millions) + 1; // "un millón" | "dos millones"
  return head + (rest > 0 ? spokenWordsForInteger(rest) : 0);
};

const spokenWordsForNumeral = (digits: string): number => {
  if (THOUSANDS_GROUPED.test(digits)) {
    return spokenWordsForInteger(Number(digits.replace(/[.,]/gu, '')));
  }
  const [integerPart = '0', decimalPart] = digits.split(/[.,]/u);
  const integerWords = spokenWordsForInteger(Number(integerPart));
  return decimalPart === undefined
    ? integerWords
    : integerWords + 1 + spokenWordsForInteger(Number(decimalPart)); // "dos coma cinco"
};

const isStrippable = (char: string): boolean =>
  PUNCTUATION_OR_SYMBOL.test(char) && !MEANINGFUL_SYMBOLS.has(char);

/** Quita comillas, signos de puntuación, emojis, etc. de los bordes del token. */
const trimEdges = (token: string): string => {
  const chars = Array.from(token);
  let start = 0;
  let end = chars.length;
  while (start < end && isStrippable(chars[start] ?? '')) start++;
  while (end > start && isStrippable(chars[end - 1] ?? '')) end--;
  return chars.slice(start, end).join('');
};

const spokenWordsForToken = (rawToken: string): number => {
  const token = trimEdges(rawToken);
  if (token === '') return 0;

  const symbolWords = SPOKEN_SYMBOLS[token];
  if (symbolWords !== undefined) return symbolWords;

  const numeric = NUMBER_TOKEN.exec(token);
  if (numeric) {
    const [, currency, digits = '0', percent] = numeric;
    return (currency ? 1 : 0) + spokenWordsForNumeral(digits) + (percent ? 2 : 0);
  }

  return LETTER_OR_DIGIT.test(token) ? 1 : 0;
};

export const countSpokenWords = (text: string): number =>
  text
    .split(/\s+/u)
    .filter((token) => token !== '')
    .reduce((total, token) => total + spokenWordsForToken(token), 0);
