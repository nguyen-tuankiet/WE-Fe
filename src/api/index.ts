/**
 * Lớp API giả lập (dữ liệu trong bộ nhớ). Mỗi hàm tương ứng một endpoint `/api/v1/...`
 * của backend sau này — khi có backend, chỉ cần thay thân hàm bằng lời gọi HTTP, giữ nguyên chữ ký.
 */
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
  MakeupQuota,
  MakeupStatus,
  Program,
  Rating,
  Reserve,
  Staff,
  Student,
  UnitContent,
  UnitScore,
  UnitTemplate,
} from '../domain/types';
import { computeProgress, type Progress } from '../domain/schedule';
import { makeupQuota, pendingAbsences, usedMakeups } from '../domain/makeup';
import { summarize, thresholdsFor } from '../domain/grading';
import { CURRICULUM, GROUP_LABEL, PROGRAMS, programById } from '../mock/catalog';
import {
  TODAY,
  attendance,
  classes,
  config,
  enrollments,
  examPlans,
  examResults,
  handledTasks,
  holidays,
  makeups,
  pausedRangesOf,
  reserveEnd,
  reserves,
  scheduleOf,
  SLOTS,
  staff,
  students,
} from '../mock/db';

const wait = <T>(value: T): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), 50));
const fail = (message: string): never => {
  throw new Error(message);
};

export { TODAY };

/* ---------- Views ---------- */

export interface EnrollmentView {
  enrollment: Enrollment;
  student: Student;
  program: Program;
  cls: ClassRoom;
  schedule: string[];
  progress: Progress;
  quota: MakeupQuota | null;
  makeupUsed: number;
}

const teacherName = (id: string) => staff.find((s) => s.id === id)?.name ?? '—';

function recordsOf(enrollmentId: string): AttendanceRecord[] {
  return attendance.filter((a) => a.enrollmentId === enrollmentId);
}

function buildView(e: Enrollment): EnrollmentView {
  const student = students.find((s) => s.id === e.studentId) ?? fail('Không tìm thấy học viên');
  const program = programById(e.programId);
  const cls = classes.find((c) => c.id === e.classId) ?? fail('Không tìm thấy lớp');
  const schedule = scheduleOf(e);
  const progress = computeProgress(schedule, recordsOf(e.id).map((a) => a.date), TODAY);
  const quota = makeupQuota(program);
  return {
    enrollment: e,
    student,
    program,
    cls,
    schedule,
    progress,
    quota,
    makeupUsed: usedMakeups(makeups.filter((m) => m.enrollmentId === e.id)),
  };
}

const viewById = (id: string) =>
  buildView(enrollments.find((e) => e.id === id) ?? fail('Không tìm thấy khóa đăng ký'));

/* ---------- Học viên ---------- */

export interface StudentRow extends Student {
  className: string;
  activeCourses: number;
}

export async function listStudents(): Promise<StudentRow[]> {
  return wait(
    students.map((s) => {
      const active = enrollments.filter((e) => e.studentId === s.id && e.status === 'active');
      const cls = active[0] ? classes.find((c) => c.id === active[0].classId) : undefined;
      return { ...s, className: cls?.name ?? '—', activeCourses: active.length };
    }),
  );
}

export interface ExamResultView {
  result: ExamResult;
  view: EnrollmentView;
  template: UnitTemplate | null;
  rating: Rating;
  percent: number;
}

function resultView(r: ExamResult): ExamResultView {
  const view = viewById(r.enrollmentId);
  const template = view.program.unitTemplate;
  if (!template) return { result: r, view, template, rating: r.overall, percent: r.percent };
  const summary = summarize(template, r.units, thresholdsFor(view.student));
  return { result: r, view, template, rating: summary.overall, percent: summary.percent };
}

export interface StudentProfile {
  student: Student;
  enrollments: EnrollmentView[];
  reserves: Reserve[];
  exams: ExamResultView[];
  attendanceCount: Record<AttendanceStatus, number>;
}

export async function getStudentProfile(id: string): Promise<StudentProfile> {
  const student = students.find((s) => s.id === id) ?? fail('Không tìm thấy học viên');
  const mine = enrollments.filter((e) => e.studentId === id);
  const counts: Record<AttendanceStatus, number> = { present: 0, late: 0, absent: 0 };
  mine.forEach((e) => recordsOf(e.id).forEach((a) => (counts[a.status] += 1)));
  return wait({
    student,
    enrollments: mine.map(buildView),
    reserves: reserves.filter((r) => mine.some((e) => e.id === r.enrollmentId)),
    exams: examResults.filter((r) => mine.some((e) => e.id === r.enrollmentId)).map(resultView),
    attendanceCount: counts,
  });
}

export type NewStudent = Pick<Student, 'name' | 'birthday' | 'guardian' | 'phone' | 'address' | 'tuitionMode' | 'note'>;

export async function createStudent(input: NewStudent): Promise<Student> {
  const n = students.length + 1;
  const created: Student = {
    ...input,
    id: `s${n}`,
    code: `HV${String(n).padStart(4, '0')}`,
    status: 'active',
    nextCourse: '',
    star: false,
  };
  students.push(created);
  return wait(created);
}

export async function updateStudentStar(
  id: string,
  patch: Pick<Student, 'star' | 'redflagBelow' | 'goodAbove'>,
): Promise<Student> {
  const s = students.find((x) => x.id === id) ?? fail('Không tìm thấy học viên');
  Object.assign(s, patch);
  return wait(s);
}

/* ---------- Lớp ---------- */

export interface ClassRow extends ClassRoom {
  teacherName: string;
  studentCount: number;
}

export async function listClasses(): Promise<ClassRow[]> {
  return wait(
    classes.map((c) => ({
      ...c,
      teacherName: teacherName(c.teacherId),
      studentCount: enrollments.filter((e) => e.classId === c.id && e.status === 'active').length,
    })),
  );
}

export async function getClassDetail(id: string) {
  const cls = classes.find((c) => c.id === id) ?? fail('Không tìm thấy lớp');
  return wait({
    cls,
    teacherName: teacherName(cls.teacherId),
    students: enrollments.filter((e) => e.classId === id && e.status === 'active').map(buildView),
  });
}

/* ---------- Khóa học ---------- */

export async function listEnrollments(): Promise<EnrollmentView[]> {
  return wait(enrollments.map(buildView));
}

export async function listPrograms(): Promise<Program[]> {
  return wait(PROGRAMS);
}

/* ---------- Điểm danh ---------- */

export interface SheetRow {
  view: EnrollmentView;
  record?: AttendanceRecord;
}

export async function getAttendanceSheet(classId: string, date: string): Promise<SheetRow[]> {
  const rows = enrollments
    .filter((e) => e.classId === classId && e.status !== 'completed')
    .map(buildView)
    .filter((v) => v.schedule.includes(date))
    .map((view) => ({
      view,
      record: attendance.find((a) => a.enrollmentId === view.enrollment.id && a.date === date),
    }));
  return wait(rows);
}

export interface AttendanceInput {
  enrollmentId: string;
  status: AttendanceStatus;
  notified: boolean;
  note: string;
}

export async function saveAttendance(date: string, items: AttendanceInput[], by: string): Promise<number> {
  const at = new Date().toISOString();
  for (const it of items) {
    const e = enrollments.find((x) => x.id === it.enrollmentId) ?? fail('Không tìm thấy khóa đăng ký');
    if (!scheduleOf(e).includes(date)) fail('Ngày này không thuộc lịch của khóa.');
    const makeup = makeups.find(
      (m) => m.enrollmentId === it.enrollmentId && m.absenceDate === date && m.status !== 'cancelled',
    );
    if (makeup && (it.status !== 'absent' || !it.notified)) {
      fail('Buổi vắng này đã có lịch bù. Hủy hoặc đối chiếu lượt bù trước khi đổi trạng thái.');
    }
  }
  for (const it of items) {
    const idx = attendance.findIndex((a) => a.enrollmentId === it.enrollmentId && a.date === date);
    const record: AttendanceRecord = {
      enrollmentId: it.enrollmentId,
      date,
      status: it.status,
      notified: it.status === 'absent' ? it.notified : false,
      note: it.note,
      by,
      at,
    };
    if (idx >= 0) attendance[idx] = record;
    else attendance.push(record);
  }
  return wait(items.length);
}

export interface LedgerCell {
  date: string;
  status: AttendanceStatus | 'none' | 'future';
  notified: boolean;
  makeupMinutes?: number;
}

export interface LedgerRow {
  view: EnrollmentView;
  cells: LedgerCell[];
}

export async function getMonthLedger(classId: string, month: string) {
  const views = enrollments
    .filter((e) => e.classId === classId && e.status !== 'completed')
    .map(buildView);
  const dates = Array.from(new Set(views.flatMap((v) => v.schedule.filter((d) => d.startsWith(month))))).sort();
  const rows: LedgerRow[] = views.map((view) => ({
    view,
    cells: dates.map((date) => {
      if (!view.schedule.includes(date)) return { date, status: 'future', notified: false } as LedgerCell;
      const rec = attendance.find((a) => a.enrollmentId === view.enrollment.id && a.date === date);
      const mk = makeups.find((m) => m.enrollmentId === view.enrollment.id && m.date === date && m.status !== 'cancelled');
      return {
        date,
        status: rec ? rec.status : date > TODAY ? 'future' : 'none',
        notified: rec?.notified ?? false,
        makeupMinutes: mk?.minutes,
      } as LedgerCell;
    }),
  }));
  return wait({ dates, rows });
}

/* ---------- Học bù ---------- */

export interface MakeupView {
  makeup: Makeup;
  view: EnrollmentView;
}

export interface PendingMakeup {
  view: EnrollmentView;
  absenceDate: string;
}

function computePendingMakeups(): PendingMakeup[] {
  const pending: PendingMakeup[] = [];
  for (const e of enrollments.filter((x) => x.status === 'active')) {
    const view = buildView(e);
    const absences = recordsOf(e.id)
      .filter((a) => a.status === 'absent')
      .map((a) => ({ date: a.date, notified: a.notified }));
    pendingAbsences(absences, makeups.filter((m) => m.enrollmentId === e.id), view.quota).forEach((absenceDate) =>
      pending.push({ view, absenceDate }),
    );
  }
  return pending;
}

export async function listMakeups() {
  const list: MakeupView[] = makeups.map((m) => ({ makeup: m, view: viewById(m.enrollmentId) }));
  return wait({ list, pending: computePendingMakeups() });
}

export interface NewMakeup {
  enrollmentId: string;
  absenceDate: string;
  date: string;
  room: string;
  notifiedParent: boolean;
  note: string;
}

export async function scheduleMakeup(input: NewMakeup): Promise<Makeup> {
  const view = viewById(input.enrollmentId);
  if (!view.quota) fail('Chương trình này chưa có chính sách học bù — cần Admin xác nhận.');
  const mine = makeups.filter((m) => m.enrollmentId === input.enrollmentId);
  if (mine.some((m) => m.absenceDate === input.absenceDate && m.status !== 'cancelled')) {
    fail('Buổi vắng này đã có lượt bù.');
  }
  if (usedMakeups(mine) >= view.quota!.maxCount) fail('Đã dùng hết số lượt bù của khóa.');
  if (holidays.some((h) => h.date === input.date)) fail('Ngày bù trùng ngày trung tâm nghỉ.');
  const created: Makeup = {
    ...input,
    id: `m${makeups.length + 1}`,
    minutes: view.quota!.minutes,
    status: 'scheduled',
  };
  makeups.push(created);
  return wait(created);
}

export async function setMakeupStatus(id: string, status: MakeupStatus, note: string): Promise<Makeup> {
  const m = makeups.find((x) => x.id === id) ?? fail('Không tìm thấy lượt bù');
  if (status === 'cancelled' && !note.trim()) fail('Hủy lịch bù cần ghi lý do.');
  m.status = status;
  if (note) m.note = note;
  return wait(m);
}

/* ---------- Bảo lưu ---------- */

export interface ReserveView {
  reserve: Reserve;
  view: EnrollmentView;
  expiresOn: string;
  daysLeft: number;
}

export async function listReserves(): Promise<ReserveView[]> {
  return wait(
    reserves.map((r) => {
      const expiresOn = dayjs(r.completedOn).add(2, 'month').format('YYYY-MM-DD');
      return { reserve: r, view: viewById(r.enrollmentId), expiresOn, daysLeft: dayjs(expiresOn).diff(dayjs(TODAY), 'day') };
    }),
  );
}

export interface NewReserve {
  enrollmentId: string;
  completedOn: string;
  noticeAt: string;
  absentStreak: number;
  amount: number;
  note: string;
}

export async function createReserve(input: NewReserve): Promise<Reserve> {
  const view = viewById(input.enrollmentId);
  if (reserves.some((r) => r.enrollmentId === input.enrollmentId)) fail('Khóa này đã bảo lưu một lần — chính sách chỉ cho phép 1 lần/khóa.');
  if (input.absentStreak < 10) fail('Cần nghỉ liên tục từ 10 buổi trở lên để bảo lưu.');
  const hours = dayjs(input.completedOn).diff(dayjs(input.noticeAt), 'hour');
  if (hours < 48) fail('Cần thông báo trước ít nhất 48 giờ.');
  const created: Reserve = {
    ...input,
    id: `r${reserves.length + 1}`,
    remainingSessions: view.progress.remaining,
    status: 'active',
  };
  reserves.push(created);
  view.enrollment.status = 'reserved';
  view.student.status = 'reserved';
  return wait(created);
}

export async function markReturned(id: string, classId: string, returnedOn: string): Promise<Reserve> {
  const r = reserves.find((x) => x.id === id) ?? fail('Không tìm thấy hồ sơ bảo lưu');
  r.status = 'returned';
  r.returnedOn = returnedOn;
  r.returnClassId = classId;
  const e = enrollments.find((x) => x.id === r.enrollmentId)!;
  e.status = 'active';
  e.classId = classId;
  const s = students.find((x) => x.id === e.studentId)!;
  s.status = 'active';
  return wait(r);
}

/* ---------- Học vụ & kiểm tra ---------- */

export interface PlanView {
  plan: ExamPlan;
  view: EnrollmentView;
  units: UnitContent[];
}

const unitsOf = (ids: string[]): UnitContent[] =>
  Object.values(CURRICULUM)
    .flat()
    .filter((u) => ids.includes(u.id));

export async function listExams() {
  const plans: PlanView[] = examPlans.map((plan) => ({ plan, view: viewById(plan.enrollmentId), units: unitsOf(plan.unitIds) }));
  return wait({ plans, results: examResults.map(resultView) });
}

export async function getExamPlan(planId: string) {
  const plan = examPlans.find((p) => p.id === planId) ?? fail('Không tìm thấy lịch kiểm tra');
  const view = viewById(plan.enrollmentId);
  const template = view.program.unitTemplate;
  return wait({
    plan,
    view,
    template,
    units: unitsOf(plan.unitIds),
    existing: examResults.find((r) => r.planId === planId),
  });
}

export async function listUnitsFor(template: UnitTemplate): Promise<UnitContent[]> {
  return wait(CURRICULUM[template]);
}

export async function createExamPlan(enrollmentId: string, plannedDate: string, unitIds: string[]): Promise<ExamPlan> {
  if (!unitIds.length) fail('Chọn ít nhất một Unit.');
  const view = viewById(enrollmentId);
  if (!view.program.unitTemplate) fail('Chương trình chưa có nội dung kiểm tra, không thể lên lịch.');
  const plan: ExamPlan = { id: `p${examPlans.length + 1}`, enrollmentId, plannedDate, unitIds, status: 'pending' };
  examPlans.push(plan);
  return wait(plan);
}

export interface SaveExamInput {
  planId: string;
  units: UnitScore[];
  comment: string;
  support: string;
  examiner: string;
}

/** Lưu kết quả và chuyển lịch sang Hoàn tất trong một thao tác (không lưu dở). */
export async function saveExam(input: SaveExamInput): Promise<ExamResult> {
  const plan = examPlans.find((p) => p.id === input.planId) ?? fail('Không tìm thấy lịch kiểm tra');
  const view = viewById(plan.enrollmentId);
  const template = view.program.unitTemplate ?? fail('Chương trình chưa có mẫu chấm');
  if (input.units.length !== plan.unitIds.length) fail('Phải chấm đủ các Unit đã chọn.');
  const summary = summarize(template, input.units, thresholdsFor(view.student));
  const result: ExamResult = {
    id: `x${examResults.length + 1}`,
    planId: plan.id,
    enrollmentId: plan.enrollmentId,
    date: TODAY,
    examiner: input.examiner,
    units: input.units,
    snapshot: unitsOf(plan.unitIds),
    comment: input.comment,
    support: input.support,
    overall: summary.overall,
    percent: summary.percent,
  };
  const idx = examResults.findIndex((r) => r.planId === plan.id);
  if (idx >= 0) examResults[idx] = { ...result, id: examResults[idx].id };
  else examResults.push(result);
  plan.status = 'done';
  return wait(result);
}

/* ---------- Báo cáo ---------- */

export async function listReportStudents() {
  const ids = new Set(examResults.map((r) => viewById(r.enrollmentId).student.id));
  return wait(students.filter((s) => ids.has(s.id)));
}

/* ---------- Việc cần quan tâm ---------- */

export type TaskType = 'birthday' | 'endcourse' | 'reserve' | 'exam' | 'attendance' | 'tuition';

export interface Task {
  key: string;
  type: TaskType;
  title: string;
  detail: string;
  date: string;
  handled?: { by: string; at: string };
}

function nextBirthday(birthday: string): string {
  const b = dayjs(birthday);
  let d = dayjs(TODAY).month(b.month()).date(b.date());
  if (d.isBefore(dayjs(TODAY), 'day')) d = d.add(1, 'year');
  return d.format('YYYY-MM-DD');
}

export async function listTasks(): Promise<Task[]> {
  const limit = dayjs(TODAY).add(config.reminderDays, 'day').format('YYYY-MM-DD');
  const tasks: Task[] = [];
  for (const s of students.filter((x) => x.status === 'active')) {
    const date = nextBirthday(s.birthday);
    if (date <= limit) {
      const age = dayjs(date).year() - dayjs(s.birthday).year();
      tasks.push({ key: `birthday:${s.id}`, type: 'birthday', title: s.name, detail: `Sinh nhật tròn ${age} tuổi`, date });
    }
  }
  for (const e of enrollments.filter((x) => x.status === 'active')) {
    const v = buildView(e);
    const end = v.progress.endDate;
    if (end && end >= TODAY && end <= limit) {
      tasks.push({ key: `end:${e.id}`, type: 'endcourse', title: v.student.name, detail: `Sắp hết khóa ${v.program.name} · khóa tiếp: ${v.student.nextCourse || 'chưa có'}`, date: end });
    }
    if (v.progress.missingDates.length) {
      tasks.push({ key: `attn:${e.id}`, type: 'attendance', title: v.student.name, detail: `Thiếu điểm danh ${v.progress.missingDates.length} buổi (${v.cls.name})`, date: v.progress.missingDates[0] });
    }
    if (!e.tuitionReceived) {
      tasks.push({ key: `tuition:${e.id}`, type: 'tuition', title: v.student.name, detail: `Chưa xác nhận đã nhận học phí ${v.program.name}`, date: e.startDate });
    }
  }
  for (const r of reserves.filter((x) => x.status === 'active')) {
    const exp = dayjs(r.completedOn).add(2, 'month').format('YYYY-MM-DD');
    if (exp <= limit) {
      const v = viewById(r.enrollmentId);
      tasks.push({ key: `reserve:${r.id}`, type: 'reserve', title: v.student.name, detail: `Bảo lưu hết hạn ${dayjs(exp).format('DD/MM/YYYY')}`, date: exp });
    }
  }
  for (const p of examPlans.filter((x) => x.status === 'pending')) {
    const v = viewById(p.enrollmentId);
    tasks.push({ key: `exam:${p.id}`, type: 'exam', title: v.student.name, detail: `Kiểm tra ${p.unitIds.length} Unit · ${v.program.name}`, date: p.plannedDate });
  }
  return wait(tasks.map((t) => ({ ...t, handled: handledTasks[t.key] })).sort((a, b) => a.date.localeCompare(b.date)));
}

export async function markTask(key: string, by: string, done: boolean): Promise<void> {
  if (done) handledTasks[key] = { by, at: new Date().toISOString() };
  else delete handledTasks[key];
  return wait(undefined);
}

export interface DashboardSession {
  date: string;
  cls: ClassRoom;
  teacherName: string;
  students: number;
  recorded: number;
}

/** Số liệu Tổng quan: các chỉ số theo kỳ tính trong khoảng [from, to]; chỉ số tình trạng hiện tại không phụ thuộc kỳ. */
export async function getDashboard(from: string, to: string) {
  const activeStudents = students.filter((s) => s.status === 'active').length;
  const active = enrollments.filter((e) => e.status === 'active');
  const closed = new Set(holidays.map((h) => h.date));
  const schedules = active.map((e) => ({ e, dates: new Set(scheduleOf(e)) }));
  const recorded = new Set(attendance.map((a) => `${a.enrollmentId}|${a.date}`));

  const sessions: DashboardSession[] = [];
  let periodScheduled = 0;
  let periodRecorded = 0;
  let missingSessions = 0;
  const missingEnrollments = new Set<string>();

  for (let d = dayjs(from); !d.isAfter(dayjs(to), 'day'); d = d.add(1, 'day')) {
    const date = d.format('YYYY-MM-DD');
    if (closed.has(date)) continue;
    for (const c of classes.filter((x) => x.active && x.weekdays.includes(d.day()))) {
      const mine = schedules.filter((x) => x.e.classId === c.id && x.dates.has(date));
      if (!mine.length) continue;
      const done = mine.filter((x) => recorded.has(`${x.e.id}|${date}`));
      sessions.push({ date, cls: c, teacherName: teacherName(c.teacherId), students: mine.length, recorded: done.length });
      if (date <= TODAY) {
        periodScheduled += mine.length;
        periodRecorded += done.length;
      }
      if (date < TODAY) {
        mine.filter((x) => !recorded.has(`${x.e.id}|${date}`)).forEach((x) => {
          missingSessions += 1;
          missingEnrollments.add(x.e.id);
        });
      }
    }
  }
  const slotIndex = (id: string) => SLOTS.findIndex((x) => x.id === id);
  sessions.sort((a, b) => a.date.localeCompare(b.date) || slotIndex(a.cls.slotId) - slotIndex(b.cls.slotId));

  const unpaid = active.filter((e) => !e.tuitionReceived);
  return wait({
    activeStudents,
    sessions,
    periodScheduled,
    periodRecorded,
    missingSessions,
    missingStudents: missingEnrollments.size,
    makeupPending: computePendingMakeups().length,
    unpaidCount: unpaid.length,
    unpaidAmount: unpaid.reduce((n, e) => n + e.tuition, 0),
  });
}

export interface DashboardCharts {
  attendanceTrend: { date: string; present: number; late: number; absent: number }[];
  byGroup: { name: string; value: number }[];
  endingByWeek: { week: string; value: number; from: string; to: string }[];
  ratings: { rating: Rating; value: number }[];
}

export async function getDashboardCharts(from: string, to: string): Promise<DashboardCharts> {
  const perDate = new Map<string, { present: number; late: number; absent: number }>();
  const single = from === to;
  for (const a of attendance) {
    // một ngày đơn lẻ: lấy 14 ngày gần nhất tính đến ngày đó để biểu đồ có ngữ cảnh
    if (a.date > to || (!single && a.date < from)) continue;
    const row = perDate.get(a.date) ?? { present: 0, late: 0, absent: 0 };
    row[a.status] += 1;
    perDate.set(a.date, row);
  }
  const attendanceTrend = [...perDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(single ? -14 : -62)
    .map(([date, v]) => ({ date, ...v }));

  const active = enrollments.filter((e) => e.status === 'active');
  const groups = new Map<string, number>();
  for (const e of active) {
    const label = GROUP_LABEL[programById(e.programId).group];
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }
  const byGroup = [...groups.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const weekStart = dayjs(from).subtract((dayjs(from).day() + 6) % 7, 'day');
  const ends = active.map((e) => buildView(e).progress.endDate).filter((d): d is string => !!d);
  const endingByWeek = Array.from({ length: 8 }, (_, i) => {
    const from = weekStart.add(i * 7, 'day');
    const to = from.add(6, 'day');
    const value = ends.filter((d) => d >= from.format('YYYY-MM-DD') && d <= to.format('YYYY-MM-DD')).length;
    return { week: from.format('DD/MM'), value, from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') };
  });

  const ratings = (['good', 'average', 'redflag'] as Rating[]).map((rating) => ({
    rating,
    value: examResults.filter((r) => resultView(r).rating === rating).length,
  }));

  return wait({ attendanceTrend, byGroup, endingByWeek, ratings });
}

/* ---------- Chi tiết khi bấm vào biểu đồ ---------- */

export interface AttendanceDetailRow {
  studentId: string;
  studentName: string;
  program: string;
  className: string;
  status: AttendanceStatus;
  notified: boolean;
  note: string;
}

export async function getAttendanceDetail(date: string, status: AttendanceStatus): Promise<AttendanceDetailRow[]> {
  const rows = attendance
    .filter((a) => a.date === date && a.status === status)
    .map((a) => {
      const v = viewById(a.enrollmentId);
      return {
        studentId: v.student.id,
        studentName: v.student.name,
        program: v.program.name,
        className: v.cls.name,
        status: a.status,
        notified: a.notified,
        note: a.note,
      };
    });
  return wait(rows);
}

export async function getGroupDetail(groupLabel: string): Promise<EnrollmentView[]> {
  return wait(
    enrollments
      .filter((e) => e.status === 'active' && GROUP_LABEL[programById(e.programId).group] === groupLabel)
      .map(buildView),
  );
}

export async function getEndingDetail(from: string, to: string): Promise<EnrollmentView[]> {
  return wait(
    enrollments
      .filter((e) => e.status === 'active')
      .map(buildView)
      .filter((v) => v.progress.endDate && v.progress.endDate >= from && v.progress.endDate <= to)
      .sort((a, b) => (a.progress.endDate ?? '').localeCompare(b.progress.endDate ?? '')),
  );
}

export async function getRatingDetail(rating: Rating): Promise<ExamResultView[]> {
  return wait(examResults.map(resultView).filter((r) => r.rating === rating));
}

/* ---------- Lịch CAP ---------- */

export interface CapCell {
  cls: ClassRoom;
  teacherName: string;
  students: string[];
}

export async function getCap(group: string): Promise<Record<string, CapCell>> {
  const out: Record<string, CapCell> = {};
  for (const c of classes.filter((x) => x.active)) {
    for (const cell of c.cap.filter((x) => x.group === group)) {
      out[`${cell.slotId}|${cell.room}`] = {
        cls: c,
        teacherName: teacherName(c.teacherId),
        students: enrollments
          .filter((e) => e.classId === c.id && e.status === 'active')
          .map((e) => students.find((s) => s.id === e.studentId)!.name),
      };
    }
  }
  return wait(out);
}

export const CAP_GROUPS = [
  { value: '2-4-6', label: 'Thứ 2 - 4 - 6', days: [1, 3, 5], slots: ['chieu', 'toi1', 'toi2'], fromOffset: 0, toOffset: 4 },
  { value: '3-5', label: 'Thứ 3 - 5', days: [2, 4], slots: ['chieu', 'toi1', 'toi2'], fromOffset: 1, toOffset: 3 },
  { value: '7', label: 'Thứ 7', days: [6], slots: ['t7a', 't7b'], fromOffset: 5, toOffset: 5 },
];

export interface CapInput {
  classId: string;
  group: string;
  slotId: string;
  room: string;
}

/** Xếp một lớp thật vào ô CAP; chặn trùng phòng, trùng giáo viên và lớp không học vào các ngày của nhóm. */
export async function addCapSlot(input: CapInput): Promise<void> {
  const group = CAP_GROUPS.find((g) => g.value === input.group) ?? fail('Nhóm ngày không hợp lệ.');
  if (!group.slots.includes(input.slotId)) fail('Ca này không dùng cho nhóm ngày đã chọn.');
  const cls = classes.find((c) => c.id === input.classId) ?? fail('Không tìm thấy lớp.');
  if (!group.days.every((d) => cls.weekdays.includes(d))) fail(`Lớp "${cls.name}" không học vào các ngày của nhóm ${group.label}.`);
  const sameCell = classes.find((c) => c.cap.some((x) => x.group === input.group && x.slotId === input.slotId && x.room === input.room));
  if (sameCell) fail(`Phòng ${input.room} đã có lớp "${sameCell.name}" ở ca này.`);
  if (cls.cap.some((x) => x.group === input.group && x.slotId === input.slotId)) fail('Lớp này đã có lịch ở ca này.');
  const busyTeacher = classes.find(
    (c) => c.id !== cls.id && c.teacherId === cls.teacherId && c.cap.some((x) => x.group === input.group && x.slotId === input.slotId),
  );
  if (busyTeacher) fail(`Giáo viên ${teacherName(cls.teacherId)} đã dạy lớp "${busyTeacher.name}" cùng ca.`);
  cls.cap.push({ group: input.group, slotId: input.slotId, room: input.room });
  return wait(undefined);
}

export async function removeCapSlot(input: CapInput): Promise<void> {
  const cls = classes.find((c) => c.id === input.classId) ?? fail('Không tìm thấy lớp.');
  cls.cap = cls.cap.filter((x) => !(x.group === input.group && x.slotId === input.slotId && x.room === input.room));
  return wait(undefined);
}

/* ---------- Cài đặt ---------- */

export async function listStaff(): Promise<Staff[]> {
  return wait([...staff]);
}

export async function setStaffActive(id: string, active: boolean): Promise<Staff> {
  const s = staff.find((x) => x.id === id) ?? fail('Không tìm thấy nhân sự');
  s.active = active;
  return wait(s);
}

export async function listHolidays(): Promise<Holiday[]> {
  return wait([...holidays].sort((a, b) => a.date.localeCompare(b.date)));
}

export async function addHoliday(h: Holiday): Promise<void> {
  if (holidays.some((x) => x.date === h.date)) fail('Ngày này đã được ghi nhận nghỉ.');
  const hasRecords = attendance.some((a) => a.date === h.date);
  if (hasRecords) fail('Ngày này đã có điểm danh — cần đối chiếu trước khi đặt là ngày nghỉ.');
  holidays.push(h);
  return wait(undefined);
}

export async function removeHoliday(date: string): Promise<void> {
  const i = holidays.findIndex((h) => h.date === date);
  if (i >= 0) holidays.splice(i, 1);
  return wait(undefined);
}

export async function getConfig() {
  return wait({ ...config });
}

export async function setConfig(patch: Partial<typeof config>) {
  Object.assign(config, patch);
  return wait({ ...config });
}

export { pausedRangesOf, reserveEnd };
