/**
 * Formats milliseconds into a clean human-readable string.
 * Examples: 3661000 → "1hr 1m"  |  60000 → "1m"  |  5000 → "5s"
 */
export function formatMs(ms: number | null | undefined, verbose = false): string {
  if (ms == null || isNaN(ms) || ms < 0) return '0s';

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (verbose) {
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
    return parts.join(' ');
  }

  if (hours > 0 && minutes > 0) return `${hours}hr ${minutes}m`;
  if (hours > 0) return `${hours}hr`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Formats hours (decimal) into a readable string.
 * Example: 0.3 → "18m" | 1.5 → "1hr 30m"
 */
export function formatHours(hoursDecimal: number): string {
  const ms = hoursDecimal * 3600000;
  return formatMs(ms);
}