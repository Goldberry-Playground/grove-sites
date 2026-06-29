import { previewSrc } from "../lib/bundle";
import type { Brand } from "../lib/brands";
import { viewportWidth } from "../lib/viewport";

export function PreviewFrame({ brand, component }: { brand: Brand; component: string }) {
  return (
    <figure className="preview">
      <figcaption>{component}</figcaption>
      <div className="preview-stage">
        <iframe
          title={`${brand} ${component} preview`}
          src={previewSrc(brand, component)}
          style={{ width: viewportWidth("desktop"), maxWidth: "100%" }}
          height={460}
          loading="lazy"
        />
      </div>
    </figure>
  );
}
