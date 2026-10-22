import { describe, expect, it } from 'vitest';
import { generateSchedule, weekdaysLabel } from './schedule';
import { makeupQuota, pendingAbsences } from './makeup';
import { classify, summarize } from './grading';
import type { Makeup, Program } from './types';

const program = (group: Program['group']): Program => ({
  id: 'p',
  group,
  name: 'p',
  tuition: 0,
  sessions: 36,
  maxSize: 10,
  unitTemplate: null,
});

describe('generateSchedule', () => {
  it('sinh đủ số buổi theo ngày học (2-4-6 = T2, T4, T6)', () => {
    const s = generateSchedule({ startDate: '2026-10-05', weekdays: [1, 3, 5], totalSessions: 6 });
    expect(s).toEqual(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14', '2026-10-16']);
  });

  it('ngày trung tâm nghỉ làm dời buổi, vẫn đủ định mức', () => {
    const s = generateSchedule({
      startDate: '2026-10-05',
      weekdays: [1, 3, 5],
      totalSessions: 4,
      closedDates: ['2026-10-07'],
    });
    expect(s).toEqual(['2026-10-05', '2026-10-09', '2026-10-12', '2026-10-14']);
  });

  it('khoảng bảo lưu tạm dừng lịch chính', () => {
    const s = generateSchedule({
      startDate: '2026-10-05',
      weekdays: [1, 3, 5],
      totalSessions: 3,
      pausedRanges: [{ from: '2026-10-06', to: '2026-10-12' }],
    });
    expect(s).toEqual(['2026-10-05', '2026-10-14', '2026-10-16']);
  });

  it('nhãn ngày học', () => {
    expect(weekdaysLabel([5, 1, 3])).toBe('2-4-6');
    expect(weekdaysLabel([2, 4, 6])).toBe('3-5-7');
  });
});

describe('học bù', () => {
  it('định mức theo nhóm', () => {
    expect(makeupQuota(program('baby'))).toEqual({ maxCount: 5, minutes: 30 });
    expect(makeupQuota(program('foundation'))).toEqual({ maxCount: 5, minutes: 30 });
    expect(makeupQuota(program('ielts'))).toEqual({ maxCount: 2, minutes: 90 });
    expect(makeupQuota(program('grade10'))).toBeNull();
  });

  it('vắng 3 buổi đã báo, định mức 2 → tối đa 2 lượt', () => {
    const absences = [
      { date: '2026-09-01', notified: true },
      { date: '2026-09-03', notified: true },
      { date: '2026-09-05', notified: true },
    ];
    expect(pendingAbsences(absences, [], { maxCount: 2, minutes: 90 })).toHaveLength(2);
  });

  it('vắng không báo → không đủ điều kiện bù', () => {
    expect(pendingAbsences([{ date: '2026-09-01', notified: false }], [], { maxCount: 2, minutes: 90 })).toEqual([]);
  });

  it('Vắng bù vẫn tính đã dùng lượt, không sinh lượt thay thế', () => {
    const makeups: Makeup[] = [
      { id: 'm', enrollmentId: 'e', absenceDate: '2026-09-01', date: '2026-11-20', minutes: 90, room: '', status: 'missed', notifiedParent: true, note: '' },
    ];
    const absences = [
      { date: '2026-09-01', notified: true },
      { date: '2026-09-03', notified: true },
      { date: '2026-09-05', notified: true },
    ];
    expect(pendingAbsences(absences, makeups, { maxCount: 2, minutes: 90 })).toEqual(['2026-09-03']);
  });
});

describe('đánh giá', () => {
  it('ngưỡng mặc định 60 / 80', () => {
    expect(classify(59, 60, 80)).toBe('redflag');
    expect(classify(60, 60, 80)).toBe('average');
    expect(classify(80, 60, 80)).toBe('average');
    expect(classify(81, 60, 80)).toBe('good');
  });

  it('có tiêu chí Redflag thì kết quả chung Redflag', () => {
    const r = summarize(
      'baby',
      [{ unitId: 'u1', values: { spelling: 100, writing: 50 } }],
      { redflagBelow: 60, goodAbove: 80 },
    );
    expect(r.overall).toBe('redflag');
    expect(r.percent).toBe(75);
  });

  it('ngưỡng cá nhân đổi phân loại nhưng giữ điểm gốc', () => {
    const units = [{ unitId: 'u1', values: { spelling: 55, writing: 55 } }];
    expect(summarize('baby', units, { redflagBelow: 60, goodAbove: 80 }).overall).toBe('redflag');
    const star = summarize('baby', units, { redflagBelow: 40, goodAbove: 70 });
    expect(star.overall).toBe('average');
    expect(star.percent).toBe(55);
  });
});
