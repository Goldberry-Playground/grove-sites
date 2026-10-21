/**
 * Kill switch for the order builder (order-builder spec §F): the home-page
 * section and the `/plan` route sit behind `PLANNER_ENABLED`, a plain runtime
 * server env (GOL-3527). Both consumers are server components on routes that
 * already render per request (`dynamic = "force-dynamic"`), so the flag is read
 * on every request: a DO App Platform `RUN_TIME` var flips it with a redeploy,
 * no rebuild, and QA and prod run the same GHCR image with different values.
 *
 * `NEXT_PUBLIC_PLANNER` is accepted as an alias so the local render recipe and
 * the e2e target keep working; it is read at runtime here, not inlined.
 */
const ON = /^(1|true|on|yes)$/i;

type FlagEnv = Record<string, string | undefined>;

export function plannerEnabled(env: FlagEnv = process.env): boolean {
  return ON.test(env.PLANNER_ENABLED ?? env.NEXT_PUBLIC_PLANNER ?? "");
}
