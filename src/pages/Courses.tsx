import { useQuery } from '@tanstack/react-query';
import { PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Input, Select, Table, Tabs, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TODAY, listEnrollments, listPrograms, type EnrollmentView } from '../api';
import { NewEnrollmentModal } from '../components/EnrollmentModals';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { makeupQuota } from '../domain/makeup';

import type { Program, ProgramGroup } from '../domain/types';
import { GROUP_LABEL } from '../mock/catalog';
import { fmtDate, fmtMoney } from '../i18n/vi';

const SOON_DAYS = 14;

const minDate = (list: (string | null)[]) => list.filter((d): d is string => !!d).sort()[0] ?? '';
const maxDate = (list: (string | null)[]) => list.filter((d): d is string => !!d).sort().slice(-1)[0] ?? '';

const isEndingSoon = (v: EnrollmentView) => !!v.progress.endDate && v.progress.endDate >= TODAY && dayjs(v.progress.endDate).diff(dayjs(TODAY), 'day') <= SOON_DAYS;

interface ProgramGroupRow {
  program: Program;
  views: EnrollmentView[];
}

/** Một dòng cho mỗi chương trình (không lặp theo từng học viên); bấm vào để xem danh sách học viên của chương trình. */
function Enrollments() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ['enrollments'], queryFn: listEnrollments });
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const rows = useMemo<ProgramGroupRow[]>(() => {
    const map = new Map<string, ProgramGroupRow>();
    for (const v of q.data ?? []) {
      const g = map.get(v.program.id) ?? { program: v.program, views: [] };
      g.views.push(v);
      map.set(v.program.id, g);
    }
    const k = search.trim().toLowerCase();
    return [...map.values()]
      .filter((g) => !k || g.program.name.toLowerCase().includes(k) || g.views.some((v) => v.student.name.toLowerCase().includes(k)))
      .sort((a, b) => a.program.name.localeCompare(b.program.name, 'vi'));
  }, [q.data, search]);

  return (
    <>
      <Flex gap={8} wrap justify="space-between" style={{ marginBottom: 12 }}>
        <Input.Search allowClear placeholder="Tìm chương trình hoặc học viên" style={{ width: 320, maxWidth: '100%' }} onChange={(e) => setSearch(e.target.value)} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Đăng ký khóa
        </Button>
      </Flex>
      <NewEnrollmentModal open={creating} onClose={() => setCreating(false)} />
      <Table<ProgramGroupRow>
        rowKey={(r) => r.program.id}
        loading={q.isLoading}
        dataSource={rows}
        scroll={{ x: 1250 }}
        pagination={TABLE_PAGINATION}
        locale={{ emptyText: 'Chưa có khóa đăng ký nào' }}
        onRow={(r) => ({ onClick: () => navigate(`/khoa-hoc/${r.program.id}`), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Chương trình',
            render: (_, r) => (
              <div>
                <strong>{r.program.name}</strong>
                <div style={{ fontSize: 12, color: '#7b8499' }}>{GROUP_LABEL[r.program.group]}</div>
              </div>
            ),
          },
          {
            title: 'Ngày bắt đầu',
            width: 130,
            sorter: (a, b) => minDate(a.views.map((v) => v.enrollment.startDate)).localeCompare(minDate(b.views.map((v) => v.enrollment.startDate))),
            render: (_, r) => fmtDate(minDate(r.views.map((v) => v.enrollment.startDate))),
          },
          {
            title: 'Ngày kết thúc',
            width: 130,
            sorter: (a, b) => maxDate(a.views.map((v) => v.progress.endDate)).localeCompare(maxDate(b.views.map((v) => v.progress.endDate))),
            render: (_, r) => fmtDate(maxDate(r.views.map((v) => v.progress.endDate))),
          },
          {
            title: 'Buổi đã học / tổng',
            width: 150,
            align: 'center',
            render: (_, r) => {
              const act = r.views.filter((v) => v.enrollment.status === 'active');
              const held = act.reduce((n, v) => n + v.progress.held, 0);
              const total = act.reduce((n, v) => n + v.progress.total, 0);
              return (
                <div>
                  <strong>{held}/{total}</strong>
                  <div style={{ fontSize: 12, color: '#7b8499' }}>{r.program.sessions ? `gói ${r.program.sessions} buổi` : 'gói theo tháng'}</div>
                </div>
              );
            },
          },
          { title: 'Đang học', width: 100, align: 'center', render: (_, r) => r.views.filter((v) => v.enrollment.status === 'active').length },
          { title: 'Số lớp', width: 90, align: 'center', render: (_, r) => new Set(r.views.map((v) => v.cls.id)).size },
          {
            title: 'Sắp kết thúc',
            width: 130,
            render: (_, r) => {
              const n = r.views.filter((v) => v.enrollment.status === 'active' && isEndingSoon(v)).length;
              return n > 0 ? <Tag color="warning">{n} học viên</Tag> : <Typography.Text type="secondary">—</Typography.Text>;
            },
          },
          {
            title: 'Chưa nhận học phí',
            width: 160,
            render: (_, r) => {
              const n = r.views.filter((v) => v.enrollment.status === 'active' && !v.enrollment.tuitionReceived).length;
              return n > 0 ? <Tag color="error">{n} học viên</Tag> : <Tag color="success">Đủ</Tag>;
            },
          },
          { title: 'Thiếu điểm danh', width: 140, render: (_, r) => (r.views.some((v) => v.progress.missing > 0) ? <Tag color="error">{r.views.filter((v) => v.progress.missing > 0).length} học viên</Tag> : <Tag color="success">Đủ</Tag>) },
          { title: 'Học phí gói', width: 130, align: 'right', render: (_, r) => fmtMoney(r.program.tuition) },
          { title: '', width: 90, render: (_, r) => <Link to={`/khoa-hoc/${r.program.id}`} onClick={(e) => e.stopPropagation()}>Chi tiết</Link> },
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
      <PageHeader title="Khóa học" subtitle="Chương trình đang có học viên và danh mục 46 gói. Bấm vào một chương trình để xem học viên." />
      <Tabs
        items={[
          { key: 'enrollments', label: 'Chương trình đang học', children: <Enrollments /> },
          { key: 'catalog', label: 'Danh mục chương trình', children: <Catalog /> },
        ]}
      />
    </div>
  );
}
