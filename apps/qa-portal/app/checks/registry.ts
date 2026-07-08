import type { Check } from "./types";

const checks: Check[] = [];

export function registerCheck(check: Check): void {
  if (checks.some((c) => c.id === check.id)) {
    throw new Error(`check already registered: ${check.id}`);
  }
  checks.push(check);
}

export function getChecks(): readonly Check[] {
  return checks;
}
