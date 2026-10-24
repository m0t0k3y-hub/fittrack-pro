// 日付は "YYYY-MM-DD" / 月は "YYYY-MM" の文字列で扱う（DBの date 型と同じ形式）。
// 日本語専用アプリのため「今日」は日本時間で判定する。

const APP_TIME_ZONE = "Asia/Tokyo";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function todayString(now: Date = new Date()): string {
  // en-CA は YYYY-MM-DD 形式で出力される
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}

export function isValidMonth(value: string | undefined): value is string {
  if (!value || !MONTH_RE.test(value)) return false;
  const m = Number(value.slice(5, 7));
  return m >= 1 && m <= 12;
}

export function isValidDate(value: string | undefined): value is string {
  if (!value || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}

export function daysInMonth(month: string): number {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// 月初日の曜日 (0=日曜)
export function firstWeekday(month: string): number {
  return new Date(`${month}-01T00:00:00Z`).getUTCDay();
}

export function dateOf(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function formatMonthLabel(month: string): string {
  return `${Number(month.slice(0, 4))}年${Number(month.slice(5, 7))}月`;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
export { WEEKDAYS };

export function formatDateLabel(date: string): string {
  const wd = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日（${wd}）`;
}
