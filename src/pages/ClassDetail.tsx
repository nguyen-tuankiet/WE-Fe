import { ArrowLeftOutlined, CalendarOutlined, EditOutlined, TeamOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Empty, Flex, Progress, Spin, Table, Tabs, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TODAY, getClassDetail, listClasses, type EnrollmentView } from '../api';
import { useUser } from '../auth/AuthContext';
import { isManagement } from '../auth/permissions';
import { ClassFormModal } from '../components/ClassFormModal';
import { MonthLedger } from '../components/MonthLedger';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { weekdaysLabel } from '../domain/schedule';
import { ENROLLMENT_STATUS_LABEL, fmtDate, fmtMoney } from '../i18n/vi';
import { SLOTS } from '../mock/db';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: '#7b8499', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  );
}

/** Trang chi tiết một lớp: thông tin chung, danh sách học viên kèm tiến độ, sổ điểm danh tháng. */
export function ClassDetailPage() {
  const { id = '' } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const manage = isManagement(user.roles);
  const [editing, setEditing] = useState(false);
  const detail = useQuery({ queryKey: ['class', id], queryFn: () => getClassDetail(id), enabled: !!id });
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses, enabled: manage });
  const d = detail.data;

  const back = (
    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/lop-hoc')} style={{ marginBottom: 8, paddingLeft: 0 }}>
      Danh sách lớp học
    </Button>
  );

  if (detail.isLoading) return <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;
  if (detail.isError || !d) {
    return (
      <div className="fade-in">
        {back}
        <Alert type="error" showIcon title="Không mở được lớp này" description={(detail.error as Error | null)?.message ?? 'Lớp không tồn tại hoặc bạn không có quyền xem.'} />
      </div>
    );
  }

  const slot = SLOTS.find((s) => s.id === d.cls.slotId);
  const active = d.students.filter((s) => s.enrollment.status === 'active');
  const missing = active.reduce((n, s) => n + s.progress.missing, 0);
  const row = (classes.data ?? []).find((c) => c.id === d.cls.id) ?? null;

  return (
    <div className="fade-in">
      {back}
      <PageHeader
        title={d.cls.name}
        subtitle={[d.cls.subject, d.cls.active ? 'Đang hoạt động' : 'Đã ngừng'].filter(Boolean).join(' · ')}
        extra={
          <Flex gap={8} wrap>
            <Button type="primary" icon={<CalendarOutlined />} onClick={() => navigate(`/diem-danh?lop=${d.cls.id}&ngay=${TODAY}`)}>
              Mở sổ điểm danh
            </Button>
            {manage && row && (
              <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                Sửa lớp
              </Button>
            )}
          </Flex>
        }
      />
      {row && <ClassFormModal open={editing} editing={row} onClose={() => setEditing(false)} />}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 20 }}>
          <Info label="Giáo viên">{d.teacherName}</Info>
          <Info label="Trợ giảng">{d.cls.assistant || '—'}</Info>
          <Info label="Ngày học">{weekdaysLabel(d.cls.weekdays)}</Info>
          <Info label="Ca học">{slot ? `${slot.label} · ${slot.time}` : '—'}</Info>
          <Info label="Phòng">{d.cls.room || '—'}</Info>
          <Info label="Sĩ số">
            <Progress percent={Math.round((active.length / Math.max(d.cls.maxSize, 1)) * 100)} size="small" format={() => `${active.length}/${d.cls.maxSize}`} />
          </Info>
        </div>
      </Card>

      <Card>
        <Tabs
          items={[
            {
              key: 'students',
              label: (
                <span>
                  <TeamOutlined /> Học viên ({active.length})
                </span>
              ),
              children: (
                <>
                  <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
                    Mỗi học viên có ngày bắt đầu và số buổi còn lại riêng nên ngày hết khóa khác nhau; học viên cùng lớp có thể khác trình độ.
                    {missing > 0 && <b style={{ color: '#a8321e' }}> Đang thiếu điểm danh {missing} lượt.</b>}
                  </Typography.Paragraph>
                  <Table<EnrollmentView>
                    rowKey={(r) => r.enrollment.id}
                    dataSource={d.students}
                    pagination={TABLE_PAGINATION}
                    scroll={{ x: manage ? 980 : 860 }}
                    locale={{ emptyText: <Empty description="Lớp chưa có học viên" /> }}
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
                      { title: 'Chương trình', render: (_, r) => r.program.name },
                      { title: 'Bắt đầu', width: 105, render: (_, r) => fmtDate(r.enrollment.startDate) },
                      {
                        title: 'Tiến độ',
                        width: 190,
                        render: (_, r) => (
                          <div>
                            <Progress percent={Math.round((r.progress.held / Math.max(r.progress.total, 1)) * 100)} size="small" format={() => `${r.progress.held}/${r.progress.total}`} />
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              Còn {r.progress.remaining} buổi
                            </Typography.Text>
                          </div>
                        ),
                      },
                      {
                        title: 'Hết khóa',
                        width: 140,
                        render: (_, r) => (
                          <div>
                            {fmtDate(r.progress.endDate)}
                            {r.progress.endDate && r.progress.endDate >= TODAY && dayjs(r.progress.endDate).diff(dayjs(TODAY), 'day') <= 14 && <Tag color="warning" style={{ marginLeft: 4 }}>Sắp hết</Tag>}
                          </div>
                        ),
                      },
                      {
                        title: 'Điểm danh',
                        width: 110,
                        render: (_, r) => (r.progress.missing > 0 ? <Tag color="error">Thiếu {r.progress.missing}</Tag> : <Tag color="success">Đủ</Tag>),
                      },
                      { title: 'Bù', width: 70, render: (_, r) => (r.quota ? `${r.makeupUsed}/${r.quota.maxCount}` : '—') },
                      ...(manage
                        ? [
                            {
                              title: 'Học phí',
                              width: 130,
                              render: (_: unknown, r: EnrollmentView) => (
                                <div>
                                  {fmtMoney(r.enrollment.tuition)}
                                  <div>{r.enrollment.tuitionReceived ? <Tag color="success">Đã nhận</Tag> : <Tag color="warning">Chưa nhận</Tag>}</div>
                                </div>
                              ),
                            },
                          ]
                        : []),
                      { title: 'Trạng thái', width: 100, render: (_, r) => ENROLLMENT_STATUS_LABEL[r.enrollment.status] },
                    ]}
                  />
                </>
              ),
            },
            {
              key: 'ledger',
              label: (
                <span>
                  <CalendarOutlined /> Điểm danh tháng {dayjs(TODAY).format('MM/YYYY')}
                </span>
              ),
              children: <MonthLedger classId={d.cls.id} month={dayjs(TODAY).format('YYYY-MM')} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
