import { useEffect, RefObject } from 'react';

export const useClickOutside = (
  ref: RefObject<HTMLElement | null> | Array<RefObject<HTMLElement | null>>,
  handler: (event: MouseEvent | TouchEvent) => void,
  active = true
) => {
  useEffect(() => {
    if (!active) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (Array.isArray(ref)) {
        const isInside = ref.some((r) => r.current && r.current.contains(target));
        if (isInside) return;
      } else {
        const el = ref?.current;
        if (!el || el.contains(target)) {
          return;
        }
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, active]);
};
