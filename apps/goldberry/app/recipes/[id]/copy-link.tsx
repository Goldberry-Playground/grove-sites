"use client";

import { useEffect, useRef, useState } from "react";

/** "Copy link" with a short confirmation toast; falls back to a hint when the clipboard is blocked. */
export function CopyLink() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const show = (m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2200);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      show("Link copied");
    } catch {
      show("Copy the link from the address bar");
    }
  };
  return (
    <>
      <button type="button" onClick={copy}>
        Copy link
      </button>
      <div className="toast" role="status" hidden={!msg}>
        {msg}
      </div>
    </>
  );
}
