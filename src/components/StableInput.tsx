"use client";
import React, { 
  useState, 
  useEffect, 
  useRef, 
  useLayoutEffect, 
  forwardRef, 
  useImperativeHandle 
} from 'react';

export interface StableInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * StableInput: A controlled input that preserves cursor position, selection range,
 * and Thai IME / composition across React re-renders and debounced asynchronous saves.
 */
export const StableInput = forwardRef<HTMLInputElement, StableInputProps>(function StableInput(
  { value, onChange, onSelect, onKeyUp, onKeyDown, onCompositionStart, onCompositionEnd, ...restProps },
  forwardedRef
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

  const [localValue, setLocalValue] = useState(value);
  const isComposingRef = useRef(false);
  const isSelfTypingRef = useRef(false);
  const cursorRef = useRef<{ start: number | null; end: number | null }>({
    start: null,
    end: null,
  });

  // Keep localValue in sync with incoming value prop when not actively typing/composing
  useEffect(() => {
    const input = inputRef.current;
    const isFocused = input && document.activeElement === input;

    if (!isFocused) {
      if (value !== localValue) {
        setLocalValue(value);
      }
    } else {
      // Focused: Only sync if external value changed (e.g. Clear Fields button or note reload)
      // and user is not in the middle of typing/composing
      if (!isSelfTypingRef.current && !isComposingRef.current) {
        if (value !== localValue) {
          setLocalValue(value);
        }
      }
    }
    isSelfTypingRef.current = false;
  }, [value, localValue]);

  // Restore caret/selection position on layout phase if it jumped or was reset by React render
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (
      input &&
      document.activeElement === input &&
      cursorRef.current.start !== null &&
      !isComposingRef.current
    ) {
      const curStart = input.selectionStart;
      const targetStart = cursorRef.current.start;
      const targetEnd = cursorRef.current.end ?? targetStart;

      if (curStart !== targetStart || input.selectionEnd !== targetEnd) {
        try {
          input.setSelectionRange(targetStart, targetEnd);
        } catch {
          // Ignore if input type doesn't support selectionRange
        }
      }
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    isSelfTypingRef.current = true;
    const newVal = e.target.value;
    cursorRef.current = {
      start: e.target.selectionStart,
      end: e.target.selectionEnd,
    };
    setLocalValue(newVal);
    onChange(newVal);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    cursorRef.current = {
      start: target.selectionStart,
      end: target.selectionEnd,
    };
    onSelect?.(e);
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    cursorRef.current = {
      start: target.selectionStart,
      end: target.selectionEnd,
    };
    onKeyUp?.(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    cursorRef.current = {
      start: target.selectionStart,
      end: target.selectionEnd,
    };
    onKeyDown?.(e);
  };

  const handleCompStart = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = true;
    onCompositionStart?.(e);
  };

  const handleCompEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    isSelfTypingRef.current = true;
    const target = e.currentTarget;
    cursorRef.current = {
      start: target.selectionStart,
      end: target.selectionEnd,
    };
    const val = target.value;
    setLocalValue(val);
    onChange(val);
    onCompositionEnd?.(e);
  };

  return (
    <input
      ref={inputRef}
      value={localValue}
      onChange={handleChange}
      onSelect={handleSelect}
      onKeyUp={handleKeyUp}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompStart}
      onCompositionEnd={handleCompEnd}
      {...restProps}
    />
  );
});
