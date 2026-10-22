"use client";

import { useEffect, useRef, useState } from "react";

type Source = { src: string; type: string };

/**
 * The manifesto's background drone loop, loaded only when it is about to be
 * seen (GOL-3585).
 *
 * As a plain `<video autoPlay>` it was the heaviest thing on the farm homepage:
 * the browser fetched the 2.1 MB webm at page load for a section that sits
 * below the fold on every viewport (Lighthouse mobile 64, 5.0 MB page). Here the
 * poster paints immediately and the `<source>` elements are only attached once
 * the section comes within 200 px of the viewport.
 *
 * Never attached at all when the visitor asked for less: `prefers-reduced-motion`
 * (globals.css already swaps the video for the still poster) or Save-Data.
 */
export function DroneLoop({ poster, sources }: { poster: string; sources: Source[] }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (saveData || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Sources added after mount are not picked up until load() runs.
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    el.load();
    el.play().catch(() => {
      // Autoplay refused (e.g. low-power mode): the poster stays, which is fine.
    });
  }, [active]);

  return (
    <video
      ref={ref}
      className="manifesto-video__el"
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
      poster={poster}
    >
      {active && sources.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
    </video>
  );
}
