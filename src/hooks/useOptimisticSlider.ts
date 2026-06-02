import { useState, useEffect, useRef, useCallback } from "react";

export function useOptimisticSlider(
  value: number,
  onChange: (val: number) => void,
  debounceMs: number = 200
) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync localValue with external value changes if not actively dragging
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (newVal: number) => {
      setLocalValue(newVal);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        onChange(newVal);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  const handlePointerUp = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onChange(localValue);
  }, [localValue, onChange]);

  return {
    value: localValue,
    onChange: handleChange,
    onPointerUp: handlePointerUp,
  };
}
