import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Empty, Flex, Input, Popconfirm, Progress, Segmented, Spin, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listEnrollments, listPrograms, updateEnrollment, type EnrollmentView } from '../api';
import { EnrollmentEditModal } from '../components/EnrollmentEditModal';
import { NewEnrollmentModal, TransferModal } from '../components/EnrollmentModals';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { makeupQuota } from '../domain/makeup';
import { weekdaysLabel } from '../domain/schedule';
import type { EnrollmentStatus } from '../domain/types';
import { ENROLLMENT_STATUS_LABEL, fmtDate, fmtMoney } from '../i18n/vi';
import { GROUP_LABEL } from '../mock/catalog';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: '#7b8499', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

/** Chi tiết một chương trình: thông tin gói và toàn bộ học viên đang/đã đăng ký chương trình này. */
export function ProgramDetailPage() {
  const { programId = '' } = useParams();
  const navigate = useNavigate();
  const programs = useQuery({ queryKey: ['programs'], queryFn: listPrograms });
  const enrollments = useQuery({ queryKey: ['enrollments'], queryFn: listEnrollments });
  const [status, setStatus] = useState<EnrollmentStatus | 'all'>('active');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [transfer, setTransfer] = useState<EnrollmentView | null>(null);
  const [editing, setEditing] = useState<EnrollmentView | null>(null);
  const { message } = App.useApp();
  const qc = useQueryClient();
  const received = useMutation({
    mutationFn: (id: string) => updateEnrollment(id, { tuitionReceived: true }),
    onSuccess: () => {
      message.success('Đã ghi nhận đã nhận học phí.');
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const program = programs.data?.find((p) => p.id === programId);
  const all = useMemo(() => (enrollments.data ?? []).filter((v) => v.program.id === programId), [enrollments.data, programId]);
  const rows = useMemo(() => {
    const k = search.trim().toLowerCase();
    return all.filter((v) => (status === 'all' || v.enrollment.status === status) && (!k || v.student.name.toLowerCase().includes(k) || v.student.code.toLowerCase().includes(k)));
  }, [all, status, search]);

  const back = (
    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/khoa-hoc')} style={{ marginBottom: 8, paddingLeft: 0 }}>
      Danh sách chương trình
    </Button>
  );

  if (programs.isLoading || enrollments.isLoading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
  if (!program) {
    return (
      <div className="fade-in">
        {back}
        <Alert type="error" showIcon title="Không tìm thấy chương trình này" />
      </div>
    );
  }

  const quota = makeupQuota(program);
  const count = (s: EnrollmentStatus) => all.filter((v) => v.enrollment.status === s).length;
  const classes = new Set(all.filter((v) => v.enrollment.status === 'active').map((v) => v.cls.name));

  return (
    <div className="fade-in">
      {back}
      <PageHeader
        title={program.name}
        subtitle={[GROUP_LABEL[program.group], program.note].filter(Boolean).join(' · ')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            Đăng ký học viên vào chương trình
          </Button>
        }
      />
      <NewEnrollmentModal open={creating} presetProgramId={program.id} onClose={() => setCreating(false)} />
      <TransferModal target={transfer} onClose={() => setTransfer(null)} />
      <EnrollmentEditModal target={editing} onClose={() => setEditing(null)} />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20 }}>
          <Info label="Học phí gói">{fmtMoney(program.tuition)}</Info>
          <Info label="Số buổi">{program.sessions ? `${program.sessions} buổi` : <Tag color="warning">Theo tháng — cần xác nhận</Tag>}</Info>
          <Info label="Sĩ số tối đa">{program.maxSize}</Info>
          <Info label="Chính sách bù">{quota ? `${quota.maxCount} × ${quota.minutes} phút` : 'Chưa có'}</Info>
          <Info label="Học viên đang học">{count('active')}</Info>
          <Info label="Đang bảo lưu / Hoàn tất">
            {count('reserved')} / {count('completed')}
          </Info>
          <Info label="Số lớp đang học">{classes.size}</Info>
        </div>
      </Card>

      <Card>
        <Flex gap={12} wrap justify="space-between" style={{ marginBottom: 12 }}>
          <Segmented
            value={status}
            onChange={(v) => setStatus(v as EnrollmentStatus | 'all')}
            options={[
              { value: 'active', label: `Đang học (${count('active')})` },
              { value: 'reserved', label: `Bảo lưu (${count('reserved')})` },
              { value: 'completed', label: `Hoàn tất (${count('completed')})` },
              { value: 'all', label: `Tất cả (${all.length})` },
            ]}
          />
          <Input.Search allowClear placeholder="Tìm học viên" style={{ width: 260, maxWidth: '100%' }} onChange={(e) => setSearch(e.target.value)} />
        </Flex>
        <Table<EnrollmentView>
          rowKey={(r) => r.enrollment.id}
          dataSource={rows}
          pagination={TABLE_PAGINATION}
          scroll={{ x: 1450 }}
          locale={{ emptyText: <Empty description="Chưa có học viên nào ở trạng thái này" /> }}
          columns={[
            {
              title: 'Học viên',
              render: (_, r) => (
                <div>
                  <Link to={`/hoc-vien/${r.student.id}`}>{r.student.name}</Link>
                  <div style={{ fontSize: 12, color: '#7b8499' }}>{r.student.code}</div>
                </div>
              ),
            },
            {
              title: 'Lớp / ngày học',
              render: (_, r) => (
                <div>
                  <Link to={`/lop-hoc/${r.cls.id}`}>{r.cls.name}</Link>
                  <div style={{ fontSize: 12, color: '#7b8499' }}>{weekdaysLabel(r.enrollment.weekdays)}</div>
                </div>
              ),
            },
            { title: 'Ngày bắt đầu', width: 120, sorter: (a, b) => a.enrollment.startDate.localeCompare(b.enrollment.startDate), render: (_, r) => fmtDate(r.enrollment.startDate) },
            { title: 'Ngày kết thúc khóa', width: 140, sorter: (a, b) => (a.progress.endDate ?? '').localeCompare(b.progress.endDate ?? ''), render: (_, r) => fmtDate(r.progress.endDate) },
            {
              title: 'Buổi hiện tại / tổng',
              width: 150,
              align: 'center',
              sorter: (a, b) => a.progress.held - b.progress.held,
              render: (_, r) => (
                <strong>
                  {r.progress.held}/{r.progress.total}
                </strong>
              ),
            },
            {
              title: 'Tiến độ',
              width: 200,
              render: (_, r) => (
                <div>
                  <Progress percent={Math.round((r.progress.held / Math.max(r.progress.total, 1)) * 100)} size="small" />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Đã ghi nhận {r.progress.recorded} · còn {r.progress.remaining} buổi
                    {r.progress.missing > 0 && <b style={{ color: '#a8321e' }}> · thiếu {r.progress.missing}</b>}
                  </Typography.Text>
                </div>
              ),
            },
            { title: 'Bù', width: 70, render: (_, r) => (r.quota ? `${r.makeupUsed}/${r.quota.maxCount}` : '—') },
            {
              title: 'Học phí',
              width: 130,
              render: (_, r) => (
                <div>
                  {fmtMoney(r.enrollment.tuition)}
                  <div>{r.enrollment.tuitionReceived ? <Tag color="success">Đã nhận</Tag> : <Tag color="warning">Chưa nhận</Tag>}</div>
                </div>
              ),
            },
            { title: 'Trạng thái', width: 100, render: (_, r) => ENROLLMENT_STATUS_LABEL[r.enrollment.status] },
            {
              title: '',
              width: 260,
              render: (_, r) => (
                <Flex gap={6} wrap>
                  {!r.enrollment.tuitionReceived && (
                    <Popconfirm title="Xác nhận đã nhận học phí?" okText="Đã nhận" cancelText="Hủy" onConfirm={() => received.mutate(r.enrollment.id)}>
                      <Button size="small" type="primary" ghost>
                        Đã nhận học phí
                      </Button>
                    </Popconfirm>
                  )}
                  <Button size="small" onClick={() => setEditing(r)}>
                    Sửa
                  </Button>
                  {r.enrollment.status === 'active' && (
                    <Button size="small" onClick={() => setTransfer(r)}>
                      Chuyển lớp
                    </Button>
                  )}
                </Flex>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
