import Link from "next/link";
import {
  addMonths,
  dateOf,
  daysInMonth,
  firstWeekday,
  formatMonthLabel,
  WEEKDAYS,
} from "@/lib/date";
import type { WorkoutStatus } from "./calendar-types";

type Props = {
  month: string;
  selected: string;
  today: string;
  // 日付 -> その日に存在するステータス
  statusByDate: Map<string, Set<WorkoutStatus>>;
};

export function MonthCalendar({ month, selected, today, statusByDate }: Props) {
  const blanks = firstWeekday(month);
  const days = daysInMonth(month);

  return (
    <section aria-label="月間カレンダー" className="px-2">
      <div className="flex items-center justify-between py-2">
        <Link
          href={`/?month=${addMonths(month, -1)}`}
          aria-label="前の月"
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
        >
          ‹
        </Link>
        <h2 className="text-lg font-bold">{formatMonthLabel(month)}</h2>
        <Link
          href={`/?month=${addMonths(month, 1)}`}
          aria-label="次の月"
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
        >
          ›
        </Link>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-neutral-500">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : ""}`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`b${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = dateOf(month, i + 1);
          const statuses = statusByDate.get(date);
          const isSelected = date === selected;
          const isToday = date === today;
          const label =
            `${i + 1}日` +
            (statuses?.has("done") ? "、実績あり" : "") +
            (statuses?.has("planned") ? "、予定あり" : "");

          return (
            <Link
              key={date}
              href={`/?month=${month}&date=${date}`}
              aria-label={label}
              aria-current={isSelected ? "date" : undefined}
              className={`flex h-14 flex-col items-center justify-start gap-1 rounded-lg pt-1.5 text-sm ${
                isSelected ? "bg-blue-600 text-white" : ""
              } ${isToday && !isSelected ? "font-bold text-blue-600" : ""}`}
            >
              <span>{i + 1}</span>
              <span className="flex h-2 gap-1">
                {statuses?.has("planned") && (
                  <span
                    className={`h-2 w-2 rounded-full border-2 ${
                      isSelected ? "border-white" : "border-amber-500"
                    }`}
                  />
                )}
                {statuses?.has("done") && (
                  <span
                    className={`h-2 w-2 rounded-full ${isSelected ? "bg-white" : "bg-green-600"}`}
                  />
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <p className="flex gap-4 px-2 py-2 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border-2 border-amber-500" />
          予定
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-green-600" />
          実績
        </span>
      </p>
    </section>
  );
}
