"use client";

import { useId, useState } from "react";
import { editor as copy, parts } from "@/lib/copy/en-GB";
import type { WhenValue } from "@/lib/validation";
import { inputClass } from "./ui";

type Choice = "day" | "morning" | "midday" | "evening";

/** Date + rough part of day. A specific time is tucked under "More options". */
export function WhenPicker({
  value,
  onChange,
  label,
}: {
  value: WhenValue;
  onChange: (v: WhenValue) => void;
  label: string;
}) {
  const id = useId();
  const [more, setMore] = useState(value.precision === "exact");
  const choice: Choice = value.precision === "part_of_day" ? (value.part ?? "morning") : "day";

  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`${id}-date`} className="sr-only">
          {copy.date}
        </label>
        <input
          id={`${id}-date`}
          type="date"
          required
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          className={`${inputClass} w-auto`}
        />
        {value.precision !== "exact" && (
          <>
            <label htmlFor={`${id}-part`} className="sr-only">
              {copy.partOfDay}
            </label>
            <select
              id={`${id}-part`}
              value={choice}
              onChange={(e) => {
                const c = e.target.value as Choice;
                onChange(
                  c === "day"
                    ? { date: value.date, precision: "day", part: null, time: null }
                    : { date: value.date, precision: "part_of_day", part: c, time: null },
                );
              }}
              className={`${inputClass} w-auto`}
            >
              <option value="day">{parts.day}</option>
              <option value="morning">{parts.morning}</option>
              <option value="midday">{parts.midday}</option>
              <option value="evening">{parts.evening}</option>
            </select>
          </>
        )}
        {value.precision === "exact" && (
          <>
            <label htmlFor={`${id}-time`} className="sr-only">
              {copy.time}
            </label>
            <input
              id={`${id}-time`}
              type="time"
              required
              value={value.time ?? "09:00"}
              onChange={(e) => onChange({ ...value, precision: "exact", part: null, time: e.target.value })}
              className={`${inputClass} w-auto`}
            />
          </>
        )}
      </div>
      <button
        type="button"
        className="text-xs text-muted hover:text-ink"
        onClick={() => {
          if (more) {
            setMore(false);
            if (value.precision === "exact") onChange({ date: value.date, precision: "day", part: null, time: null });
          } else {
            setMore(true);
          }
        }}
      >
        {more ? copy.fewerOptions : copy.moreOptions}
      </button>
      {more && value.precision !== "exact" && (
        <button
          type="button"
          className="ml-3 text-xs text-accent hover:underline"
          onClick={() => onChange({ date: value.date, precision: "exact", part: null, time: value.time ?? "09:00" })}
        >
          {parts.exact}
        </button>
      )}
    </fieldset>
  );
}
