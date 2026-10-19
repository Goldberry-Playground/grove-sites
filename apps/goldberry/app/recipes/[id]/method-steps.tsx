"use client";

import { useState } from "react";

/**
 * Method steps a cook can tick off. Each step is a toggle button
 * (`aria-pressed`) so the done state is announced and keyboard operable;
 * done steps also change their numeral colour and fade, never colour alone.
 */
export function MethodSteps({ steps }: { steps: string[] }) {
  const [done, setDone] = useState<boolean[]>(() => steps.map(() => false));
  const toggle = (i: number) => setDone((d) => d.map((v, j) => (j === i ? !v : v)));
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li
          key={i}
          role="button"
          tabIndex={0}
          aria-pressed={done[i]}
          onClick={() => toggle(i)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle(i);
            }
          }}
        >
          <p>
            <span className="sr">Step {i + 1}: </span>
            {s}
          </p>
        </li>
      ))}
    </ol>
  );
}
