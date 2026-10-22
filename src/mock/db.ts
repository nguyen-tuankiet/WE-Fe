import dayjs from 'dayjs';
import type {
  AttendanceRecord,
  AttendanceStatus,
  ClassRoom,
  Enrollment,
  ExamPlan,
  ExamResult,
  Holiday,
  Makeup,
  Reserve,
  Slot,
  Staff,
  Student,
} from '../domain/types';
import { generateSchedule } from '../domain/schedule';
import { CURRICULUM } from './catalog';

/** Ngày "hôm nay" cố định để dữ liệu demo luôn nhất quán. */
export const TODAY = '2026-10-22';

export const SLOTS: Slot[] = [
  { id: 'chieu', label: 'Chiều', time: '15:00–16:30' },
  { id: 'toi1', label: 'Tối 1', time: '17:00–18:30' },
  { id: 'toi2', label: 'Tối 2', time: '19:15–20:45' },
  { id: 't7a', label: 'Chiều T7 (1)', time: '14:30–16:00' },
  { id: 't7b', label: 'Chiều T7 (2)', time: '16:00–17:30' },
];

export const ROOMS = [
  { id: '101', floor: 'Lầu 1' },
  { id: '102', floor: 'Lầu 1' },
  { id: '103', floor: 'Lầu 1' },
  { id: 'Tiếp khách', floor: 'Lầu 1' },
  { id: '202', floor: 'Lầu 2' },
  { id: '203', floor: 'Lầu 2' },
  { id: '204', floor: 'Lầu 2' },
];

export const config = {
  reminderDays: 30,
  teacherEditDays: 3,
  redflagBelow: 60,
  goodAbove: 80,
};

export const staff: Staff[] = [
  { id: 'u-admin', name: 'Nguyễn Văn Quản', email: 'admin@we.vn', roles: ['admin'], active: true },
  { id: 'u-manager', name: 'Trần Thị Mai', email: 'manager@we.vn', roles: ['manager'], active: true },
  { id: 'u-inspector', name: 'Lê Thanh Tra', email: 'thanhtra@we.vn', roles: ['inspector'], active: true },
  { id: 'u-jade', name: 'Jade', email: 'jade@we.vn', roles: ['teacher'], active: true },
  { id: 'u-amy', name: 'Amy', email: 'amy@we.vn', roles: ['teacher'], active: true },
  { id: 'u-norah', name: 'Norah', email: 'norah@we.vn', roles: ['teacher'], active: true },
  { id: 'u-tracy', name: 'Tracy', email: 'tracy@we.vn', roles: ['teacher', 'inspector'], active: true },
  { id: 'u-anthony', name: 'Anthony', email: 'anthony@we.vn', roles: ['teacher'], active: true },
  { id: 'u-hanna', name: 'Hanna', email: 'hanna@we.vn', roles: ['teacher'], active: true },
  { id: 'u-haha', name: 'Hải Hà', email: 'haha@we.vn', roles: ['teacher'], active: false },
];

export const classes: ClassRoom[] = [
  { id: 'c1', name: 'KIDS · Smart Explorers', subject: 'Kids Foundation', weekdays: [1, 3, 5], slotId: 'toi1', room: '101', teacherId: 'u-jade', assistant: 'Thy', maxSize: 10, active: true, cap: [{ group: '2-4-6', slotId: 'toi1', room: '101' }] },
  { id: 'c2', name: 'KIDS · Foundation A', subject: 'Kids Foundation', weekdays: [1, 3, 5], slotId: 'toi1', room: '102', teacherId: 'u-amy', assistant: '', maxSize: 10, active: true, cap: [{ group: '2-4-6', slotId: 'toi1', room: '102' }] },
  { id: 'c3', name: 'KIDS · Starters', subject: 'Cambridge', weekdays: [1, 3, 5], slotId: 'toi1', room: '103', teacherId: 'u-norah', assistant: '', maxSize: 10, active: true, cap: [{ group: '2-4-6', slotId: 'toi1', room: '103' }] },
  { id: 'c4', name: 'KET Foundation 1', subject: 'KET', weekdays: [1, 3, 5], slotId: 'toi1', room: '203', teacherId: 'u-anthony', assistant: '', maxSize: 10, active: true, cap: [{ group: '2-4-6', slotId: 'toi1', room: '203' }] },
  { id: 'c5', name: 'IELTS 6.0', subject: 'IELTS', weekdays: [1, 3, 5], slotId: 'toi1', room: '202', teacherId: 'u-haha', assistant: 'Tracy', maxSize: 10, active: true, cap: [{ group: '2-4-6', slotId: 'toi1', room: '202' }] },
  { id: 'c6', name: 'PRE-IELTS 2', subject: 'IELTS', weekdays: [1, 3, 5], slotId: 'toi2', room: '101', teacherId: 'u-tracy', assistant: '', maxSize: 10, active: true, cap: [{ group: '2-4-6', slotId: 'toi2', room: '101' }] },
  { id: 'c7', name: 'KIDS · Smart Learners', subject: 'Kids Foundation', weekdays: [2, 4, 6], slotId: 'toi1', room: '101', teacherId: 'u-jade', assistant: '', maxSize: 10, active: true, cap: [{ group: '3-5', slotId: 'toi1', room: '101' }, { group: '7', slotId: 't7b', room: '101' }] },
  { id: 'c8', name: 'KET Intensive', subject: 'KET', weekdays: [2, 4, 6], slotId: 'toi1', room: '202', teacherId: 'u-hanna', assistant: 'Tracy', maxSize: 10, active: true, cap: [{ group: '3-5', slotId: 'toi1', room: '202' }, { group: '7', slotId: 't7b', room: '202' }] },
  { id: 'c9', name: 'Baby Stars', subject: 'Baby', weekdays: [2, 4, 6], slotId: 'toi1', room: '102', teacherId: 'u-amy', assistant: '', maxSize: 10, active: true, cap: [{ group: '3-5', slotId: 'toi1', room: '102' }, { group: '7', slotId: 't7b', room: '102' }] },
  { id: 'c10', name: 'IELTS Foundation 2', subject: 'IELTS', weekdays: [2, 4, 6], slotId: 'toi2', room: '102', teacherId: 'u-norah', assistant: '', maxSize: 10, active: true, cap: [{ group: '3-5', slotId: 'toi2', room: '102' }] },
];

const S = (
  n: number,
  name: string,
  birthday: string,
  guardian: string,
  tuitionMode = 'WE',
  extra: Partial<Student> = {},
): Student => ({
  id: `s${n}`,
  code: `HV${String(n).padStart(4, '0')}`,
  name,
  birthday,
  status: 'active',
  guardian,
  phone: `09${String(10000000 + n * 137913).slice(0, 8)}`,
  address: 'TP. Thủ Đức, TP.HCM',
  tuitionMode,
  note: '',
  nextCourse: '',
  star: false,
  ...extra,
});

export const students: Student[] = [
  S(1, 'Nguyễn Minh Khôi', '2020-11-04', 'Chị Hạnh'),
  S(2, 'Lê Bảo Ngọc', '2018-10-31', 'Anh Long', 'WE', { star: true, redflagBelow: 50, goodAbove: 75, note: 'Bé nhút nhát, ưu tiên khuyến khích' }),
  S(3, 'Trần Gia Hân', '2017-11-15', 'Chị Thu', 'A.KHOA'),
  S(4, 'Phạm Quốc Bảo', '2018-10-27', 'Chị Vân', 'WE', { nextCourse: 'Smart Performers 2' }),
  S(5, 'Võ Thảo Vy', '2016-05-21', 'Anh Tâm', 'Theo tháng'),
  S(6, 'Đặng Anh Khoa', '2013-12-02', 'Chị Lan', 'WE', { nextCourse: 'KET Foundation 2' }),
  S(7, 'Bùi Hải Đăng', '2011-09-18', 'Anh Phúc', 'A.KHOA', { nextCourse: 'IELTS 5.0–5.5' }),
  S(8, 'Hoàng Mai Chi', '2009-02-09', 'Chị Oanh'),
  S(9, 'Ngô Tuấn Kiệt', '2012-07-30', 'Anh Hiếu'),
  S(10, 'Đỗ Phương Linh', '2010-03-16', 'Chị Mỵ', 'WE', { note: 'Đóng học phí ngày 15 hằng tháng' }),
  S(11, 'Lý Gia Bảo', '2017-10-26', 'Chị Ngân', 'WE', { status: 'reserved' }),
  S(12, 'Mai Khánh An', '2018-10-29', 'Chị Thảo'),
  S(13, 'Trịnh Quang Huy', '2015-01-12', 'Anh Đạt'),
  S(14, 'Cao Thanh Trúc', '2013-06-23', 'Chị Quỳnh', 'WE', { status: 'left' }),
];

const E = (
  n: number,
  studentId: string,
  programId: string,
  classId: string,
  startDate: string,
  weekdays: number[],
  totalSessions: number,
  tuition: number,
  status: Enrollment['status'] = 'active',
  tuitionReceived = true,
): Enrollment => ({
  id: `e${n}`,
  studentId,
  programId,
  classId,
  startDate,
  weekdays,
  totalSessions,
  tuition,
  tuitionReceived,
  status,
  note: '',
});

export const enrollments: Enrollment[] = [
  E(1, 's1', 'baby-stars', 'c9', '2026-09-15', [2, 4, 6], 36, 6_000_000),
  E(2, 's2', 'smart-explorers-1', 'c1', '2026-09-07', [1, 3, 5], 24, 6_100_000),
  E(3, 's3', 'smart-learners-2', 'c7', '2026-09-08', [2, 4, 6], 24, 6_200_000, 'active', false),
  E(4, 's4', 'smart-performers-1', 'c2', '2026-08-31', [1, 3, 5], 24, 6_300_000),
  E(5, 's5', 'starters-nen-tang', 'c3', '2026-09-07', [1, 3, 5], 36, 9_300_000),
  E(6, 's6', 'ket-foundation-1', 'c4', '2026-08-17', [1, 3, 5], 36, 10_000_000),
  E(7, 's7', 'pre-ielts-2', 'c6', '2026-07-27', [1, 3, 5], 36, 13_700_000),
  E(8, 's8', 'ielts-60-4', 'c5', '2026-08-10', [1, 3, 5], 42, 16_800_000),
  E(9, 's9', 'ket-intensive-1', 'c8', '2026-08-25', [2, 4, 6], 36, 10_500_000),
  E(10, 's10', 'ielts-we102', 'c10', '2026-09-01', [2, 4, 6], 36, 8_700_000),
  E(11, 's11', 'smart-achievers-1', 'c1', '2026-08-24', [1, 3, 5], 24, 6_400_000, 'reserved'),
  E(12, 's12', 'smart-explorers-2', 'c7', '2026-09-22', [2, 4, 6], 24, 6_100_000),
  E(13, 's13', 'movers-luyen-de', 'c3', '2026-07-20', [1, 3, 5], 36, 9_400_000),
  E(14, 's14', 'pet-foundation-1', 'c8', '2026-06-01', [2, 4, 6], 36, 11_000_000, 'reserved'),
];

export const holidays: Holiday[] = [
  { date: '2026-09-02', reason: 'Quốc khánh' },
  { date: '2026-11-20', reason: 'Ngày Nhà giáo Việt Nam' },
];

export const reserves: Reserve[] = [
  { id: 'r1', enrollmentId: 'e11', completedOn: '2026-10-05', noticeAt: '2026-10-02', absentStreak: 12, remainingSessions: 11, amount: 2_933_000, status: 'active', note: 'Gia đình đi công tác dài ngày' },
  { id: 'r2', enrollmentId: 'e14', completedOn: '2026-07-20', noticeAt: '2026-07-17', absentStreak: 10, remainingSessions: 22, amount: 6_722_000, status: 'expired', note: 'Quá hạn 2 tháng, chưa quay lại' },
  { id: 'r3', enrollmentId: 'e13', completedOn: '2026-08-24', noticeAt: '2026-08-20', absentStreak: 10, remainingSessions: 24, amount: 6_267_000, returnedOn: '2026-10-12', returnClassId: 'c3', status: 'returned', note: 'Quay lại học tiếp phần còn lại' },
];

export function reserveEnd(r: Reserve): string {
  if (r.status === 'returned' && r.returnedOn) return dayjs(r.returnedOn).subtract(1, 'day').format('YYYY-MM-DD');
  return dayjs(r.completedOn).add(2, 'month').format('YYYY-MM-DD');
}

export function pausedRangesOf(enrollmentId: string) {
  return reserves
    .filter((r) => r.enrollmentId === enrollmentId)
    .map((r) => ({ from: r.completedOn, to: reserveEnd(r) }));
}

export function scheduleOf(e: Enrollment): string[] {
  return generateSchedule({
    startDate: e.startDate,
    weekdays: e.weekdays,
    totalSessions: e.totalSessions,
    closedDates: holidays.map((h) => h.date),
    pausedRanges: pausedRangesOf(e.id),
  });
}

/** Sinh số ngẫu nhiên có hạt giống để dữ liệu demo ổn định giữa các lần tải. */
function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t * 1664525 + 1013904223) % 4294967296;
    return t / 4294967296;
  };
}

export const attendance: AttendanceRecord[] = [];

function seedAttendance() {
  const forced: Record<string, Record<number, { status: AttendanceStatus; notified: boolean }>> = {
    e4: { 3: { status: 'absent', notified: true }, 6: { status: 'absent', notified: true }, 10: { status: 'absent', notified: true }, 12: { status: 'absent', notified: false } },
    e5: { 4: { status: 'absent', notified: true }, 8: { status: 'absent', notified: true }, 9: { status: 'late', notified: false } },
    e6: { 5: { status: 'absent', notified: true }, 9: { status: 'absent', notified: true } },
    e2: { 2: { status: 'late', notified: false } },
  };
  for (const e of enrollments) {
    const rand = rng(Number(e.id.slice(1)) * 7919);
    scheduleOf(e).forEach((date, idx) => {
      if (date >= TODAY) return;
      const f = forced[e.id]?.[idx + 1];
      let status: AttendanceStatus = 'present';
      let notified = false;
      if (f) {
        status = f.status;
        notified = f.notified;
      } else {
        const r = rand();
        if (r < 0.05) {
          status = 'absent';
          notified = rand() < 0.7;
        } else if (r < 0.1) status = 'late';
      }
      attendance.push({
        enrollmentId: e.id,
        date,
        status,
        notified,
        note: status === 'absent' && !notified ? 'Không báo trước' : '',
        by: 'Giáo viên',
        at: `${date}T19:00:00Z`,
      });
    });
  }
}
seedAttendance();

export const makeups: Makeup[] = [];

function seedMakeups() {
  const firstAbsences = (id: string, n: number) =>
    attendance.filter((a) => a.enrollmentId === id && a.status === 'absent' && a.notified).slice(0, n);
  const nextDay = (e: Enrollment, offset: number) => {
    const sch = scheduleOf(e);
    return dayjs(sch[sch.length - 1]).add(offset, 'day').format('YYYY-MM-DD');
  };
  const e4 = enrollments.find((e) => e.id === 'e4')!;
  const [a4] = firstAbsences('e4', 1);
  if (a4) makeups.push({ id: 'm1', enrollmentId: 'e4', absenceDate: a4.date, date: nextDay(e4, 0), minutes: 30, room: '102', status: 'scheduled', notifiedParent: true, note: 'Học sau giờ chính, buổi cuối khóa' });
  const e6 = enrollments.find((e) => e.id === 'e6')!;
  const [a6] = firstAbsences('e6', 1);
  if (a6) makeups.push({ id: 'm2', enrollmentId: 'e6', absenceDate: a6.date, date: nextDay(e6, 2), minutes: 90, room: '203', status: 'scheduled', notifiedParent: false, note: '' });
  const [a5] = firstAbsences('e5', 1);
  if (a5) makeups.push({ id: 'm3', enrollmentId: 'e5', absenceDate: a5.date, date: '2026-10-19', minutes: 90, room: '103', status: 'done', notifiedParent: true, note: 'Đã học bù đủ' });
}
seedMakeups();

export const examPlans: ExamPlan[] = [
  { id: 'p1', enrollmentId: 'e5', plannedDate: '2026-10-23', unitIds: ['cam-u1', 'cam-u2'], status: 'pending' },
  { id: 'p2', enrollmentId: 'e4', plannedDate: '2026-10-24', unitIds: ['found-u1'], status: 'pending' },
  { id: 'p3', enrollmentId: 'e1', plannedDate: '2026-10-26', unitIds: ['baby-u1', 'baby-u2'], status: 'pending' },
  { id: 'p4', enrollmentId: 'e6', plannedDate: '2026-10-10', unitIds: ['cam-u1'], status: 'done' },
  { id: 'p5', enrollmentId: 'e2', plannedDate: '2026-10-12', unitIds: ['found-u1', 'found-u2'], status: 'done' },
];

export const examResults: ExamResult[] = [
  {
    id: 'x1',
    planId: 'p4',
    enrollmentId: 'e6',
    date: '2026-10-10',
    examiner: 'Lê Thanh Tra',
    units: [{ unitId: 'cam-u1', values: { pattern: 88, freestyle: 82, pron1: 'clear', pron2: 'clear', gram1: 'ok', gram2: 'ok' } }],
    snapshot: [CURRICULUM.cambridge[0]],
    comment: 'Nắm chắc mẫu câu, tự tin khi nói tự do.',
    support: 'Tiếp tục luyện Freestyle theo chủ đề mới.',
    overall: 'good',
    percent: 85,
  },
  {
    id: 'x2',
    planId: 'p5',
    enrollmentId: 'e2',
    date: '2026-10-12',
    examiner: 'Lê Thanh Tra',
    units: [
      { unitId: 'found-u1', values: { vocabulary: 62.5, communication: 70, pronunciation: 'unclear' } },
      { unitId: 'found-u2', values: { vocabulary: 57, communication: 65, pronunciation: 'clear' } },
    ],
    snapshot: [CURRICULUM.foundation[0], CURRICULUM.foundation[1]],
    comment: 'Còn nhút nhát khi giao tiếp, từ vựng cần ôn thêm.',
    support: 'Ôn từ vựng 15 phút mỗi ngày; GV khuyến khích phát biểu.',
    overall: 'average',
    percent: 63.6,
  },
];

export const handledTasks: Record<string, { by: string; at: string }> = {
  'birthday:s4': { by: 'Trần Thị Mai', at: '2026-10-20T09:30:00Z' },
};
