export type Role = 'admin' | 'manager' | 'teacher' | 'inspector';

export type AttendanceStatus = 'present' | 'late' | 'absent';

export type ProgramGroup =
  | 'baby'
  | 'foundation'
  | 'cambridge'
  | 'ket'
  | 'pet'
  | 'ielts'
  | 'communication'
  | 'grade10';

export type UnitTemplate = 'baby' | 'foundation' | 'cambridge';

export interface Program {
  id: string;
  group: ProgramGroup;
  name: string;
  tuition: number;
  /** null = gói tính theo tháng, Admin phải xác nhận số buổi thực tế */
  sessions: number | null;
  maxSize: number;
  unitTemplate: UnitTemplate | null;
  note?: string;
}

export interface MakeupQuota {
  maxCount: number;
  minutes: number;
}

export type StudentStatus = 'active' | 'reserved' | 'left';

export interface Student {
  id: string;
  code: string;
  name: string;
  birthday: string;
  status: StudentStatus;
  guardian: string;
  phone: string;
  address: string;
  tuitionMode: string;
  note: string;
  nextCourse: string;
  star: boolean;
  redflagBelow?: number;
  goodAbove?: number;
}

export type EnrollmentStatus = 'active' | 'reserved' | 'completed';

export interface Enrollment {
  id: string;
  studentId: string;
  programId: string;
  classId: string;
  startDate: string;
  /** dayjs().day(): 0 = Chủ nhật … 6 = Thứ 7 */
  weekdays: number[];
  totalSessions: number;
  tuition: number;
  tuitionReceived: boolean;
  status: EnrollmentStatus;
  note: string;
}

export interface Slot {
  id: string;
  label: string;
  time: string;
}

export interface ClassRoom {
  id: string;
  name: string;
  subject: string;
  weekdays: number[];
  slotId: string;
  room: string;
  teacherId: string;
  assistant: string;
  maxSize: number;
  active: boolean;
  cap: { group: string; slotId: string; room: string }[];
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  active: boolean;
  /** YYYY-MM-DD; có thể chưa nhập */
  birthday?: string | null;
}

export interface AttendanceRecord {
  enrollmentId: string;
  date: string;
  status: AttendanceStatus;
  notified: boolean;
  note: string;
  by: string;
  at: string;
}

export type MakeupStatus = 'scheduled' | 'done' | 'missed' | 'cancelled';

export interface Makeup {
  id: string;
  enrollmentId: string;
  absenceDate: string;
  date: string;
  minutes: number;
  room: string;
  status: MakeupStatus;
  notifiedParent: boolean;
  note: string;
}

export type ReserveStatus = 'active' | 'returned' | 'expired';

export interface Reserve {
  id: string;
  enrollmentId: string;
  completedOn: string;
  noticeAt: string;
  absentStreak: number;
  remainingSessions: number;
  amount: number;
  returnedOn?: string;
  returnClassId?: string;
  status: ReserveStatus;
  note: string;
}

export interface Holiday {
  date: string;
  reason: string;
}

export interface UnitContent {
  id: string;
  name: string;
  topic: string;
  words: string[];
  patterns: string[];
}

export type Rating = 'good' | 'average' | 'redflag';

export interface UnitScore {
  unitId: string;
  /** các tiêu chí theo mẫu phiếu; điểm 0–100 hoặc lựa chọn chữ */
  values: Record<string, number | string | null>;
}

export interface ExamPlan {
  id: string;
  enrollmentId: string;
  plannedDate: string;
  unitIds: string[];
  status: 'pending' | 'done';
}

export interface ExamResult {
  id: string;
  planId: string;
  enrollmentId: string;
  date: string;
  examiner: string;
  units: UnitScore[];
  /** nội dung đã dùng, chụp tại thời điểm chấm */
  snapshot: UnitContent[];
  comment: string;
  support: string;
  overall: Rating;
  percent: number;
}
