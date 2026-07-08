export const VIEWPORTS = ["mobile", "tablet", "desktop"] as const;

export type Viewport = (typeof VIEWPORTS)[number];

export const VIEWPORT_WIDTHS: Record<Viewport, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 1280,
};

export function viewportWidth(v: Viewport): number {
  return VIEWPORT_WIDTHS[v];
}
