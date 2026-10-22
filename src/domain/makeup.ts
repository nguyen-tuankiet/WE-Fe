import type { Makeup, MakeupQuota, Program } from './types';

/** Chính sách học bù theo nhóm chương trình (docs/02). null = chưa có quyết định (Lớp 10). */
export function makeupQuota(program: Program): MakeupQuota | null {
  switch (program.group) {
    case 'baby':
    case 'foundation':
      return { maxCount: 5, minutes: 30 };
    case 'grade10':
      return null;
    default:
      return { maxCount: 2, minutes: 90 };
  }
}

/** Lượt tính là đã dùng: đã xếp, hoàn tất, hoặc vắng bù (mất lượt). Hủy chưa tính — chờ chốt ở docs/08 #4. */
export function usedMakeups(makeups: Makeup[]): number {
  return makeups.filter((m) => m.status !== 'cancelled').length;
}

export interface AbsenceInfo {
  date: string;
  notified: boolean;
}

/** Buổi vắng đã báo nghỉ, chưa có lượt bù, và còn trong định mức → có thể xếp bù. */
export function pendingAbsences(
  absences: AbsenceInfo[],
  makeups: Makeup[],
  quota: MakeupQuota | null,
): string[] {
  if (!quota) return [];
  const covered = new Set(makeups.filter((m) => m.status !== 'cancelled').map((m) => m.absenceDate));
  const left = quota.maxCount - usedMakeups(makeups);
  if (left <= 0) return [];
  return absences
    .filter((a) => a.notified && !covered.has(a.date))
    .map((a) => a.date)
    .sort()
    .slice(0, left);
}
