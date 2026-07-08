import { getChecks, registerCheck } from "./registry";
import { viewportCheck } from "./viewport";

registerCheck(viewportCheck);

export { getChecks };
export type { Check, CheckControlProps } from "./types";
