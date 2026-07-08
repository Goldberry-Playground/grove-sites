"use client";

import { useRef, useState } from "react";
import { previewSrc } from "../lib/preview-src";
import type { Brand } from "../lib/brands";
import { viewportWidth, type Viewport } from "../lib/viewport";
import { getChecks } from "../checks";

export function PreviewFrame({ brand, component }: { brand: Brand; component: string }) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  return (
    <figure className="preview">
      <figcaption>{component}</figcaption>
      <div className="preview-rail">
        {getChecks().map((check) => (
          <check.Control
            key={check.id}
            viewport={viewport}
            setViewport={setViewport}
            frameRef={frameRef}
          />
        ))}
      </div>
      <div className="preview-stage">
        <iframe
          ref={frameRef}
          title={`${brand} ${component} preview`}
          src={previewSrc(brand, component)}
          style={{ width: viewportWidth(viewport), maxWidth: "100%" }}
          height={460}
          loading="lazy"
        />
      </div>
    </figure>
  );
}
