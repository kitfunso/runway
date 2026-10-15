'use client';

import { useEffect, useRef, useState } from 'react';

// Eases the shown value from wherever it is now to `target`, so money figures count, never jump.
export function useTween(target: number, duration = 400): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const next = start + (target - start) * (1 - Math.pow(1 - t, 3));
      from.current = next;
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
