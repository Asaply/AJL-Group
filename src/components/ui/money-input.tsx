"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { caretAfterFormat, finalizeMoneyInput, formatMoneyInput, unformatMoney } from "@/lib/money-input";

type MoneyInputProps = Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  name: string;
  defaultValue?: number | string | null;
};

/**
 * Text input that shows "1,234.50" while typing but submits the plain number
 * ("1234.5") under `name` through a hidden input, so server actions parse it as before.
 */
export function MoneyInput({ name, defaultValue, onBlur, ...props }: MoneyInputProps) {
  const [display, setDisplay] = React.useState(() =>
    defaultValue === null || defaultValue === undefined ? "" : finalizeMoneyInput(String(defaultValue))
  );
  const inputRef = React.useRef<HTMLInputElement>(null);
  const caretRef = React.useRef<number | null>(null);

  React.useLayoutEffect(() => {
    if (caretRef.current === null || !inputRef.current) return;
    inputRef.current.setSelectionRange(caretRef.current, caretRef.current);
    caretRef.current = null;
  }, [display]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const formatted = formatMoneyInput(raw);
    caretRef.current = caretAfterFormat(raw, e.target.selectionStart ?? raw.length, formatted);
    setDisplay(formatted);
  }

  return (
    <>
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        onBlur={(e) => {
          setDisplay(finalizeMoneyInput(display));
          onBlur?.(e);
        }}
      />
      <input type="hidden" name={name} value={unformatMoney(display)} />
    </>
  );
}
