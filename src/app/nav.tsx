import {
  BankOutlined,
  BarChartOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  HistoryOutlined,
  PauseCircleOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { Feature } from '../auth/permissions';

export interface NavItem {
  path: string;
  feature: Feature;
  label: string;
  icon: ReactNode;
}

export const NAV: NavItem[] = [
  { path: '/tong-quan', feature: 'dashboard', label: 'Tổng quan', icon: <DashboardOutlined /> },
  { path: '/hoc-vien', feature: 'students', label: 'Học viên', icon: <TeamOutlined /> },
  { path: '/lop-hoc', feature: 'classes', label: 'Lớp học', icon: <BankOutlined /> },
  { path: '/diem-danh', feature: 'attendance', label: 'Điểm danh', icon: <CheckSquareOutlined /> },
  { path: '/khoa-hoc', feature: 'courses', label: 'Khóa học', icon: <BookOutlined /> },
  { path: '/hoc-bu', feature: 'makeup', label: 'Học bù', icon: <HistoryOutlined /> },
  { path: '/bao-luu', feature: 'reserve', label: 'Bảo lưu', icon: <PauseCircleOutlined /> },
  { path: '/hoc-vu', feature: 'academics', label: 'Học vụ & Kiểm tra', icon: <ExperimentOutlined /> },
  { path: '/bao-cao', feature: 'reports', label: 'Báo cáo', icon: <BarChartOutlined /> },
  { path: '/lich-cap', feature: 'cap', label: 'Lịch CAP', icon: <CalendarOutlined /> },
  { path: '/cai-dat', feature: 'settings', label: 'Cài đặt', icon: <SettingOutlined /> },
];
