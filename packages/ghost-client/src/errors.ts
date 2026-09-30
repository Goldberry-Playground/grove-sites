/**
 * Typed failure for every Ghost Content API call (GOL-2788).
 *
 * A post detail route has to tell two very different outcomes apart:
 *
 *   - Ghost answered, and the answer was "no such post" → render a 404.
 *   - Ghost is unreachable / 500ing → render the error state, because
 *     claiming a post does not exist when we simply could not look is a lie,
 *     and it hands search engines a 404 for a page that is actually fine.
 *
 * Before this both arrived as a bare `Error` and the only way to separate them
 * was to sniff `err.message` across a package boundary. `status` carries the
 * HTTP status Ghost gave us (404 for an empty result set, which Ghost reports
 * as a 200 with no rows).
 */
export class GhostError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "GhostError";
    this.status = status;
  }
}

/**
 * True when Ghost answered and the resource genuinely is not there.
 *
 * Duck-typed on `name`/`status` rather than `instanceof`: this package is
 * source-mapped into four Next apps, and a duplicated module instance would
 * silently break `instanceof` and downgrade every 404 into an error state.
 */
export function isGhostNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "GhostError" &&
    (err as { status?: unknown }).status === 404
  );
}
