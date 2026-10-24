import type { Role } from '../domain/types';

export type Feature =
  | 'dashboard'
  | 'students'
  | 'classes'
  | 'attendance'
  | 'courses'
  | 'makeup'
  | 'reserve'
  | 'academics'
  | 'reports'
  | 'cap'
  | 'teachers'
  | 'settings';

/** Ma trận quyền theo docs/01 (đề xuất). Backend phải kiểm lại ở API — đây chỉ để ẩn/hiện menu. */
export const ACCESS: Record<Feature, Role[]> = {
  dashboard: ['admin', 'manager', 'teacher', 'inspector'],
  students: ['admin', 'manager', 'teacher', 'inspector'],
  classes: ['admin', 'manager', 'teacher', 'inspector'],
  attendance: ['admin', 'manager', 'teacher'],
  courses: ['admin', 'manager'],
  makeup: ['admin', 'manager', 'teacher'],
  reserve: ['admin', 'manager'],
  academics: ['admin', 'manager', 'inspector'],
  reports: ['admin', 'manager', 'inspector'],
  cap: ['admin', 'manager'],
  teachers: ['admin', 'manager'],
  settings: ['admin', 'manager'],
};

export const can = (roles: Role[], feature: Feature) => roles.some((r) => ACCESS[feature].includes(r));

export const isManagement = (roles: Role[]) => roles.includes('admin') || roles.includes('manager');

/** Giáo viên thuần (không phải Admin/Manager) chỉ thao tác lớp được phân công. */
export const isTeacherOnly = (roles: Role[]) => roles.includes('teacher') && !isManagement(roles);

/** Liên hệ riêng & học phí chỉ Admin/Manager thấy. */
export const canSeePrivate = (roles: Role[]) => isManagement(roles);
