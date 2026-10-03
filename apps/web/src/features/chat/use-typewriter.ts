"use client";

import { useEffect, useState } from "react";

/** Progressive reveal of completed text — pairs with request/response chat APIs. */
export function useTypewriter(text: string, enabled: boolean, cps = 42) {
  const [shown, setShown] = useState(enabled ? "" : text);
  const [done, setDone] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setShown(text);
      setDone(true);
      return;
    }
    setShown("");
    setDone(false);
    if (!text) return;

    let i = 0;
    const step = Math.max(1, Math.ceil(text.length / 180));
    const id = window.setInterval(() => {
      i = Math.min(text.length, i + step);
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, Math.max(12, Math.floor(1000 / cps)));

    return () => window.clearInterval(id);
  }, [text, enabled, cps]);

  return { shown, done };
}
