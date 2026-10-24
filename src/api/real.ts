/**
 * Lớp API thật: gọi backend `/api/v1/...` và đổi dữ liệu về đúng kiểu mà giao diện đang dùng
 * (cùng chữ ký với `mock.ts`). Chỉ dùng khi `VITE_API_MODE=real`.
 */
import type {
  AttendanceStatus,
  ClassRoom,
  Enrollment,
  ExamPlan,
  ExamResult,
  Holiday,
  Makeup,
  MakeupStatus,
  Program,
  ProgramGroup,
  Rating,
  Reserve,
  Staff,
  Student,
  UnitContent,
  UnitScore,
  UnitTemplate,
} from '../domain/types';
import { GROUP_LABEL } from '../mock/catalog';
import { http } from './http';
import type {
  AttendanceDetailRow,
  AttendanceInput,
  CapCell,
  CapInput,
  ClassInput,
  ClassRow,
  DashboardCharts,
  DashboardSession,
  EnrollmentView,
  ExamResultView,
  ImportReport,
  LedgerCell,
  LedgerRow,
  MakeupView,
  NewEnrollment,
  NewMakeup,
  NewReserve,
  NewStudent,
  PendingMakeup,
  PlanView,
  ReserveView,
  SaveExamInput,
  SessionUserDto,
  SheetRow,
  StudentProfile,
  StaffInput,
  StudentPatch,
  StudentRow,
  Task,
  TeacherInfo,
  UnitInput,
} from './mock';

type Json = Record<string, any>;
const V1 = '/api/v1';

/* ---------- Phiên đăng nhập ---------- */

export async function fetchToday(): Promise<string> {
  const res = await http<{ today: string }>('GET', '/health');
  return res.today;
}

export async function initApi(): Promise<void> {
  return undefined;
}

export async function loginRequest(email: string, pin: string): Promise<SessionUserDto> {
  return (await http<{ user: SessionUserDto }>('POST', `${V1}/auth/login`, { email: email.trim(), pin })).user;
}

export async function logoutRequest(): Promise<void> {
  await http('POST', `${V1}/auth/logout`).catch(() => undefined);
}

/** Hỏi máy chủ phiên hiện tại còn hiệu lực không (cookie HttpOnly nên trình duyệt không tự biết). */
export async function fetchSession(): Promise<SessionUserDto | null> {
  try {
    return (await http<{ user: SessionUserDto }>('GET', `${V1}/me`)).user;
  } catch (e) {
    if ((e as { status?: number }).status === 401) return null;
    throw e;
  }
}

/* ---------- Chuyển đổi dữ liệu ---------- */

let programsCache: Map<string, Program> | null = null;

const toProgram = (p: Json): Program => ({
  id: p.id,
  group: p.group as ProgramGroup,
  name: p.name,
  tuition: p.tuition,
  sessions: p.sessionsCount ?? null,
  maxSize: p.maxSize,
  unitTemplate: p.unitTemplate ?? null,
  note: p.note ?? undefined,
});

async function programMap() {
  if (!programsCache) {
    const res = await http<{ programs: Json[] }>('GET', `${V1}/programs`);
    programsCache = new Map(res.programs.map((p) => [p.id, toProgram(p)]));
  }
  return programsCache;
}

const toClassRoom = (c: Json): ClassRoom => ({
  id: c.id,
  name: c.name,
  subject: c.subject ?? '',
  weekdays: c.weekdays ?? [],
  slotId: c.slotId ?? '',
  room: c.room ?? '',
  teacherId: c.teacherId ?? '',
  assistant: c.assistant ?? '',
  maxSize: c.maxSize ?? 0,
  active: c.active ?? true,
  cap: [],
});

const toStudent = (s: Json): Student => ({
  id: s.id,
  code: s.code ?? '',
  name: s.name,
  birthday: s.birthday ?? '',
  status: s.status ?? 'active',
  guardian: s.guardian ?? '',
  phone: s.phone ?? '',
  address: s.address ?? '',
  tuitionMode: s.tuitionMode ?? '',
  note: s.note ?? '',
  nextCourse: s.nextCourse ?? '',
  star: !!s.star,
  redflagBelow: s.redflagBelow ?? undefined,
  goodAbove: s.goodAbove ?? undefined,
});

const emptyProgress = { total: 0, held: 0, recorded: 0, remaining: 0, missing: 0, firstMissingDate: null, endDate: null };

interface ViewParts {
  id: string;
  student: Json;
  program: Json;
  cls: Json;
  extra?: Partial<EnrollmentView>;
  enrollment?: Partial<Enrollment>;
}

/** Khóa đăng ký rút gọn khi máy chủ chỉ trả tên (danh sách học bù, bảo lưu, kết quả kiểm tra…). */
function lightView(p: ViewParts, programs?: Map<string, Program>): EnrollmentView {
  const program = programs?.get(p.program.id) ?? { id: p.program.id, group: (p.program.group ?? 'foundation') as ProgramGroup, name: p.program.name, tuition: 0, sessions: null, maxSize: 10, unitTemplate: p.program.template ?? null };
  return {
    enrollment: {
      id: p.id,
      studentId: p.student.id,
      programId: p.program.id,
      classId: p.cls?.id ?? '',
      startDate: '',
      weekdays: [],
      totalSessions: 0,
      tuition: 0,
      tuitionReceived: true,
      status: 'active',
      note: '',
      ...p.enrollment,
    },
    student: toStudent(p.student),
    program,
    cls: toClassRoom(p.cls ?? { id: '', name: '—' }),
    schedule: [],
    progress: emptyProgress,
    quota: null,
    makeupUsed: 0,
    ...p.extra,
  };
}

function toView(e: Json, programs: Map<string, Program>, classes?: Map<string, ClassRoom>): EnrollmentView {
  const program = programs.get(e.program.id);
  const cls = classes?.get(e.class.id) ?? toClassRoom({ ...e.class, weekdays: e.weekdays });
  const view = lightView({ id: e.id, student: e.student, program: e.program, cls: e.class }, programs);
  return {
    ...view,
    enrollment: {
      id: e.id,
      studentId: e.student.id,
      programId: e.program.id,
      classId: e.class.id,
      startDate: e.startDate,
      weekdays: e.weekdays ?? [],
      totalSessions: e.totalSessions,
      tuition: e.tuition,
      tuitionReceived: e.tuitionReceived,
      status: e.status,
      note: e.note ?? '',
    },
    program: program ?? view.program,
    cls,
    progress: {
      total: e.progress.total,
      held: e.progress.held,
      recorded: e.progress.recorded,
      remaining: e.progress.remaining,
      missing: e.progress.missing,
      firstMissingDate: e.progress.firstMissingDate ?? null,
      endDate: e.progress.endDate ?? null,
    },
    quota: e.makeupQuota ?? null,
    makeupUsed: e.makeupUsed ?? 0,
  };
}

async function classMap(): Promise<Map<string, ClassRoom>> {
  try {
    const res = await http<{ classes: Json[] }>('GET', `${V1}/classes`);
    return new Map(res.classes.map((c) => [c.id, toClassRoom(c)]));
  } catch {
    return new Map();
  }
}

async function views(rows: Json[]): Promise<EnrollmentView[]> {
  const [programs, classes] = await Promise.all([programMap(), classMap()]);
  return rows.map((e) => toView(e, programs, classes));
}

const toReserve = (r: Json): Reserve => ({
  id: r.id,
  enrollmentId: r.enrollmentId,
  completedOn: r.completedOn,
  noticeAt: r.noticeAt,
  absentStreak: r.absentStreak,
  remainingSessions: r.remainingSessions,
  amount: r.amount,
  returnedOn: r.returnedOn ?? undefined,
  returnClassId: r.returnClassId ?? undefined,
  status: r.status,
  note: r.note ?? '',
});

const toMakeup = (m: Json): Makeup => ({
  id: m.id,
  enrollmentId: m.enrollmentId,
  absenceDate: m.absenceDate,
  date: m.date,
  minutes: m.minutes,
  room: m.room,
  status: m.status,
  notifiedParent: m.notifiedParent,
  note: m.note ?? '',
});

const toExamResult = (r: Json): ExamResult => ({
  id: r.id,
  planId: r.planId,
  enrollmentId: r.enrollmentId,
  date: r.date,
  examiner: r.examiner,
  units: (r.units ?? []).map((u: Json): UnitScore => ({ unitId: u.unitId, values: u.values })),
  snapshot: (r.snapshot ?? []).map(toUnitContent),
  comment: r.comment ?? '',
  support: r.support ?? '',
  overall: r.overall,
  percent: r.percent,
});

const toUnitContent = (u: Json): UnitContent => ({ id: u.id, name: u.name, topic: u.topic ?? '', words: u.words ?? [], patterns: u.patterns ?? [] });

/** Kết quả kiểm tra: ngưỡng đã dùng lúc chấm được gắn vào học viên để báo cáo hiển thị đúng như thời điểm chấm. */
function resultView(r: Json, programs?: Map<string, Program>): ExamResultView {
  const t = r.thresholds as { goodAbove: number; redflagBelow: number } | undefined;
  const view = lightView({ id: r.enrollmentId, student: { ...r.student, star: !!t, redflagBelow: t?.redflagBelow, goodAbove: t?.goodAbove }, program: { ...r.program, template: r.template }, cls: { id: '', name: '—' } }, programs);
  return { result: toExamResult(r), view, template: (r.template ?? null) as UnitTemplate | null, rating: r.overall as Rating, percent: r.percent };
}

/* ---------- Học viên ---------- */

export async function listStudents(): Promise<StudentRow[]> {
  const res = await http<{ students: Json[] }>('GET', `${V1}/students`);
  return res.students.map((s) => ({ ...toStudent(s), className: s.className ?? '—', activeCourses: s.activeCourses ?? 0 }));
}

export async function getStudentProfile(id: string): Promise<StudentProfile> {
  const raw = await http<Json>('GET', `${V1}/students/${id}`);
  const programs = await programMap();
  let exams: ExamResultView[] = [];
  if ((raw.exams ?? []).length > 0) {
    const report = await http<{ results: Json[] }>('GET', `${V1}/reports/students/${id}`).catch(() => ({ results: [] as Json[] }));
    exams = report.results.map((r) => resultView(r, programs));
  }
  return {
    student: toStudent(raw.student),
    enrollments: await views(raw.enrollments),
    reserves: (raw.reserves ?? []).map(toReserve),
    exams,
    attendanceCount: { present: raw.attendance?.present ?? 0, late: raw.attendance?.late ?? 0, absent: raw.attendance?.absent ?? 0 },
  };
}

export async function createStudent(input: NewStudent): Promise<Student> {
  const res = await http<{ student: Json }>('POST', `${V1}/students`, input);
  return toStudent(res.student);
}

export async function updateStudentStar(id: string, patch: Pick<Student, 'star' | 'redflagBelow' | 'goodAbove'>): Promise<Student> {
  const res = await http<{ student: Json }>('PATCH', `${V1}/students/${id}/star`, patch);
  return toStudent(res.student);
}

/* ---------- Lớp & khóa ---------- */

export async function listClasses(): Promise<ClassRow[]> {
  const res = await http<{ classes: Json[] }>('GET', `${V1}/classes`);
  return res.classes.map((c) => ({ ...toClassRoom(c), teacherName: c.teacherName ?? '—', studentCount: c.studentCount ?? 0 }));
}

export async function getClassDetail(id: string) {
  const res = await http<{ class: Json; students: Json[] }>('GET', `${V1}/classes/${id}`);
  const programs = await programMap();
  const cls = toClassRoom(res.class);
  return {
    cls,
    teacherName: (res.class.teacherName as string | null) ?? '—',
    students: res.students.map((e) => toView(e, programs, new Map([[cls.id, cls]]))),
  };
}

export async function listEnrollments(): Promise<EnrollmentView[]> {
  const res = await http<{ enrollments: Json[] }>('GET', `${V1}/enrollments`);
  return views(res.enrollments);
}

export async function listPrograms(): Promise<Program[]> {
  const res = await http<{ programs: Json[] }>('GET', `${V1}/programs`);
  return res.programs.filter((p) => p.active !== false).map(toProgram);
}

/* ---------- Điểm danh ---------- */

export async function getAttendanceSheet(classId: string, date: string): Promise<SheetRow[]> {
  const res = await http<{ rows: Json[] }>('GET', `${V1}/attendance/sheet?classId=${encodeURIComponent(classId)}&date=${date}`);
  return res.rows.map((r) => ({
    view: lightView({ id: r.enrollmentId, student: { id: r.studentId, code: r.studentCode, name: r.studentName }, program: { id: '', name: r.programName }, cls: { id: classId, name: '' } }),
    record: r.record
      ? { enrollmentId: r.enrollmentId, date, status: r.record.status as AttendanceStatus, notified: r.record.notified, note: r.record.note ?? '', by: r.record.by ?? '', at: r.record.updatedAt ?? '' }
      : undefined,
  }));
}

export async function saveAttendance(classId: string, date: string, items: AttendanceInput[], _by: string): Promise<number> {
  await http('PUT', `${V1}/attendance`, { classId, date, items });
  return items.length;
}

export async function getMonthLedger(classId: string, month: string) {
  const res = await http<{ dates: string[]; rows: Json[] }>('GET', `${V1}/attendance/ledger?classId=${encodeURIComponent(classId)}&month=${month}`);
  const rows: LedgerRow[] = res.rows.map((r) => ({
    view: lightView({ id: r.enrollmentId, student: { id: r.studentId, name: r.studentName }, program: { id: '', name: r.programName }, cls: { id: classId, name: '' } }),
    cells: r.cells as LedgerCell[],
  }));
  return { dates: res.dates, rows };
}

/* ---------- Học bù ---------- */

export async function listMakeups() {
  const res = await http<{ list: Json[]; pending: Json[] }>('GET', `${V1}/makeups`);
  // Màn xếp bù cần ngày kết thúc buổi chính và phòng của lớp: lấy thêm khi có quyền (Admin/Manager)
  const full = new Map<string, EnrollmentView>();
  if (res.pending.length > 0 || res.list.length > 0) {
    try {
      (await listEnrollments()).forEach((v) => full.set(v.enrollment.id, v));
    } catch {
      /* giáo viên chỉ xem: dùng dữ liệu rút gọn */
    }
  }
  const viewFor = (enrollmentId: string, raw: Json, minutes: number): EnrollmentView => {
    const base = full.get(enrollmentId) ?? lightView({ id: enrollmentId, student: raw.student, program: raw.program, cls: raw.class });
    return { ...base, quota: { maxCount: raw.quota?.maxCount ?? base.quota?.maxCount ?? 0, minutes }, makeupUsed: raw.quota?.used ?? base.makeupUsed };
  };
  const list: MakeupView[] = res.list.map((m) => ({ makeup: toMakeup(m), view: viewFor(m.enrollmentId, m, m.minutes) }));
  const pending: PendingMakeup[] = res.pending.map((p) => ({ view: viewFor(p.enrollmentId, p, p.minutes), absenceDate: p.absenceDate }));
  return { list, pending };
}

export async function scheduleMakeup(input: NewMakeup): Promise<Makeup> {
  const res = await http<{ makeup: Json }>('POST', `${V1}/makeups`, input);
  return toMakeup(res.makeup);
}

export async function setMakeupStatus(id: string, status: MakeupStatus, note: string): Promise<Makeup> {
  const res = await http<{ makeup: Json }>('PATCH', `${V1}/makeups/${id}`, { status, note });
  return toMakeup(res.makeup);
}

/* ---------- Bảo lưu ---------- */

export async function listReserves(): Promise<ReserveView[]> {
  const res = await http<{ reserves: Json[] }>('GET', `${V1}/reserves`);
  const programs = await programMap();
  return res.reserves.map((r) => ({
    reserve: toReserve(r),
    view: lightView({ id: r.enrollmentId, student: r.student, program: r.program, cls: r.class }, programs),
    expiresOn: r.expiresOn,
    daysLeft: r.daysLeft,
  }));
}

export async function createReserve(input: NewReserve): Promise<Reserve> {
  const res = await http<Json>('POST', `${V1}/reserves`, input);
  return toReserve(res.reserve ?? res);
}

export async function markReturned(id: string, classId: string, returnedOn: string): Promise<Reserve> {
  const res = await http<Json>('POST', `${V1}/reserves/${id}/return`, { classId, returnedOn });
  return toReserve(res.reserve ?? res);
}

/* ---------- Học vụ & kiểm tra ---------- */

export async function listAllUnits(): Promise<Record<UnitTemplate, UnitContent[]>> {
  const res = await http<{ units: Json[] }>('GET', `${V1}/academics/units`);
  const out: Record<UnitTemplate, UnitContent[]> = { baby: [], foundation: [], cambridge: [] };
  res.units.filter((u) => u.active !== false).forEach((u) => out[u.template as UnitTemplate]?.push(toUnitContent(u)));
  return out;
}

export async function listUnitsFor(template: UnitTemplate): Promise<UnitContent[]> {
  return (await listAllUnits())[template];
}

const toPlan = (p: Json): ExamPlan => ({ id: p.id, enrollmentId: p.enrollmentId, plannedDate: p.plannedDate, unitIds: (p.units ?? []).map((u: Json) => u.id), status: p.status });

export async function listExams() {
  const res = await http<{ plans: Json[]; results: Json[] }>('GET', `${V1}/exams`);
  const programs = await programMap();
  const plans: PlanView[] = res.plans.map((p) => ({
    plan: toPlan(p),
    view: lightView({ id: p.enrollmentId, student: p.student, program: p.program, cls: { id: '', name: '—' } }, programs),
    units: (p.units ?? []).map(toUnitContent),
  }));
  return { plans, results: res.results.map((r) => resultView(r, programs)) };
}

export async function getExamPlan(planId: string) {
  const res = await http<{ plan: Json; units: Json[]; result: Json | null }>('GET', `${V1}/exams/plans/${planId}`);
  const programs = await programMap();
  // Ngưỡng sao riêng của học viên để xem trước phân loại khi chấm (máy chủ vẫn tự tính lại khi lưu)
  const student = await http<{ student: Json }>('GET', `${V1}/students/${res.plan.student.id}`).then((s) => s.student).catch(() => res.plan.student);
  const view = lightView({ id: res.plan.enrollmentId, student, program: res.plan.program, cls: { id: '', name: '—' } }, programs);
  return {
    plan: toPlan(res.plan),
    view,
    template: (res.plan.program.template ?? null) as UnitTemplate | null,
    units: res.units.map(toUnitContent),
    existing: res.result ? toExamResult(res.result) : undefined,
  };
}

export async function createExamPlan(enrollmentId: string, plannedDate: string, unitIds: string[]): Promise<ExamPlan> {
  const res = await http<{ plan: Json }>('POST', `${V1}/exams/plans`, { enrollmentId, plannedDate, unitIds });
  return toPlan(res.plan);
}

export async function saveExam(input: SaveExamInput): Promise<ExamResult> {
  const res = await http<{ result: Json }>('PUT', `${V1}/exams/plans/${input.planId}/result`, {
    units: input.units.map((u) => ({ unitId: u.unitId, values: u.values })),
    comment: input.comment,
    support: input.support,
  });
  return toExamResult(res.result);
}

export async function listReportStudents(): Promise<Student[]> {
  const res = await http<{ students: Json[] }>('GET', `${V1}/reports/students`);
  return res.students.map(toStudent);
}

/* ---------- Việc cần quan tâm ---------- */

export async function listTasks(): Promise<Task[]> {
  const res = await http<{ tasks: Json[] }>('GET', `${V1}/tasks`);
  return res.tasks.map((t) => ({ key: t.key, type: t.type, title: t.title, detail: t.detail, date: t.date, handled: t.handled ?? undefined }));
}

export async function markTask(key: string, _by: string, done: boolean): Promise<void> {
  await http('PUT', `${V1}/tasks/${encodeURIComponent(key)}`, { done });
}

/* ---------- Tổng quan ---------- */

export async function getDashboard(from: string, to: string) {
  const res = await http<Json>('GET', `${V1}/dashboard?from=${from}&to=${to}`);
  const sessions: DashboardSession[] = res.sessions.map((s: Json) => ({
    date: s.date,
    cls: toClassRoom(s.class),
    teacherName: s.class.teacherName ?? '—',
    students: s.students,
    recorded: s.recorded,
  }));
  return {
    activeStudents: res.activeStudents ?? 0,
    sessions,
    periodScheduled: res.periodScheduled ?? 0,
    periodRecorded: res.periodRecorded ?? 0,
    missingSessions: res.missingSessions ?? 0,
    missingStudents: res.missingStudents ?? 0,
    makeupPending: res.makeupPending ?? 0,
    unpaidCount: res.unpaidCount ?? 0,
    unpaidAmount: res.unpaidAmount ?? 0,
  };
}

export async function getDashboardCharts(from: string, to: string): Promise<DashboardCharts> {
  return http<DashboardCharts>('GET', `${V1}/dashboard/charts?from=${from}&to=${to}`);
}

export async function getAttendanceDetail(date: string, status: AttendanceStatus): Promise<AttendanceDetailRow[]> {
  return (await http<{ rows: AttendanceDetailRow[] }>('GET', `${V1}/dashboard/detail/attendance?date=${date}&status=${status}`)).rows;
}

export async function getGroupDetail(groupLabel: string): Promise<EnrollmentView[]> {
  const key = (Object.keys(GROUP_LABEL) as ProgramGroup[]).find((k) => GROUP_LABEL[k] === groupLabel) ?? groupLabel;
  const res = await http<{ enrollments: Json[] }>('GET', `${V1}/dashboard/detail/group?group=${encodeURIComponent(key)}`);
  return views(res.enrollments);
}

export async function getEndingDetail(from: string, to: string): Promise<EnrollmentView[]> {
  const res = await http<{ enrollments: Json[] }>('GET', `${V1}/dashboard/detail/ending?from=${from}&to=${to}`);
  return views(res.enrollments);
}

export async function getRatingDetail(rating: Rating): Promise<ExamResultView[]> {
  const res = await http<{ results: Json[] }>('GET', `${V1}/dashboard/detail/rating?rating=${rating}`);
  const programs = await programMap();
  return res.results.map((r) => resultView(r, programs));
}

/* ---------- Lịch CAP ---------- */

export async function getCap(group: string): Promise<Record<string, CapCell>> {
  const res = await http<{ cells: Json[] }>('GET', `${V1}/cap?group=${encodeURIComponent(group)}`);
  const out: Record<string, CapCell> = {};
  for (const c of res.cells) {
    out[`${c.slotId}|${c.room}`] = {
      cls: toClassRoom({ ...c.class, slotId: c.slotId, room: c.room }),
      teacherName: c.teacherName ?? '—',
      students: c.students,
    };
  }
  return out;
}

export async function addCapSlot(input: CapInput): Promise<void> {
  await http('POST', `${V1}/cap`, input);
}

export async function removeCapSlot(input: CapInput): Promise<void> {
  await http('DELETE', `${V1}/cap?group=${encodeURIComponent(input.group)}&slotId=${encodeURIComponent(input.slotId)}&room=${encodeURIComponent(input.room)}`);
}

/* ---------- Cài đặt ---------- */

const toStaff = (s: Json): Staff => ({ id: s.id, name: s.name, email: s.email, roles: s.roles, active: s.active, birthday: s.birthday ?? null });

export async function listStaff(): Promise<Staff[]> {
  return (await http<{ staff: Json[] }>('GET', `${V1}/staff`)).staff.map(toStaff);
}

export async function setStaffActive(id: string, active: boolean): Promise<Staff> {
  return toStaff((await http<{ staff: Json }>('PATCH', `${V1}/staff/${id}`, { active })).staff);
}

export async function listHolidays(): Promise<Holiday[]> {
  return (await http<{ holidays: Holiday[] }>('GET', `${V1}/holidays`)).holidays;
}

export async function addHoliday(h: Holiday): Promise<void> {
  await http('POST', `${V1}/holidays`, h);
}

export async function removeHoliday(date: string): Promise<void> {
  await http('DELETE', `${V1}/holidays/${date}`);
}

type Config = { reminderDays: number; teacherEditDays: number; redflagBelow: number; goodAbove: number };

export async function getConfig(): Promise<Config> {
  return (await http<{ settings: Config }>('GET', `${V1}/settings`)).settings;
}

export async function setConfig(patch: Partial<Config>): Promise<Config> {
  return (await http<{ settings: Config }>('PUT', `${V1}/settings`, patch)).settings;
}

/* ---------- Nhập dữ liệu ---------- */

export async function importStudentsCsv(csv: string, dryRun: boolean): Promise<ImportReport> {
  return http<ImportReport>('POST', `${V1}/import/students`, { csv, dryRun });
}

/* ---------- Nhập liệu ban đầu: lớp, khóa, chuyển lớp, nhân sự, khung Unit ---------- */

export async function listTeachers(): Promise<{ id: string; name: string }[]> {
  return (await http<{ teachers: { id: string; name: string }[] }>('GET', `${V1}/teachers`)).teachers;
}

export async function createClass(input: ClassInput): Promise<ClassRoom> {
  return toClassRoom((await http<{ class: Json }>('POST', `${V1}/classes`, input)).class);
}

export async function updateClass(id: string, patch: Partial<ClassInput> & { active?: boolean }): Promise<ClassRoom> {
  return toClassRoom((await http<{ class: Json }>('PATCH', `${V1}/classes/${id}`, patch)).class);
}

export async function createEnrollment(input: NewEnrollment): Promise<void> {
  await http('POST', `${V1}/enrollments`, input);
}

export async function transferEnrollment(id: string, input: { toClassId: string; effectiveDate: string; weekdays?: number[]; note?: string }): Promise<void> {
  await http('POST', `${V1}/enrollments/${id}/transfer`, input);
}

export async function createStaff(input: StaffInput): Promise<Staff> {
  return toStaff((await http<{ staff: Json }>('POST', `${V1}/staff`, input)).staff);
}

export async function updateStaff(id: string, patch: { name?: string; roles?: Staff['roles']; pin?: string; birthday?: string | null }): Promise<Staff> {
  return toStaff((await http<{ staff: Json }>('PATCH', `${V1}/staff/${id}`, patch)).staff);
}

export async function createUnit(input: UnitInput): Promise<UnitContent> {
  return toUnitContent((await http<{ unit: Json }>('POST', `${V1}/academics/units`, input)).unit);
}

export async function updateUnit(id: string, patch: Partial<Omit<UnitInput, 'template'>>): Promise<UnitContent> {
  return toUnitContent((await http<{ unit: Json }>('PATCH', `${V1}/academics/units/${id}`, patch)).unit);
}

export async function listTeacherDirectory(): Promise<TeacherInfo[]> {
  return (await http<{ teachers: TeacherInfo[] }>('GET', `${V1}/teachers?all=1`)).teachers;
}

export async function updateStudent(id: string, patch: StudentPatch): Promise<Student> {
  return toStudent((await http<{ student: Json }>('PATCH', `${V1}/students/${id}`, patch)).student);
}
