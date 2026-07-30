"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
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

/** The only date shape that crosses a form boundary — matches every `DATE_RE` zod field. */
export const DATE_VALUE_FORMAT = "yyyy-MM-dd";

/**
 * `yyyy-MM-dd` → local `Date`, or `undefined` when the string isn't a real day.
 *
 * date-fns `parse` builds the date in the local zone, so unlike
 * `new Date("2026-08-01")` (parsed as UTC midnight, then rendered a day earlier
 * west of Greenwich) a round trip through the calendar never shifts the day.
 * The re-`format` guard rejects the values `parse` is lenient about.
 */
export function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, DATE_VALUE_FORMAT, new Date());
  if (!isValid(parsed)) return undefined;
  return format(parsed, DATE_VALUE_FORMAT) === value ? parsed : undefined;
}

/** `Date` → the `yyyy-MM-dd` string stored in forms and URLs. */
export function formatDateValue(date: Date): string {
  return format(date, DATE_VALUE_FORMAT);
}

interface DatePickerProps extends Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type"
> {
  /** Controlled `yyyy-MM-dd` value. Omit to run uncontrolled off `defaultValue`. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /**
   * Accessible name for the calendar button. Must be unique on the page, and must
   * not *contain* the field's own label as a substring — Playwright's
   * `getByLabel` matches substrings, so "Open release date calendar" next to a
   * "Release date" field makes every existing query ambiguous. Reword instead
   * ("Open publish day calendar").
   */
  triggerLabel?: string;
}

/**
 * Typed `yyyy-MM-dd` field plus a themed calendar popover, replacing
 * `<input type="date">` everywhere (#86). The visible input carries `name`, so
 * a surrounding `<form action>` serializes exactly the string the server
 * actions and zod schemas already expect — no hidden mirror field, no parsing
 * on the way out. Native pickers were dropped because their popovers are
 * unthemed, OS-dependent white surfaces.
 */
export function DatePicker({
  value,
  defaultValue,
  onChange,
  className,
  disabled,
  triggerLabel = "Open calendar",
  placeholder = "yyyy-mm-dd",
  ...props
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");

  const current = value ?? uncontrolled;
  const selected = parseDateValue(current);

  function commit(next: string) {
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
  }

  return (
    <InputGroup data-slot="date-picker" className={cn("w-full", className)}>
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
            <CalendarIcon />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-0">
            <Calendar
              mode="single"
              autoFocus
              selected={selected}
              defaultMonth={selected}
              onSelect={(date) => {
                if (!date) return;
                commit(formatDateValue(date));
                setOpen(false);
              }}
              // Roomier cells on touch, back to the compact default from `sm` up.
              className="[--cell-size:--spacing(9)] sm:[--cell-size:--spacing(8)]"
            />
          </PopoverContent>
        </Popover>
      </InputGroupAddon>
    </InputGroup>
  );
}
