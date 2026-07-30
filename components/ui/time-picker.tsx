"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The only time shape that crosses a form boundary — matches every `TIME_RE` zod field. */
export function isTimeValue(value: string): boolean {
  return TIME_RE.test(value);
}

/** Every `HH:mm` on a `stepMinutes` grid across one day, for the popover list. */
export function timeOptions(stepMinutes = 30): string[] {
  const options: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    options.push(`${hh}:${mm}`);
  }
  return options;
}

interface TimePickerProps extends Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type"
> {
  /** Controlled `HH:mm` value. Omit to run uncontrolled off `defaultValue`. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /**
   * Accessible name for the clock button. Must be unique on the page, and must
   * not *contain* the field's own label as a substring — Playwright's
   * `getByLabel` matches substrings, so "Open release date calendar" next to a
   * "Release date" field makes every existing query ambiguous. Reword instead
   * ("Open publish day calendar").
   */
  triggerLabel?: string;
  /** Spacing of the offered times, in minutes. Typing is never restricted to the grid. */
  step?: number;
}

/**
 * Typed `HH:mm` field plus a themed list of times, the companion to
 * {@link DatePicker} and the replacement for `<input type="time">` (#86).
 * The list is a convenience only — any valid 24h time can still be typed, which
 * keeps keyboard entry exactly as fast as the native control was.
 */
export function TimePicker({
  value,
  defaultValue,
  onChange,
  className,
  disabled,
  triggerLabel = "Choose time",
  placeholder = "hh:mm",
  step = 30,
  ...props
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");

  const current = value ?? uncontrolled;
  const options = React.useMemo(() => timeOptions(step), [step]);

  function commit(next: string) {
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
  }

  // Focus the current time on open instead of letting Base UI land on the
  // first tabbable option: 48 options is a long scroll to reach an evening
  // slot from midnight, and focusing it scrolls it into view for free. Falls
  // back to the default when the typed value isn't on the grid.
  const selectedOptionRef = React.useRef<HTMLButtonElement>(null);

  return (
    <InputGroup data-slot="time-picker" className={cn("w-full", className)}>
      <InputGroupInput
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={current}
        onChange={(event) => commit(event.target.value)}
        className="font-mono tabular-nums"
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <InputGroupButton
                size="icon-xs"
                aria-label={triggerLabel}
                disabled={disabled}
              />
            }
          >
            <Clock />
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-auto p-1"
            initialFocus={selectedOptionRef}
          >
            <div
              role="listbox"
              aria-label={triggerLabel}
              className="flex max-h-60 w-28 flex-col gap-0.5 overflow-y-auto"
            >
              {options.map((option) => {
                const isSelected = option === current;
                return (
                  <button
                    key={option}
                    ref={isSelected ? selectedOptionRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-selected={isSelected}
                    onClick={() => {
                      commit(option);
                      setOpen(false);
                    }}
                    className="flex h-9 shrink-0 items-center rounded-md px-2.5 text-left font-mono text-sm tabular-nums transition-colors outline-none hover:bg-muted focus-visible:bg-muted data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground sm:h-8"
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  );
}
