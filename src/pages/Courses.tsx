import { useQuery } from '@tanstack/react-query';
import { Alert, Flex, Input, Progress, Select, Table, Tabs, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listEnrollments, listPrograms, type EnrollmentView } from '../api';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { makeupQuota } from '../domain/makeup';
import { weekdaysLabel } from '../domain/schedule';
import type { Program, ProgramGroup } from '../domain/types';
import { GROUP_LABEL } from '../mock/catalog';
import { ENROLLMENT_STATUS_LABEL, fmtDate, fmtMoney } from '../i18n/vi';

function Enrollments() {
  const q = useQuery({ queryKey: ['enrollments'], queryFn: listEnrollments });
  const [search, setSearch] = useState('');
  const rows = useMemo(() => {
    const k = search.trim().toLowerCase();
    return (q.data ?? []).filter((r) => !k || r.student.name.toLowerCase().includes(k) || r.program.name.toLowerCase().includes(k));
  }, [q.data, search]);

  return (
    <>
      <Input.Search allowClear placeholder="Tìm học viên hoặc chương trình" style={{ width: 320, maxWidth: '100%', marginBottom: 12 }} onChange={(e) => setSearch(e.target.value)} />
      <Table<EnrollmentView>
        rowKey={(r) => r.enrollment.id}
        loading={q.isLoading}
        dataSource={rows}
        scroll={{ x: 1100 }}
        pagination={TABLE_PAGINATION}
        columns={[
          { title: 'Học viên', render: (_, r) => <Link to={`/hoc-vien/${r.student.id}`}>{r.student.name}</Link> },
          { title: 'Chương trình', render: (_, r) => r.program.name },
          { title: 'Lớp / ngày học', render: (_, r) => `${r.cls.name} · ${weekdaysLabel(r.enrollment.weekdays)}` },
          { title: 'Bắt đầu', render: (_, r) => fmtDate(r.enrollment.startDate) },
          {
            title: 'Tiến độ',
            width: 200,
            render: (_, r) => (
              <div>
                <Progress percent={Math.round((r.progress.held / Math.max(r.progress.total, 1)) * 100)} size="small" />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Theo lịch {r.progress.held} · đã ghi nhận {r.progress.recorded} · còn {r.progress.remaining}
                </Typography.Text>
              </div>
            ),
          },
          { title: 'Kết thúc buổi chính', render: (_, r) => fmtDate(r.progress.endDate) },
          { title: 'Bù', render: (_, r) => (r.quota ? `${r.makeupUsed}/${r.quota.maxCount}` : '—') },
          {
            title: 'Học phí',
            render: (_, r) => (
              <div>
                {fmtMoney(r.enrollment.tuition)}
                <div>{r.enrollment.tuitionReceived ? <Tag color="success">Đã nhận</Tag> : <Tag color="warning">Chưa nhận</Tag>}</div>
              </div>
            ),
          },
          { title: 'Trạng thái', render: (_, r) => ENROLLMENT_STATUS_LABEL[r.enrollment.status] },
        ]}
      />
    </>
  );
}

function Catalog() {
  const q = useQuery({ queryKey: ['programs'], queryFn: listPrograms });
  const [group, setGroup] = useState<ProgramGroup | 'all'>('all');
  const rows = (q.data ?? []).filter((p) => group === 'all' || p.group === group);

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Danh mục không thay thế bảng giá chính thức"
        description="Học phí, số buổi, sĩ số là dữ liệu có thể cập nhật. Chỉnh danh mục không tự ghi đè các khóa đã đăng ký. Gói tính theo tháng cần Admin xác nhận số buổi thực tế."
      />
      <Flex gap={8} align="center" style={{ marginBottom: 12 }}>
        <Select
          value={group}
          onChange={setGroup}
          style={{ width: 220 }}
          options={[{ value: 'all', label: `Tất cả nhóm (${q.data?.length ?? 0})` }, ...(Object.keys(GROUP_LABEL) as ProgramGroup[]).map((g) => ({ value: g, label: GROUP_LABEL[g] }))]}
        />
      </Flex>
      <Table<Program>
        rowKey="id"
        loading={q.isLoading}
        dataSource={rows}
        scroll={{ x: 820 }}
        pagination={TABLE_PAGINATION}
        columns={[
          { title: 'Chương trình', dataIndex: 'name', render: (v, r) => <div><strong>{v}</strong>{r.note && <div style={{ fontSize: 12, color: '#7b8499' }}>{r.note}</div>}</div> },
          { title: 'Nhóm', render: (_, r) => GROUP_LABEL[r.group] },
          { title: 'Học phí', dataIndex: 'tuition', render: fmtMoney, align: 'right', sorter: (a, b) => a.tuition - b.tuition },
          { title: 'Số buổi', render: (_, r) => (r.sessions ? `${r.sessions} buổi` : <Tag color="warning">Theo tháng — cần xác nhận</Tag>) },
          { title: 'Sĩ số', dataIndex: 'maxSize', render: (v) => `Tối đa ${v}` },
          {
            title: 'Chính sách bù',
            render: (_, r) => {
              const quota = makeupQuota(r);
              return quota ? `${quota.maxCount} × ${quota.minutes} phút` : <Tag>Chưa có</Tag>;
            },
          },
        ]}
      />
    </>
  );
}

export function CoursesPage() {
  return (
    <div className="fade-in">
      <PageHeader title="Khóa học" subtitle="Khóa đăng ký của từng học viên và danh mục 46 gói chương trình." />
      <Tabs
        items={[
          { key: 'enrollments', label: 'Khóa đăng ký', children: <Enrollments /> },
          { key: 'catalog', label: 'Danh mục chương trình', children: <Catalog /> },
        ]}
      />
    </div>
  );
}
