/**
 * Cổng API duy nhất cho giao diện. `VITE_API_MODE=real` gọi backend thật (`real.ts`);
 * mặc định dùng dữ liệu giả trong bộ nhớ (`mock.ts`) để xem trước giao diện không cần máy chủ.
 * Hai bên có cùng chữ ký hàm nên trang không cần biết đang dùng bên nào.
 */
import { API_MODE } from '../env';
import * as mock from './mock';
import * as real from './real';

export type * from './mock';
export { CAP_GROUPS } from './mock';
export { ApiError, UNAUTHORIZED_EVENT } from './http';

type Api = Omit<typeof mock, 'TODAY' | 'CAP_GROUPS' | 'pausedRangesOf' | 'reserveEnd' | 'initApi'>;
const api: Api = API_MODE === 'real' ? real : mock;

/** Ngày "hôm nay" theo máy chủ (bản thật) hoặc cố định (bản xem trước). Gán lại sau khi `initApi()` xong. */
export let TODAY = mock.TODAY;

export async function initApi(): Promise<void> {
  if (API_MODE === 'real') TODAY = await real.fetchToday();
}

export const loginRequest = api.loginRequest;
export const logoutRequest = api.logoutRequest;
export const fetchSession = api.fetchSession;

export const listStudents = api.listStudents;
export const getStudentProfile = api.getStudentProfile;
export const createStudent = api.createStudent;
export const updateStudentStar = api.updateStudentStar;

export const listClasses = api.listClasses;
export const getClassDetail = api.getClassDetail;
export const listEnrollments = api.listEnrollments;
export const listPrograms = api.listPrograms;

export const getAttendanceSheet = api.getAttendanceSheet;
export const saveAttendance = api.saveAttendance;
export const getMonthLedger = api.getMonthLedger;

export const listMakeups = api.listMakeups;
export const scheduleMakeup = api.scheduleMakeup;
export const setMakeupStatus = api.setMakeupStatus;

export const listReserves = api.listReserves;
export const createReserve = api.createReserve;
export const markReturned = api.markReturned;

export const listExams = api.listExams;
export const getExamPlan = api.getExamPlan;
export const listUnitsFor = api.listUnitsFor;
export const listAllUnits = api.listAllUnits;
export const createExamPlan = api.createExamPlan;
export const saveExam = api.saveExam;
export const listReportStudents = api.listReportStudents;

export const listTasks = api.listTasks;
export const markTask = api.markTask;
export const getDashboard = api.getDashboard;
export const getDashboardCharts = api.getDashboardCharts;
export const getAttendanceDetail = api.getAttendanceDetail;
export const getGroupDetail = api.getGroupDetail;
export const getEndingDetail = api.getEndingDetail;
export const getRatingDetail = api.getRatingDetail;

export const getCap = api.getCap;
export const addCapSlot = api.addCapSlot;
export const removeCapSlot = api.removeCapSlot;

export const listStaff = api.listStaff;
export const setStaffActive = api.setStaffActive;
export const listHolidays = api.listHolidays;
export const addHoliday = api.addHoliday;
export const removeHoliday = api.removeHoliday;
export const getConfig = api.getConfig;
export const setConfig = api.setConfig;
export const importStudentsCsv = api.importStudentsCsv;

export const listTeachers = api.listTeachers;
export const createClass = api.createClass;
export const updateClass = api.updateClass;
export const createEnrollment = api.createEnrollment;
export const transferEnrollment = api.transferEnrollment;
export const createStaff = api.createStaff;
export const updateStaff = api.updateStaff;
export const createUnit = api.createUnit;
export const updateUnit = api.updateUnit;
export const listTeacherDirectory = api.listTeacherDirectory;
export const updateStudent = api.updateStudent;
