import dayjs from 'dayjs';
import type {
  AttendanceStatus,
  EnrollmentStatus,
  MakeupStatus,
  Rating,
  ReserveStatus,
  Role,
  StudentStatus,
} from '../domain/types';

export const fmtDate = (d?: string | null) => (d ? dayjs(d).format('DD/MM/YYYY') : '—');
export const fmtShort = (d?: string | null) => (d ? dayjs(d).format('DD/MM') : '—');
export const fmtMoney = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)} ₫`;
export const fmtPercent = (n: number) => `${Math.round(n * 10) / 10}%`;

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  teacher: 'Giáo viên',
  inspector: 'Thanh tra nội bộ',
};

export const ATTENDANCE_LABEL: Record<AttendanceStatus | 'none', string> = {
  present: 'Có mặt',
  late: 'Đi trễ',
  absent: 'Vắng',
  none: 'Chưa ghi nhận',
};

export const ATTENDANCE_COLOR: Record<AttendanceStatus | 'none', string> = {
  present: 'success',
  late: 'warning',
  absent: 'error',
  none: 'default',
};

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  active: 'Đang học',
  reserved: 'Bảo lưu',
  left: 'Đã nghỉ',
};

export const STUDENT_STATUS_COLOR: Record<StudentStatus, string> = {
  active: 'success',
  reserved: 'warning',
  left: 'default',
};

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  active: 'Đang học',
  reserved: 'Bảo lưu',
  completed: 'Hoàn tất',
};

export const MAKEUP_STATUS_LABEL: Record<MakeupStatus, string> = {
  scheduled: 'Đã xếp',
  done: 'Hoàn tất',
  missed: 'Vắng bù',
  cancelled: 'Đã hủy',
};

export const MAKEUP_STATUS_COLOR: Record<MakeupStatus, string> = {
  scheduled: 'processing',
  done: 'success',
  missed: 'error',
  cancelled: 'default',
};

export const RESERVE_STATUS_LABEL: Record<ReserveStatus, string> = {
  active: 'Đang bảo lưu',
  returned: 'Đã quay lại',
  expired: 'Hết hạn',
};

export const RESERVE_STATUS_COLOR: Record<ReserveStatus, string> = {
  active: 'warning',
  returned: 'success',
  expired: 'error',
};

export const RATING_LABEL: Record<Rating, string> = {
  good: 'Good',
  average: 'Average',
  redflag: 'Redflag',
};

export const RATING_COLOR: Record<Rating, string> = {
  good: 'success',
  average: 'warning',
  redflag: 'error',
};
