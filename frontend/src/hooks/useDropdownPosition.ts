import { useState, useLayoutEffect, useCallback, RefObject } from 'react';

export interface DropdownPositionStyle {
  position: 'fixed';
  top?: string;
  bottom?: string;
  left: string;
  width: string;
  maxHeight: string;
  zIndex: number;
  transformOrigin?: string;
}

export interface UseDropdownPositionOptions {
  minWidth?: number;
  offset?: number;
}

export const useDropdownPosition = (
  triggerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  options?: UseDropdownPositionOptions
): DropdownPositionStyle | null => {
  const minWidth = options?.minWidth ?? 280;
  const offset = options?.offset ?? 6;

  const calculatePosition = useCallback((): DropdownPositionStyle | null => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Trigger is completely offscreen
    if (rect.bottom < 0 || rect.top > viewportHeight) {
      return null;
    }

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Prefer opening downwards, but flip upwards if space below is too tight (< 220px)
    // and space above provides more room
    const openUpwards = spaceBelow < 220 && spaceAbove > spaceBelow;

    const availableHeight = openUpwards
      ? Math.max(160, Math.min(320, spaceAbove - offset - 16))
      : Math.max(160, Math.min(320, spaceBelow - offset - 16));

    const computedWidth = Math.max(rect.width, Math.min(minWidth, viewportWidth - 16));
    let left = rect.left;
    if (left + computedWidth > viewportWidth - 8) {
      left = Math.max(8, viewportWidth - computedWidth - 8);
    }

    return {
      position: 'fixed',
      left: `${Math.round(left)}px`,
      width: `${Math.round(Math.min(computedWidth, viewportWidth - 16))}px`,
      ...(openUpwards
        ? {
            bottom: `${Math.round(viewportHeight - rect.top + offset)}px`,
            top: 'auto',
            transformOrigin: 'bottom',
          }
        : {
            top: `${Math.round(rect.bottom + offset)}px`,
            bottom: 'auto',
            transformOrigin: 'top',
          }),
      maxHeight: `${Math.round(availableHeight)}px`,
      zIndex: 9999,
    };
  }, [triggerRef, minWidth, offset]);

  const [dropdownStyle, setDropdownStyle] = useState<DropdownPositionStyle | null>(() => {
    return isOpen ? calculatePosition() : null;
  });

  useLayoutEffect(() => {
    if (!isOpen) {
      setDropdownStyle(null);
      return;
    }

    // Synchronously calculate position before browser paint
    const initialPos = calculatePosition();
    if (initialPos) {
      setDropdownStyle(initialPos);
    }

    const handleUpdate = () => {
      const pos = calculatePosition();
      if (pos) {
        setDropdownStyle(pos);
      }
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen, calculatePosition]);

  return dropdownStyle;
};
