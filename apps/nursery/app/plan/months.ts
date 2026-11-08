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

/**
 * "Jul to Sep" for a harvest. The run is read off the calendar and only wraps
 * December into January when the months actually straddle New Year ("Nov to
 * Jan"); a single month is just that month. `dropSpan` walks the year from
 * August for a deer plot, which splits a summer crop into "Aug to Jul", so
 * food and agroforestry cards use this one (GOL-3835).
 */
export function harvestSpan(months: readonly number[]): string | null {
  const present = [...new Set(months)]
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
    .sort((a, b) => a - b);
  if (present.length === 0) return null;
  if (present.length === 1) return MONTHS[present[0]];
  // Start the span just after the widest empty stretch of the calendar, so
  // [11, 12, 1] reads "Nov to Jan" while [7, 8, 9] stays "Jul to Sep". Ties
  // fall back to calendar order.
  let start = 0;
  let widest = -1;
  for (let i = 0; i < present.length; i++) {
    const next = present[(i + 1) % present.length];
    const gap = (next - present[i] + 12) % 12;
    if (gap >= widest) {
      widest = gap;
      start = (i + 1) % present.length;
    }
  }
  const first = present[start];
  const last = present[(start + present.length - 1) % present.length];
  return `${MONTHS[first]} to ${MONTHS[last]}`;
}
