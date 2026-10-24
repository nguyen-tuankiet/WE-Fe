import { PlusOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Flex, Input, Segmented, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listClasses, listTeacherDirectory, type ClassRow, type TeacherInfo } from '../api';
import { useUser } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { StaffModal } from '../components/StaffModal';
import type { Role } from '../domain/types';
import { weekdaysLabel } from '../domain/schedule';
import { fmtDate } from '../i18n/vi';
import { SLOTS } from '../mock/db';
import { BRAND } from '../theme';

const TEACHER_ROLES: Role[] = ['teacher'];

interface Row extends TeacherInfo {
  classes: ClassRow[];
  students: number;
  weekly: number;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card size="small" styles={{ body: { padding: '14px 18px' } }}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <div style={{ fontSize: 30, fontWeight: 700, color: BRAND.red, lineHeight: 1.2 }}>{value}</div>
    </Card>
  );
}

/** Danh sách giáo viên kèm các lớp phụ trách, sĩ số và số buổi dạy mỗi tuần. Bấm vào một giáo viên để xem chi tiết. */
export function TeachersPage() {
  const user = useUser();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'all'>('active');
  const [creating, setCreating] = useState(false);
  const teachers = useQuery({ queryKey: ['teacher-directory'], queryFn: listTeacherDirectory });
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses });

  const all = useMemo<Row[]>(
    () =>
      (teachers.data ?? []).map((t) => {
        const mine = (classes.data ?? []).filter((c) => c.teacherId === t.id && c.active);
        return { ...t, classes: mine, students: mine.reduce((n, c) => n + c.studentCount, 0), weekly: mine.reduce((n, c) => n + c.weekdays.length, 0) };
      }),
    [teachers.data, classes.data],
  );
  const rows = useMemo(() => {
    const k = search.trim().toLowerCase();
    return all.filter((t) => (status === 'all' || t.active) && (!k || t.name.toLowerCase().includes(k) || t.email.toLowerCase().includes(k)));
  }, [all, search, status]);

  const active = all.filter((t) => t.active);
  const unassigned = (classes.data ?? []).filter((c) => c.active && !c.teacherId).length;

  return (
    <div className="fade-in">
      <PageHeader
        title="Giáo viên"
        subtitle="Giáo viên, các lớp phụ trách và khối lượng dạy mỗi tuần. Bấm vào một giáo viên để xem chi tiết."
        extra={
          user.roles.includes('admin') && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
              Thêm giáo viên
            </Button>
          )
        }
      />
      <StaffModal open={creating} presetRoles={TEACHER_ROLES} onClose={() => setCreating(false)} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat label="Giáo viên đang hoạt động" value={active.length} />
        <Stat label="Lớp đang dạy" value={active.reduce((n, t) => n + t.classes.length, 0)} />
        <Stat label="Học viên đang theo học" value={active.reduce((n, t) => n + t.students, 0)} />
        <Stat label="Lớp chưa có giáo viên" value={unassigned} />
      </div>

      <Card>
        <Flex gap={8} wrap justify="space-between" style={{ marginBottom: 12 }}>
          <Input.Search allowClear placeholder="Tìm tên hoặc email" style={{ width: 280, maxWidth: '100%' }} onChange={(e) => setSearch(e.target.value)} />
          <Segmented
            value={status}
            onChange={(v) => setStatus(v as 'active' | 'all')}
            options={[
              { value: 'active', label: `Đang hoạt động (${active.length})` },
              { value: 'all', label: `Tất cả (${all.length})` },
            ]}
          />
        </Flex>
        <Table<Row>
          rowKey="id"
          loading={teachers.isLoading || classes.isLoading}
          dataSource={rows}
          pagination={TABLE_PAGINATION}
          scroll={{ x: 1100 }}
          locale={{ emptyText: 'Chưa có giáo viên nào' }}
          onRow={(r) => ({ onClick: () => navigate(`/giao-vien/${r.id}`), style: { cursor: 'pointer' } })}
          columns={[
            {
              title: 'Giáo viên',
              sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
              render: (_, r) => (
                <div>
                  <strong>{r.name}</strong>
                  <div style={{ fontSize: 12, color: '#7b8499' }}>{r.email}</div>
                </div>
              ),
            },
            {
              title: 'Lớp phụ trách',
              render: (_, r) =>
                r.classes.length ? (
                  <Flex gap={4} wrap>
                    {r.classes.map((c) => (
                      <Tag key={c.id} style={{ margin: 0 }}>
                        {c.name}
                      </Tag>
                    ))}
                  </Flex>
                ) : (
                  <Typography.Text type="secondary">Chưa được phân công</Typography.Text>
                ),
            },
            { title: 'Ngày sinh', width: 120, render: (_, r) => fmtDate(r.birthday) },
            { title: 'Số lớp', width: 90, align: 'center', sorter: (a, b) => a.classes.length - b.classes.length, render: (_, r) => r.classes.length },
            { title: 'Học viên', width: 100, align: 'center', sorter: (a, b) => a.students - b.students, render: (_, r) => r.students },
            { title: 'Buổi / tuần', width: 110, align: 'center', sorter: (a, b) => a.weekly - b.weekly, render: (_, r) => r.weekly },
            {
              title: 'Lịch dạy',
              width: 230,
              render: (_, r) =>
                r.classes.length ? (
                  <div style={{ fontSize: 12 }}>
                    {r.classes.map((c) => (
                      <div key={c.id}>
                        {weekdaysLabel(c.weekdays)} · {SLOTS.find((s) => s.id === c.slotId)?.time ?? ''}
                      </div>
                    ))}
                  </div>
                ) : (
                  '—'
                ),
            },
            { title: 'Trạng thái', width: 110, render: (_, r) => (r.active ? <Tag color="success">Hoạt động</Tag> : <Tag>Đã khóa</Tag>) },
            { title: '', width: 90, render: (_, r) => <Link to={`/giao-vien/${r.id}`} onClick={(e) => e.stopPropagation()}>Chi tiết</Link> },
          ]}
        />
      </Card>
    </div>
  );
}
