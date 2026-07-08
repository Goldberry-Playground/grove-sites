import type { ComponentType, RefObject } from "react";
import type { Viewport } from "../lib/viewport";

export interface CheckControlProps {
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
  frameRef: RefObject<HTMLIFrameElement | null>;
}

/**
 * A check is one entry in the inspection rail. It declares a label and a
 * Control rendered per-preview. Future checks (axe, contrast, vision-sim) use
 * `frameRef` to measure the live iframe; the shipped viewport check only drives
 * `setViewport`. Registering a new check requires no shell changes.
 */
export interface Check {
  id: string;
  label: string;
  Control: ComponentType<CheckControlProps>;
}
