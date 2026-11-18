/** "4,5 s". */
export const formatSeconds = (seconds: number): string =>
  `${seconds.toLocaleString('es', { maximumFractionDigits: 1 })} s`;

/** "0:42", "6:10". */
export const formatClock = (seconds: number): string => {
  const total = Math.round(seconds);
  return `${String(Math.floor(total / 60))}:${String(total % 60).padStart(2, '0')}`;
};
