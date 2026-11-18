/**
 * Pasa a minúsculas y quita tildes carácter por carácter, conservando la
 * longitud del texto para que los índices sigan apuntando al original.
 */
export const foldPreservingLength = (text: string): string =>
  Array.from(text, (char) => {
    const folded = char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    return folded.length === char.length ? folded : char.toLowerCase();
  }).join('');

export const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/gu, (match) => `\\${match}`);
