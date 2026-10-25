import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Checkbox, Col, DatePicker, Empty, Flex, List, Progress, Row, Statistic, Tabs, Tag, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TODAY, getDashboard, listTasks, markTask, updateEnrollment, type Task, type TaskType } from '../api';
import { useUser } from '../auth/AuthContext';
import { isManagement, isTeacherOnly } from '../auth/permissions';
import { PageHeader } from '../components/PageHeader';
import { LIST_PAGINATION } from '../components/pagination';
import { DashboardCharts } from './DashboardCharts';
import { SLOTS } from '../mock/db';
import { fmtDate, fmtMoney, fmtShort } from '../i18n/vi';

const TASK_META: Record<TaskType, { label: string; color: string }> = {
  birthday: { label: 'Sinh nhật', color: 'magenta' },
  endcourse: { label: 'Cuối khóa', color: 'orange' },
  attendance: { label: 'Thiếu điểm danh', color: 'red' },
  reserve: { label: 'Bảo lưu', color: 'gold' },
  exam: { label: 'Kiểm tra', color: 'blue' },
  tuition: { label: 'Học phí', color: 'purple' },
};


const presets: { label: string; value: [Dayjs, Dayjs] }[] = (() => {
  const t = dayjs(TODAY);
  const monday = t.subtract((t.day() + 6) % 7, 'day');
  return [
    { label: 'Hôm nay', value: [t, t] },
    { label: 'Hôm qua', value: [t.subtract(1, 'day'), t.subtract(1, 'day')] },
    { label: '7 ngày qua', value: [t.subtract(6, 'day'), t] },
    { label: '7 ngày tới', value: [t, t.add(6, 'day')] },
    { label: 'Tuần này', value: [monday, monday.add(6, 'day')] },
    { label: 'Tháng này', value: [t.startOf('month'), t.endOf('month')] },
  ];
})();

function TaskList({ tasks, onToggle }: { tasks: Task[]; onToggle: (t: Task, done: boolean) => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  /** Việc "Học phí": bấm để xác nhận đã nhận học phí của khóa đó (việc tự biến mất khỏi danh sách) */
  const received = useMutation({
    mutationFn: (t: Task) => updateEnrollment(t.key.replace('tuition:', ''), { tuitionReceived: true }),
    onSuccess: () => {
      message.success('Đã ghi nhận đã nhận học phí.');
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });
  if (!tasks.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có việc cần xử lý" />;
  return (
    <List
      dataSource={tasks}
      pagination={LIST_PAGINATION}
      renderItem={(t) => (
        <List.Item
          extra={
            <Flex gap={12} align="center">
            {t.type === 'tuition' && (
              <Button size="small" type="primary" ghost loading={received.isPending && received.variables?.key === t.key} onClick={() => received.mutate(t)}>
                Đã nhận học phí
              </Button>
            )}
            <Checkbox checked={!!t.handled} onChange={(e) => onToggle(t, e.target.checked)}>
              Đã xử lý
            </Checkbox>
            </Flex>
          }
        >
          <List.Item.Meta
            title={
              <Flex gap={8} align="center" wrap>
                <Tag color={TASK_META[t.type].color} style={{ margin: 0 }}>
                  {TASK_META[t.type].label}
                </Tag>
                <span style={{ textDecoration: t.handled ? 'line-through' : undefined }}>{t.title}</span>
                <Typography.Text type="secondary">{fmtDate(t.date)}</Typography.Text>
              </Flex>
            }
            description={
              <>
                {t.detail}
                {t.handled && (
                  <Typography.Text type="success" style={{ display: 'block' }}>
                    Đã xử lý bởi {t.handled.by} · {dayjs(t.handled.at).format('HH:mm DD/MM')}
                  </Typography.Text>
                )}
              </>
            }
          />
        </List.Item>
      )}
    />
  );
}

export function DashboardPage() {
  const user = useUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs(TODAY), dayjs(TODAY)]);
  const from = range[0].format('YYYY-MM-DD');
  const to = range[1].format('YYYY-MM-DD');
  const single = from === to;
  const isToday = single && from === TODAY;
  const rangeText = single ? (isToday ? 'hôm nay' : fmtDate(from)) : `${fmtShort(from)} - ${fmtDate(to)}`;
  const dash = useQuery({ queryKey: ['dashboard', from, to], queryFn: () => getDashboard(from, to) });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: listTasks });
  const toggle = useMutation({
    mutationFn: ({ t, done }: { t: Task; done: boolean }) => markTask(t.key, user.name, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const management = isManagement(user.roles);
  const teacherOnly = isTeacherOnly(user.roles);
  const d = dash.data;
  const sessions = (d?.sessions ?? []).filter((x) => !teacherOnly || x.cls.teacherId === user.id);
  const allTasks = (tasks.data ?? []).filter((t) => management || (user.roles.includes('inspector') && t.type === 'exam'));
  const open = allTasks.filter((t) => !t.handled);

  const tabFor = (type?: TaskType) => (type ? allTasks.filter((t) => t.type === type) : allTasks);
  const tabItems = [
    { key: 'all', label: `Tất cả (${open.length})`, type: undefined },
    ...(Object.keys(TASK_META) as TaskType[]).map((k) => ({
      key: k,
      label: `${TASK_META[k].label} (${tabFor(k).filter((t) => !t.handled).length})`,
      type: k,
    })),
  ].map((it) => ({
    key: it.key,
    label: it.label,
    children: <TaskList tasks={tabFor(it.type)} onToggle={(t, done) => toggle.mutate({ t, done })} />,
  }));

  const attention = (n: number) => (n > 0 ? '#d4380d' : '#2e8b57');
  const kpis = [
    { title: 'Học viên đang học', value: d?.activeStudents ?? 0, color: '#860d12', hint: 'Đang có khóa hoạt động', to: '/hoc-vien' },
    {
      title: `Điểm danh ${rangeText}`,
      value: d ? `${d.periodRecorded}/${d.periodScheduled}` : '0/0',
      color: d && d.periodRecorded < d.periodScheduled ? '#d4380d' : '#2e8b57',
      hint:
        !d || d.periodScheduled === 0
          ? 'Chưa có buổi nào cần điểm danh'
          : d.periodRecorded < d.periodScheduled
            ? `Còn ${d.periodScheduled - d.periodRecorded} lượt học viên chưa ghi nhận`
            : 'Đã ghi nhận đủ',
      to: '/diem-danh',
    },
    {
      title: 'Thiếu điểm danh',
      value: d?.missingSessions ?? 0,
      color: attention(d?.missingSessions ?? 0),
      hint: d?.missingSessions ? `${d.missingStudents} học viên · buổi đã qua trong khoảng chưa ghi nhận` : 'Không có buổi nào bị bỏ sót',
      to: '/diem-danh',
    },
    {
      title: 'Học bù chờ xếp',
      value: d?.makeupPending ?? 0,
      color: attention(d?.makeupPending ?? 0),
      hint: 'Buổi vắng đã báo, đủ điều kiện bù',
      to: '/hoc-bu',
    },
    {
      title: 'Học phí chưa nhận',
      value: d?.unpaidCount ?? 0,
      color: attention(d?.unpaidCount ?? 0),
      hint: d?.unpaidCount ? fmtMoney(d.unpaidAmount) : 'Đã nhận đủ',
      to: '/khoa-hoc',
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title="Tổng quan"
        subtitle={`Hôm nay, ${dayjs(TODAY).format('dddd, DD/MM/YYYY')} · nhắc việc trong 30 ngày tới`}
        extra={
          <Flex align="center" gap={8} wrap>
            <Typography.Text type="secondary">Xem theo ngày</Typography.Text>
            <DatePicker.RangePicker
              value={range}
              allowClear={false}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              presets={presets}
              onChange={(v) => {
                if (!v || !v[0] || !v[1]) return;
                let end = v[1];
                if (end.diff(v[0], 'day') > 92) {
                  message.warning('Chỉ xem tối đa 93 ngày một lần, đã tự rút ngắn khoảng chọn.');
                  end = v[0].add(92, 'day');
                }
                setRange([v[0], end]);
              }}
            />
            {!isToday && <Button onClick={() => setRange([dayjs(TODAY), dayjs(TODAY)])}>Hôm nay</Button>}
          </Flex>
        }
      />

      {management && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {kpis.map((k) => (
            <Col key={k.title} flex="1 1 200px">
              <Card
                hoverable={!!k.to}
                loading={dash.isLoading}
                styles={{ body: { padding: 18 } }}
                onClick={k.to ? () => navigate(k.to!) : undefined}
                style={{ height: '100%' }}
              >
                <Statistic title={k.title} value={k.value} styles={{ content: { color: k.color, fontWeight: 700 } }} />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {k.hint}
                </Typography.Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {(management || user.roles.includes('inspector')) && <DashboardCharts management={management} from={from} to={to} />}

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={9}>
          <Card title={`Lớp học ${isToday ? 'hôm nay' : single ? fmtDate(from) : 'trong khoảng chọn'} (${sessions.length})`} loading={dash.isLoading}>
            {sessions.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isToday ? 'Hôm nay không có lớp' : 'Không có lớp nào trong khoảng này'} />
            ) : (
              <List
                dataSource={sessions}
                pagination={LIST_PAGINATION}
                renderItem={(c) => {
                  const slot = SLOTS.find((x) => x.id === c.cls.slotId);
                  return (
                    <List.Item style={{ paddingBlock: 14 }}>
                      <Flex justify="space-between" align="center" gap={20} wrap style={{ width: '100%' }}>
                        <List.Item.Meta
                          style={{ flex: '1 1 220px', minWidth: 0 }}
                          title={
                            <Flex gap={8} align="center" wrap>
                              {!single && <Tag style={{ margin: 0 }}>{dayjs(c.date).format('ddd DD/MM')}</Tag>}
                              <span>{c.cls.name}</span>
                            </Flex>
                          }
                          description={`${slot?.label} ${slot?.time} · Phòng ${c.cls.room} · GV ${c.teacherName}`}
                        />
                        <Flex align="center" gap={20} style={{ flex: 'none' }}>
                          <Progress
                            type="circle"
                            size={44}
                            percent={c.students ? Math.round((c.recorded / c.students) * 100) : 0}
                            format={() => `${c.recorded}/${c.students}`}
                            strokeColor="#860d12"
                          />
                          {user.roles.some((r) => r === 'admin' || r === 'manager' || r === 'teacher') && (
                            <Button type="primary" disabled={c.date > TODAY} onClick={() => navigate(`/diem-danh?lop=${c.cls.id}&ngay=${c.date}`)}>
                              Điểm danh
                            </Button>
                          )}
                        </Flex>
                      </Flex>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} xl={15}>
          {allTasks.length > 0 || management ? (
            <Card title="Việc cần quan tâm" loading={tasks.isLoading}>
              <Tabs items={tabItems} size="small" />
            </Card>
          ) : (
            <Card>
              <Empty description="Chọn một mục trong menu để bắt đầu" />
            </Card>
          )}
        </Col>
      </Row>
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
        Nhắc việc chỉ là thông tin cho nhân sự; hệ thống chưa tự gửi tin nhắn cho phụ huynh.
      </Typography.Text>
    </div>
  );
}
