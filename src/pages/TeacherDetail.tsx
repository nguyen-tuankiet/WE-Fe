import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Progress, Spin, Table, Tabs, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../auth/AuthContext';
import { StaffModal } from '../components/StaffModal';
import { listClasses, listEnrollments, listStaff, listTeacherDirectory, type ClassRow, type EnrollmentView } from '../api';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { weekdaysLabel } from '../domain/schedule';
import { fmtDate } from '../i18n/vi';
import { SLOTS } from '../mock/db';
import { BRAND } from '../theme';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL = (d: number) => (d === 0 ? 'CN' : `Thứ ${d + 1}`);

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: '#7b8499', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

/** Chi tiết giáo viên: thông tin, lớp phụ trách, lịch dạy theo tuần và học viên của các lớp. */
export function TeacherDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const teachers = useQuery({ queryKey: ['teacher-directory'], queryFn: listTeacherDirectory });
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const enrollments = useQuery({ queryKey: ['enrollments'], queryFn: listEnrollments });
  const user = useUser();
  const isAdmin = user.roles.includes('admin');
  const staff = useQuery({ queryKey: ['staff'], queryFn: listStaff, enabled: isAdmin });
  const [editing, setEditing] = useState(false);

  const back = (
    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/giao-vien')} style={{ marginBottom: 8, paddingLeft: 0 }}>
      Danh sách giáo viên
    </Button>
  );
  if (teachers.isLoading || classes.isLoading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
  const teacher = teachers.data?.find((t) => t.id === id);
  if (!teacher) {
    return (
      <div className="fade-in">
        {back}
        <Alert type="error" showIcon title="Không tìm thấy giáo viên này" />
      </div>
    );
  }

  const mine = (classes.data ?? []).filter((c) => c.teacherId === id);
  const active = mine.filter((c) => c.active);
  const ids = new Set(active.map((c) => c.id));
  const students = (enrollments.data ?? []).filter((v) => ids.has(v.cls.id) && v.enrollment.status === 'active');
  const weekly = active.reduce((n, c) => n + c.weekdays.length, 0);
  const slotsUsed = SLOTS.filter((s) => active.some((c) => c.slotId === s.id));

  return (
    <div className="fade-in">
      {back}
      <PageHeader
        title={teacher.name}
        subtitle={`${teacher.email} · ${teacher.active ? 'Đang hoạt động' : 'Tài khoản đã khóa'}`}
        extra={
          isAdmin &&
          staff.data?.find((s) => s.id === id) && (
            <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Sửa thông tin
            </Button>
          )
        }
      />
      <StaffModal open={editing} editing={staff.data?.find((s) => s.id === id) ?? null} onClose={() => setEditing(false)} />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 20 }}>
          <Info label="Email">{teacher.email}</Info>
          <Info label="Ngày sinh">{fmtDate(teacher.birthday)}</Info>
          <Info label="Lớp đang dạy">{active.length}</Info>
          <Info label="Học viên đang dạy">{enrollments.isError ? '—' : students.length}</Info>
          <Info label="Buổi dạy mỗi tuần">{weekly}</Info>
          <Info label="Trạng thái">{teacher.active ? <Tag color="success">Hoạt động</Tag> : <Tag>Đã khóa</Tag>}</Info>
        </div>
      </Card>

      <Card>
        <Tabs
          items={[
            {
              key: 'classes',
              label: `Lớp phụ trách (${mine.length})`,
              children: (
                <Table<ClassRow>
                  rowKey="id"
                  dataSource={mine}
                  pagination={false}
                  scroll={{ x: 760 }}
                  locale={{ emptyText: <Empty description="Giáo viên chưa được phân công lớp nào" /> }}
                  columns={[
                    { title: 'Lớp', render: (_, c) => <Link to={`/lop-hoc/${c.id}`}>{c.name}</Link> },
                    { title: 'Ngày học', width: 110, render: (_, c) => weekdaysLabel(c.weekdays) },
                    { title: 'Ca', width: 190, render: (_, c) => { const s = SLOTS.find((x) => x.id === c.slotId); return s ? `${s.label} · ${s.time}` : '—'; } },
                    { title: 'Phòng', dataIndex: 'room', width: 90 },
                    { title: 'Trợ giảng', dataIndex: 'assistant', width: 120, render: (v) => v || '—' },
                    { title: 'Sĩ số', width: 150, render: (_, c) => <Progress percent={Math.round((c.studentCount / Math.max(c.maxSize, 1)) * 100)} size="small" format={() => `${c.studentCount}/${c.maxSize}`} /> },
                    { title: 'Trạng thái', width: 110, render: (_, c) => (c.active ? <Tag color="success">Hoạt động</Tag> : <Tag>Ngừng</Tag>) },
                  ]}
                />
              ),
            },
            {
              key: 'week',
              label: 'Lịch dạy trong tuần',
              children: active.length === 0 ? (
                <Empty description="Chưa có lịch dạy" />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', minWidth: 720, width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: 8, color: '#7b8499', fontWeight: 500, width: 170 }}>Ca</th>
                        {DAYS.map((d) => (
                          <th key={d} style={{ padding: 8, color: '#7b8499', fontWeight: 500 }}>
                            {DAY_LABEL(d)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slotsUsed.map((s) => (
                        <tr key={s.id} style={{ borderTop: '1px solid #f1e6e7' }}>
                          <td style={{ padding: 8 }}>
                            <b>{s.label}</b>
                            <div style={{ fontSize: 12, color: '#7b8499' }}>{s.time}</div>
                          </td>
                          {DAYS.map((d) => {
                            const cs = active.filter((c) => c.slotId === s.id && c.weekdays.includes(d));
                            return (
                              <td key={d} style={{ padding: 6, verticalAlign: 'top' }}>
                                {cs.map((c) => (
                                  <div key={c.id} style={{ background: BRAND.redSoft, color: BRAND.redDark, borderRadius: 6, padding: '3px 6px', marginBottom: 4, fontSize: 12 }}>
                                    <b>{c.name}</b>
                                    <div>P.{c.room}</div>
                                  </div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
            },
            {
              key: 'students',
              label: `Học viên (${enrollments.isError ? 0 : students.length})`,
              children: (
                <Table<EnrollmentView>
                  rowKey={(r) => r.enrollment.id}
                  loading={enrollments.isLoading}
                  dataSource={students}
                  pagination={TABLE_PAGINATION}
                  scroll={{ x: 900 }}
                  locale={{ emptyText: <Empty description="Chưa có học viên" /> }}
                  columns={[
                    { title: 'Học viên', render: (_, r) => <Link to={`/hoc-vien/${r.student.id}`}>{r.student.name}</Link> },
                    { title: 'Lớp', render: (_, r) => <Link to={`/lop-hoc/${r.cls.id}`}>{r.cls.name}</Link> },
                    { title: 'Chương trình', render: (_, r) => r.program.name },
                    { title: 'Ngày bắt đầu', width: 120, render: (_, r) => fmtDate(r.enrollment.startDate) },
                    { title: 'Ngày kết thúc khóa', width: 140, render: (_, r) => fmtDate(r.progress.endDate) },
                    { title: 'Buổi hiện tại / tổng', width: 150, align: 'center', render: (_, r) => <strong>{r.progress.held}/{r.progress.total}</strong> },
                    { title: 'Điểm danh', width: 110, render: (_, r) => (r.progress.missing > 0 ? <Tag color="error">Thiếu {r.progress.missing}</Tag> : <Tag color="success">Đủ</Tag>) },
                  ]}
                />
              ),
            },
          ]}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Giáo viên chỉ thấy lớp và học viên của chính mình; trang này dành cho Admin và Manager.
        </Typography.Text>
      </Card>
    </div>
  );
}
