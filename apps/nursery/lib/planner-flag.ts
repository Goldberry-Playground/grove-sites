/**
 * Kill switch for the order builder (order-builder spec §F): the home-page
 * section and the `/plan` route sit behind `NEXT_PUBLIC_PLANNER`, baked at
 * image build. A `NEXT_PUBLIC_*` value on the DO App spec is inert at runtime,
 * so flipping it is a rebuild, not a redeploy; Josh flips it for prod.
 */
export const PLANNER_ENABLED = /^(1|true|on|yes)$/i.test(process.env.NEXT_PUBLIC_PLANNER ?? "");
