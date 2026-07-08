"use client";

import { VIEWPORTS } from "../lib/viewport";
import type { Check, CheckControlProps } from "./types";

function ViewportControl({ viewport, setViewport }: CheckControlProps) {
  return (
    <div className="check-viewport" role="group" aria-label="Viewport">
      {VIEWPORTS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={viewport === v}
          onClick={() => setViewport(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export const viewportCheck: Check = {
  id: "viewport",
  label: "Viewport",
  Control: ViewportControl,
};
