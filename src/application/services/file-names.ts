/** "Por qué nadie ve tus Reels!" → "por-que-nadie-ve-tus-reels". */
export const slugify = (title: string): string =>
  title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60) || 'guion';
