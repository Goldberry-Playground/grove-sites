export const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep to Jan" for a deer plot, walking the season from August round. */
export function dropSpan(months: readonly number[]): string | null {
  if (months.length === 0) return null;
  const order = [8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7];
  const present = order.filter((m) => months.includes(m));
  const first = present[0];
  const last = present[present.length - 1];
  return first === last ? MONTHS[first] : `${MONTHS[first]} to ${MONTHS[last]}`;
}
