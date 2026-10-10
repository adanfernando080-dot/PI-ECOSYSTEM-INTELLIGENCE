/** Dates calendaires pures (le noyau n'a pas d'horloge ni de Date : toute date est fournie par l'appelant). */
export function dayNumber(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Date invalide : ${iso}`);
  let y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error(`Date invalide : ${iso}`);
  y -= mo <= 2 ? 1 : 0;
  const era = Math.floor(y / 400); const yoe = y - era * 400;
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);
