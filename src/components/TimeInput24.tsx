import React, { useEffect, useState } from 'react';

/** True for a complete 24-hour time such as "07:05" or "18:49". */
export function isValidTime24(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Turns typed digits into HH:MM as the user types: "1849" → "18:49", "905" → "9:05" until complete. */
export function formatTimeTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}`;
}

/** On leaving the field, pad a short entry: "905" → "09:05", "7" → "07:00". */
export function normaliseTime(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `${digits.padStart(2, '0')}:00`;
  const padded = digits.slice(0, 4).padStart(4, '0');
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

interface TimeInput24Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
  required?: boolean;
}

/**
 * A 24-hour time field. Unlike the browser's time picker, it never switches to a 12-hour clock with
 * a hidden AM/PM, whatever the device's language settings are.
 */
export const TimeInput24: React.FC<TimeInput24Props> = ({ value, onChange, className = '', ariaLabel, required }) => {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const invalid = text !== '' && !isValidTime24(text);

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:MM"
      aria-label={ariaLabel}
      aria-invalid={invalid}
      required={required}
      maxLength={5}
      value={text}
      onChange={(e) => {
        const next = formatTimeTyping(e.target.value);
        setText(next);
        if (isValidTime24(next)) onChange(next);
      }}
      onBlur={() => {
        const next = normaliseTime(text);
        setText(next);
        onChange(next);
      }}
      className={`${/\bw-/.test(className) ? '' : 'w-[5.5rem]'} font-mono tabular-nums ${invalid ? 'border-rose-500' : ''} ${className}`}
    />
  );
};
