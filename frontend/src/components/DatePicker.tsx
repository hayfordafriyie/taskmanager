import { useMemo, useState } from "react";
import { Popover } from "radix-ui";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@radix-ui/react-icons";
import type { DatePickerProps, MonthCursor } from "../types/dates";
import {
  MONTH_NAMES,
  WEEKDAYS,
  formatDisplayDate,
  monthGrid,
  parseDateValue,
  toDateValue,
} from "../lib/calendar";

// Radix has no date-picker primitive, so this composes Radix Popover (focus
// management, Esc/outside-click, portal + collision handling) with an
// accessible month grid. Values are plain "YYYY-MM-DD" strings and all date
// maths is done in UTC so a timezone can never shift a day.

export function DatePicker({
  value = "",
  onChange,
  min = "",
  max = "",
  ariaLabel,
  placeholder = "Select date",
  disabled = false,
  className = "",
}: DatePickerProps) {
  const selected = parseDateValue(value);
  const [open, setOpen] = useState<boolean>(false);
  const [cursor, setCursor] = useState<MonthCursor>(() => {
    const base = selected || new Date();
    return { year: base.getUTCFullYear(), month: base.getUTCMonth() };
  });

  const weeks = useMemo(
    () => monthGrid(cursor.year, cursor.month),
    [cursor],
  );

  const shiftMonth = (delta: number) => {
    setCursor((c: MonthCursor): MonthCursor => {
      const next = new Date(Date.UTC(c.year, c.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  };

  const minDate = parseDateValue(min);
  const maxDate = parseDateValue(max);
  const todayValue = toDateValue(new Date());

  const isDisabledDay = (day: Date): boolean => {
    if (minDate && day.getTime() < minDate.getTime()) return true;
    if (maxDate && day.getTime() > maxDate.getTime()) return true;
    return false;
  };

  const pick = (day: Date) => {
    onChange?.(toDateValue(day));
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          className={`control flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm disabled:opacity-60 ${className}`}
        >
          <span className={value ? "t-ink" : "t-faint"}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
          <CalendarIcon width={14} height={14} className="shrink-0 opacity-60" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="glass-pop z-[130] w-[17rem] rounded-xl p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              className="btn-gloss-ghost grid h-7 w-7 place-items-center rounded-full"
            >
              <ChevronLeftIcon width={13} height={13} />
            </button>
            <p
              aria-live="polite"
              className="font-display text-sm font-semibold t-ink"
            >
              {MONTH_NAMES[cursor.month]} {cursor.year}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              className="btn-gloss-ghost grid h-7 w-7 place-items-center rounded-full"
            >
              <ChevronRightIcon width={13} height={13} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] t-faint">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {weeks.flat().map((day, index) => {
              if (!day) {
                // Keeps the 7-column rhythm for padding cells.
                return <span key={`pad-${index}`} aria-hidden="true" />;
              }
              const dayValue = toDateValue(day);
              const isSelected = dayValue === value;
              const disabledDay = isDisabledDay(day);
              return (
                <button
                  key={dayValue}
                  type="button"
                  onClick={() => pick(day)}
                  disabled={disabledDay}
                  aria-label={formatDisplayDate(dayValue)}
                  aria-pressed={isSelected}
                  data-today={dayValue === todayValue ? "true" : undefined}
                  className={`h-8 rounded-lg text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                    isSelected
                      ? "bg-[var(--accent-tint)] font-semibold t-ink"
                      : "hover:bg-[var(--glass-hover)] t-soft"
                  } ${dayValue === todayValue && !isSelected ? "ring-1 ring-[var(--border-soft)]" : ""}`}
                >
                  {day.getUTCDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-2">
            <button
              type="button"
              className="btn-gloss-ghost rounded-full px-3 py-1 text-xs"
              onClick={() => {
                const today = new Date();
                const todayIso = toDateValue(today);
                setCursor({
                  year: today.getUTCFullYear(),
                  month: today.getUTCMonth(),
                });
                if (!isDisabledDay(today)) onChange?.(todayIso);
                setOpen(false);
              }}
            >
              Today
            </button>
            <button
              type="button"
              className="btn-gloss-ghost rounded-full px-3 py-1 text-xs"
              onClick={() => {
                onChange?.("");
                setOpen(false);
              }}
            >
              Clear
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default DatePicker;
