"use client";
import * as Popover from "@radix-ui/react-popover";
import { format } from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { Button } from "./button";
export function DatePicker({
  value,
  onChange,
}: {
  value?: Date | undefined;
  onChange: (date: Date | undefined) => void;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="secondary"
          className="date-trigger"
          aria-label="Choose appointment date"
        >
          <CalendarDays size={18} />
          <span>{value ? format(value, "EEEE, MMMM d, yyyy") : "Choose a date"}</span>
          <ChevronDown size={16} />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="calendar-popover" sideOffset={8} align="start">
          <DayPicker
            mode="single"
            selected={value}
            onSelect={onChange}
            disabled={{ before: new Date() }}
            showOutsideDays
          />
          <Popover.Arrow className="popover-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
