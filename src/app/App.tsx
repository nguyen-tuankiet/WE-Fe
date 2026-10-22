import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { LoginPage } from '../pages/Login';

const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));

const DashboardPage = page(() => import('../pages/Dashboard'), 'DashboardPage');
const StudentsPage = page(() => import('../pages/Students'), 'StudentsPage');
const StudentProfilePage = page(() => import('../pages/StudentProfile'), 'StudentProfilePage');
const ClassesPage = page(() => import('../pages/Classes'), 'ClassesPage');
const AttendancePage = page(() => import('../pages/Attendance'), 'AttendancePage');
const CoursesPage = page(() => import('../pages/Courses'), 'CoursesPage');
const MakeupPage = page(() => import('../pages/Makeup'), 'MakeupPage');
const ReservePage = page(() => import('../pages/Reserve'), 'ReservePage');
const AcademicsPage = page(() => import('../pages/Academics'), 'AcademicsPage');
const GradingPage = page(() => import('../pages/Grading'), 'GradingPage');
const ReportsPage = page(() => import('../pages/Reports'), 'ReportsPage');
const CapPage = page(() => import('../pages/Cap'), 'CapPage');
const SettingsPage = page(() => import('../pages/Settings'), 'SettingsPage');

export function App() {
  return (
    <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '120px auto' }} />}>
      <Routes>
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/tong-quan" replace />} />
          <Route path="/tong-quan" element={<DashboardPage />} />
          <Route path="/hoc-vien" element={<StudentsPage />} />
          <Route path="/hoc-vien/:id" element={<StudentProfilePage />} />
          <Route path="/lop-hoc" element={<ClassesPage />} />
          <Route path="/diem-danh" element={<AttendancePage />} />
          <Route path="/khoa-hoc" element={<CoursesPage />} />
          <Route path="/hoc-bu" element={<MakeupPage />} />
          <Route path="/bao-luu" element={<ReservePage />} />
          <Route path="/hoc-vu" element={<AcademicsPage />} />
          <Route path="/hoc-vu/cham/:planId" element={<GradingPage />} />
          <Route path="/bao-cao" element={<ReportsPage />} />
          <Route path="/lich-cap" element={<CapPage />} />
          <Route path="/cai-dat" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/tong-quan" replace />} />
      </Routes>
    </Suspense>
  );
}
