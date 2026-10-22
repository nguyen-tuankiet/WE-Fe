import { useQuery } from '@tanstack/react-query';
import { Card, Col, Empty, Flex, Modal, Row, Select, Table, Tabs, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  getAttendanceDetail,
  getDashboardCharts,
  getEndingDetail,
  getGroupDetail,
  getRatingDetail,
  type AttendanceDetailRow,
  type DashboardCharts as DashboardChartsData,
  type EnrollmentView,
  type ExamResultView,
} from '../api';
import { AttendanceTag, RatingTag } from '../components/StatusTag';
import { TABLE_PAGINATION } from '../components/pagination';
import type { AttendanceStatus, Rating } from '../domain/types';
import { ATTENDANCE_LABEL, RATING_LABEL, fmtDate, fmtPercent } from '../i18n/vi';
import { BRAND } from '../theme';

const ATTENDANCE_COLORS = { present: '#2e8b57', late: BRAND.orange, absent: BRAND.brick };
const RATING_COLORS: Record<Rating, string> = { good: '#2e8b57', average: BRAND.orange, redflag: BRAND.brick };
const GROUP_COLORS = [BRAND.red, '#c0392b', BRAND.orange, BRAND.gold, BRAND.slate, '#8a97b5', '#b7a39f', '#5c080c'];
const AXIS = { fontSize: 12, fill: '#6b6665' };

type Detail =
  | { kind: 'attendance'; date: string; status: AttendanceStatus }
  | { kind: 'group'; name: string }
  | { kind: 'ending'; from: string; to: string }
  | { kind: 'rating'; rating: Rating };

interface SliceLabelProps {
  name?: string;
  value?: number;
  x?: number;
  y?: number;
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit';
}

/** Nhãn lát cắt tự vẽ để chữ luôn dùng màu chữ của trang; bỏ nhãn lát bằng 0. */
function sliceLabel({ name, value, x, y, textAnchor }: SliceLabelProps) {
  if (!value) return null;
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill="#3a3534" fontSize={12}>
      {name}: {value}
    </text>
  );
}

function ChartCard({ title, hint, loading, empty, children }: { title: string; hint: string; loading: boolean; empty: boolean; children: React.ReactNode }) {
  return (
    <Card
      title={title}
      extra={
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {hint}
        </Typography.Text>
      }
      loading={loading}
      styles={{ body: { height: 300 } }}
    >
      {empty ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" /> : children}
    </Card>
  );
}

/* ---------- Nội dung chi tiết ---------- */

function AttendanceDetail({ date, status }: { date: string; status: AttendanceStatus }) {
  const q = useQuery({ queryKey: ['chart-detail', 'attendance', date, status], queryFn: () => getAttendanceDetail(date, status) });
  return (
    <Table<AttendanceDetailRow>
      rowKey={(r) => `${r.studentId}|${r.program}`}
      loading={q.isLoading}
      dataSource={q.data}
      pagination={TABLE_PAGINATION}
      scroll={{ x: 640 }}
      columns={[
        { title: 'Học viên', render: (_, r) => <Link to={`/hoc-vien/${r.studentId}`}>{r.studentName}</Link> },
        { title: 'Chương trình', dataIndex: 'program' },
        { title: 'Lớp', dataIndex: 'className' },
        { title: 'Trạng thái', render: (_, r) => <AttendanceTag status={r.status} /> },
        { title: 'Đã báo nghỉ', render: (_, r) => (r.status === 'absent' ? r.notified ? <Tag color="success">Đã báo</Tag> : <Tag color="warning">Không báo</Tag> : '—') },
        { title: 'Ghi chú', dataIndex: 'note', render: (v: string) => v || '—' },
      ]}
    />
  );
}

function EnrollmentTable({ rows, loading }: { rows?: EnrollmentView[]; loading: boolean }) {
  return (
    <Table<EnrollmentView>
      rowKey={(r) => r.enrollment.id}
      loading={loading}
      dataSource={rows}
      pagination={TABLE_PAGINATION}
      scroll={{ x: 640 }}
      columns={[
        { title: 'Học viên', render: (_, r) => <Link to={`/hoc-vien/${r.student.id}`}>{r.student.name}</Link> },
        { title: 'Chương trình', render: (_, r) => r.program.name },
        { title: 'Lớp', render: (_, r) => r.cls.name },
        { title: 'Tiến độ', render: (_, r) => `${r.progress.held}/${r.progress.total} buổi` },
        { title: 'Kết thúc', render: (_, r) => fmtDate(r.progress.endDate) },
      ]}
    />
  );
}

function GroupDetail({ name }: { name: string }) {
  const q = useQuery({ queryKey: ['chart-detail', 'group', name], queryFn: () => getGroupDetail(name) });
  return <EnrollmentTable rows={q.data} loading={q.isLoading} />;
}

function EndingDetail({ from, to }: { from: string; to: string }) {
  const q = useQuery({ queryKey: ['chart-detail', 'ending', from, to], queryFn: () => getEndingDetail(from, to) });
  return <EnrollmentTable rows={q.data} loading={q.isLoading} />;
}

function RatingDetail({ rating }: { rating: Rating }) {
  const q = useQuery({ queryKey: ['chart-detail', 'rating', rating], queryFn: () => getRatingDetail(rating) });
  return (
    <Table<ExamResultView>
      rowKey={(r) => r.result.id}
      loading={q.isLoading}
      dataSource={q.data}
      pagination={TABLE_PAGINATION}
      scroll={{ x: 640 }}
      columns={[
        { title: 'Học viên', render: (_, r) => <Link to={`/hoc-vien/${r.view.student.id}`}>{r.view.student.name}</Link> },
        { title: 'Khóa', render: (_, r) => r.view.program.name },
        { title: 'Ngày kiểm tra', render: (_, r) => fmtDate(r.result.date) },
        { title: 'Điểm tổng', render: (_, r) => fmtPercent(r.percent) },
        { title: 'Phân loại', render: (_, r) => <RatingTag rating={r.rating} /> },
        { title: '', render: (_, r) => <Link to={`/bao-cao?hv=${r.view.student.id}`}>Báo cáo</Link> },
      ]}
    />
  );
}

const MODAL_TITLE: Record<Detail['kind'], string> = {
  attendance: 'Điểm danh',
  group: 'Học viên theo nhóm chương trình',
  ending: 'Khóa sắp kết thúc theo tuần',
  rating: 'Kết quả kiểm tra',
};

interface TabSpec {
  activeKey: string;
  items: { key: string; label: string; disabled?: boolean }[];
  select: (key: string) => Detail;
  body: React.ReactNode;
}

/** Một popup chứa mọi trạng thái của biểu đồ: đổi tab để xem nhanh, không cần đóng rồi bấm lại. */
function DetailModal({ detail, data, onChange, onClose }: { detail: Detail | null; data?: DashboardChartsData; onChange: (d: Detail) => void; onClose: () => void }) {
  let spec: TabSpec | null = null;
  if (detail && data) {
    switch (detail.kind) {
      case 'attendance': {
        const row = data.attendanceTrend.find((r) => r.date === detail.date);
        spec = {
          activeKey: detail.status,
          items: (['present', 'late', 'absent'] as const).map((st) => ({ key: st, label: `${ATTENDANCE_LABEL[st]} (${row?.[st] ?? 0})` })),
          select: (key) => ({ kind: 'attendance', date: detail.date, status: key as AttendanceStatus }),
          body: <AttendanceDetail date={detail.date} status={detail.status} />,
        };
        break;
      }
      case 'group':
        spec = {
          activeKey: detail.name,
          items: data.byGroup.map((g) => ({ key: g.name, label: `${g.name} (${g.value})` })),
          select: (key) => ({ kind: 'group', name: key }),
          body: <GroupDetail name={detail.name} />,
        };
        break;
      case 'ending':
        spec = {
          activeKey: detail.from,
          items: data.endingByWeek.map((w) => ({ key: w.from, label: `${dayjs(w.from).format('DD/MM')} (${w.value})`, disabled: w.value === 0 })),
          select: (key) => {
            const w = data.endingByWeek.find((x) => x.from === key)!;
            return { kind: 'ending', from: w.from, to: w.to };
          },
          body: <EndingDetail from={detail.from} to={detail.to} />,
        };
        break;
      case 'rating':
        spec = {
          activeKey: detail.rating,
          items: data.ratings.map((r) => ({ key: r.rating, label: `${RATING_LABEL[r.rating]} (${r.value})`, disabled: r.value === 0 })),
          select: (key) => ({ kind: 'rating', rating: key as Rating }),
          body: <RatingDetail rating={detail.rating} />,
        };
        break;
    }
  }

  return (
    <Modal title={detail ? MODAL_TITLE[detail.kind] : ''} open={!!detail} onCancel={onClose} footer={null} width={900} centered destroyOnHidden>
      {detail?.kind === 'attendance' && data && (
        <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary">Ngày</Typography.Text>
          <Select
            value={detail.date}
            style={{ width: 230 }}
            onChange={(date) => onChange({ kind: 'attendance', date, status: detail.status })}
            options={[...data.attendanceTrend].reverse().map((r) => ({ value: r.date, label: dayjs(r.date).format('dddd, DD/MM/YYYY') }))}
          />
        </Flex>
      )}
      {spec && (
        <>
          <Tabs activeKey={spec.activeKey} items={spec.items} onChange={(key) => onChange(spec.select(key))} />
          {spec.body}
        </>
      )}
    </Modal>
  );
}

export function DashboardCharts({ management, from, to }: { management: boolean; from: string; to: string }) {
  const q = useQuery({ queryKey: ['dashboard-charts', from, to], queryFn: () => getDashboardCharts(from, to) });
  const [detail, setDetail] = useState<Detail | null>(null);
  const d = q.data;
  const ratingTotal = d?.ratings.reduce((s, r) => s + r.value, 0) ?? 0;
  const ratingData = (d?.ratings ?? []).map((r) => ({ ...r, name: RATING_LABEL[r.rating] }));

  const openAttendance = (status: AttendanceStatus) => (_: unknown, index: number) => {
    const row = d?.attendanceTrend[index];
    if (row) setDetail({ kind: 'attendance', date: row.date, status });
  };

  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }} className="chart-clickable">
        {management && (
          <>
            <Col xs={24} xl={14}>
              <ChartCard title="Điểm danh các buổi gần nhất" hint="Bấm vào cột để xem danh sách" loading={q.isLoading} empty={!d?.attendanceTrend.length}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d?.attendanceTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e3e2" />
                    <XAxis dataKey="date" tickFormatter={(v: string) => dayjs(v).format('DD/MM')} tick={AXIS} tickLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                    <Tooltip labelFormatter={(v) => dayjs(String(v)).format('DD/MM/YYYY')} />
                    <Legend />
                    <Bar dataKey="present" name="Có mặt" stackId="a" fill={ATTENDANCE_COLORS.present} onClick={openAttendance('present')} />
                    <Bar dataKey="late" name="Đi trễ" stackId="a" fill={ATTENDANCE_COLORS.late} onClick={openAttendance('late')} />
                    <Bar dataKey="absent" name="Vắng" stackId="a" fill={ATTENDANCE_COLORS.absent} radius={[4, 4, 0, 0]} onClick={openAttendance('absent')} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Col>
            <Col xs={24} xl={10}>
              <ChartCard title="Học viên theo nhóm chương trình" hint="Bấm vào lát cắt để xem danh sách" loading={q.isLoading} empty={!d?.byGroup.length}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={d?.byGroup}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={82}
                      paddingAngle={2}
                      label={sliceLabel}
                      labelLine={false}
                      cy="46%"
                      onClick={(_: unknown, i: number) => {
                        const g = d?.byGroup[i];
                        if (g) setDetail({ kind: 'group', name: g.name });
                      }}
                    >
                      {(d?.byGroup ?? []).map((_, i) => (
                        <Cell key={i} fill={GROUP_COLORS[i % GROUP_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </Col>
            <Col xs={24} xl={14}>
              <ChartCard title="Khóa sắp kết thúc theo tuần (mốc từ thứ Hai)" hint="Bấm vào cột để xem danh sách" loading={q.isLoading} empty={!d || d.endingByWeek.every((w) => w.value === 0)}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d?.endingByWeek} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8e3e2" />
                    <XAxis dataKey="week" tick={AXIS} tickLine={false} />
                    <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => [`${v} khóa`, 'Kết thúc']} labelFormatter={(v) => `Tuần từ ${String(v)}`} />
                    <Bar
                      dataKey="value"
                      name="Khóa kết thúc"
                      fill={BRAND.red}
                      radius={[4, 4, 0, 0]}
                      onClick={(_: unknown, i: number) => {
                        const w = d?.endingByWeek[i];
                        if (w && w.value > 0) setDetail({ kind: 'ending', from: w.from, to: w.to });
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Col>
          </>
        )}
        <Col xs={24} xl={management ? 10 : 24}>
          <ChartCard title="Kết quả kiểm tra" hint="Bấm vào lát cắt để xem danh sách" loading={q.isLoading} empty={ratingTotal === 0}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ratingData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={70}
                  paddingAngle={2}
                  label={sliceLabel}
                  labelLine={false}
                  cy="45%"
                  onClick={(_: unknown, i: number) => {
                    const r = ratingData[i];
                    if (r && r.value > 0) setDetail({ kind: 'rating', rating: r.rating });
                  }}
                >
                  {ratingData.map((r) => (
                    <Cell key={r.rating} fill={RATING_COLORS[r.rating]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </Col>
      </Row>

      <DetailModal detail={detail} data={d} onChange={setDetail} onClose={() => setDetail(null)} />
    </>
  );
}
