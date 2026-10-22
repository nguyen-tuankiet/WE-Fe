import dayjs from 'dayjs';

export const DATE_FMT = 'YYYY-MM-DD';

export interface ScheduleInput {
  startDate: string;
  weekdays: number[];
  totalSessions: number;
  closedDates?: string[];
  /** khoảng bảo lưu hợp lệ [từ, đến] — lịch chính tạm dừng */
  pausedRanges?: { from: string; to: string }[];
}

/** Sinh lịch buổi chính: bỏ qua ngày trung tâm nghỉ và khoảng bảo lưu, dời đủ số buổi. */
export function generateSchedule(input: ScheduleInput): string[] {
  const closed = new Set(input.closedDates ?? []);
  const paused = input.pausedRanges ?? [];
  const out: string[] = [];
  let cursor = dayjs(input.startDate);
  for (let guard = 0; out.length < input.totalSessions && guard < 3000; guard++) {
    const date = cursor.format(DATE_FMT);
    const isPaused = paused.some((r) => date >= r.from && date <= r.to);
    if (input.weekdays.includes(cursor.day()) && !closed.has(date) && !isPaused) out.push(date);
    cursor = cursor.add(1, 'day');
  }
  return out;
}

export interface Progress {
  total: number;
  held: number;
  recorded: number;
  remaining: number;
  /** buổi đã diễn ra theo lịch nhưng chưa có điểm danh */
  missingDates: string[];
  endDate: string | null;
}

export function computeProgress(schedule: string[], recordedDates: string[], today: string): Progress {
  const recorded = new Set(recordedDates);
  const past = schedule.filter((d) => d <= today);
  return {
    total: schedule.length,
    held: past.length,
    recorded: schedule.filter((d) => recorded.has(d)).length,
    remaining: schedule.length - past.length,
    missingDates: past.filter((d) => d < today && !recorded.has(d)),
    endDate: schedule.length ? schedule[schedule.length - 1] : null,
  };
}

export function weekdaysLabel(weekdays: number[]): string {
  return [...weekdays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => (d === 0 ? 'CN' : String(d + 1)))
    .join('-');
}
