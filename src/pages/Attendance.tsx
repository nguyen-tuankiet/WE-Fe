import { CheckOutlined, SaveOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Checkbox, DatePicker, Empty, Flex, Input, Radio, Select, Table, Tabs, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TODAY,
  getAttendanceSheet,
  getConfig,
  getMonthLedger,
  listClasses,
  saveAttendance,
  type LedgerRow,
  type SheetRow,
} from '../api';
import { useUser } from '../auth/AuthContext';
import { isTeacherOnly } from '../auth/permissions';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import type { AttendanceStatus } from '../domain/types';
import { ATTENDANCE_LABEL, fmtShort } from '../i18n/vi';

interface Draft {
  status?: AttendanceStatus;
  notified: boolean;
  note: string;
}

function DaySheet({ classId, date, readOnly }: { classId: string; date: string; readOnly: boolean }) {
  const user = useUser();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const sheet = useQuery({ queryKey: ['sheet', classId, date], queryFn: () => getAttendanceSheet(classId, date) });
  const [draft, setDraft] = useState<Record<string, Draft>>({});

  useEffect(() => {
    const next: Record<string, Draft> = {};
    sheet.data?.forEach((r) => {
      next[r.view.enrollment.id] = { status: r.record?.status, notified: r.record?.notified ?? false, note: r.record?.note ?? '' };
    });
    setDraft(next);
  }, [sheet.data]);

  const save = useMutation({
    mutationFn: () =>
      saveAttendance(
        date,
        Object.entries(draft)
          .filter(([, d]) => d.status)
          .map(([enrollmentId, d]) => ({ enrollmentId, status: d.status!, notified: d.notified, note: d.note })),
        user.name,
      ),
    onSuccess: (n) => {
      message.success(`Đã lưu điểm danh ${n} học viên.`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const update = (id: string, patch: Partial<Draft>) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const unmarked = Object.values(draft).filter((d) => !d.status).length;

  const markAllPresent = () =>
    setDraft((d) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.status ? v : { ...v, status: 'present' as const }])));

  if (sheet.isLoading) return <Table loading dataSource={[]} columns={[]} />;
  if (!sheet.data?.length)
    return <Empty description="Lớp không có buổi học nào trong ngày này (hoặc không có học viên theo lịch)." />;

  return (
    <>
      <Flex gap={8} wrap justify="space-between" align="center" style={{ marginBottom: 12 }}>
        <Typography.Text type="secondary">
          {sheet.data.length} học viên theo lịch · {unmarked > 0 ? `${unmarked} chưa ghi nhận` : 'đã ghi nhận đủ'}
        </Typography.Text>
        {!readOnly && (
          <Flex gap={8} wrap>
            <Tooltip title="Chỉ điền cho học viên chưa ghi nhận; không ghi đè Vắng/Đi trễ đã chọn.">
              <Button icon={<CheckOutlined />} onClick={markAllPresent} disabled={unmarked === 0}>
                Tất cả có mặt (chưa ghi nhận)
              </Button>
            </Tooltip>
            <Button type="primary" icon={<SaveOutlined />} loading={save.isPending} onClick={() => save.mutate()}>
              Lưu điểm danh
            </Button>
          </Flex>
        )}
      </Flex>
      <Table<SheetRow>
        rowKey={(r) => r.view.enrollment.id}
        dataSource={sheet.data}
        pagination={TABLE_PAGINATION}
        scroll={{ x: 760 }}
        columns={[
          { title: 'STT', width: 56, render: (_, r) => (sheet.data ?? []).indexOf(r) + 1 },
          {
            title: 'Học viên',
            render: (_, r) => (
              <div>
                <strong>{r.view.student.name}</strong>
                <div style={{ fontSize: 12, color: '#7b8499' }}>{r.view.program.name}</div>
              </div>
            ),
          },
          {
            title: 'Trạng thái',
            width: 290,
            render: (_, r) => {
              const id = r.view.enrollment.id;
              return (
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  disabled={readOnly}
                  value={draft[id]?.status ?? null}
                  onChange={(e) => update(id, { status: e.target.value, notified: e.target.value === 'absent' ? draft[id]?.notified ?? false : false })}
                  options={(['present', 'late', 'absent'] as const).map((s) => ({ value: s, label: ATTENDANCE_LABEL[s] }))}
                />
              );
            },
          },
          {
            title: 'Đã báo nghỉ',
            width: 120,
            render: (_, r) => {
              const id = r.view.enrollment.id;
              return (
                <Checkbox
                  disabled={readOnly || draft[id]?.status !== 'absent'}
                  checked={draft[id]?.notified ?? false}
                  onChange={(e) => update(id, { notified: e.target.checked })}
                />
              );
            },
          },
          {
            title: 'Ghi chú',
            render: (_, r) => {
              const id = r.view.enrollment.id;
              return <Input disabled={readOnly} value={draft[id]?.note ?? ''} onChange={(e) => update(id, { note: e.target.value })} placeholder="Ghi chú" />;
            },
          },
          {
            title: 'Đã ghi',
            width: 120,
            render: (_, r) => (r.record ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.record.by}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>),
          },
        ]}
      />
    </>
  );
}

function MonthLedger({ classId, month }: { classId: string; month: string }) {
  const q = useQuery({ queryKey: ['ledger', classId, month], queryFn: () => getMonthLedger(classId, month) });
  if (!q.data) return <Table loading dataSource={[]} columns={[]} />;
  const { dates, rows } = q.data;
  if (!dates.length) return <Empty description="Tháng này lớp chưa có buổi học." />;

  const symbol = { present: '✓', late: 'T', absent: 'V', none: '·', future: '' } as const;

  return (
    <>
      <Flex gap={16} wrap style={{ marginBottom: 12, fontSize: 12 }}>
        <span><span className="ledger-cell ledger-present">✓</span> Có mặt</span>
        <span><span className="ledger-cell ledger-late">T</span> Đi trễ</span>
        <span><span className="ledger-cell ledger-absent">V</span> Vắng</span>
        <span><span className="ledger-cell ledger-absent ledger-notified">V</span> Vắng đã báo nghỉ (viền vàng)</span>
        <span><span className="ledger-cell ledger-none">·</span> Chưa ghi nhận</span>
      </Flex>
      <Table<LedgerRow>
        rowKey={(r) => r.view.enrollment.id}
        dataSource={rows}
        pagination={TABLE_PAGINATION}
        size="small"
        scroll={{ x: 220 + dates.length * 44 }}
        columns={[
          { title: 'Học viên', fixed: 'left', width: 170, render: (_, r) => r.view.student.name },
          ...dates.map((d, i) => ({
            title: fmtShort(d),
            width: 44,
            align: 'center' as const,
            render: (_: unknown, r: LedgerRow) => {
              const c = r.cells[i];
              const text = c.makeupMinutes ? `+${c.makeupMinutes}'` : symbol[c.status];
              const title = `${dayjs(c.date).format('DD/MM/YYYY')}: ${c.status === 'future' ? 'ngoài lịch / chưa tới' : ATTENDANCE_LABEL[c.status as AttendanceStatus | 'none']}${c.notified ? ' (đã báo nghỉ)' : ''}`;
              return (
                <Tooltip title={title}>
                  <span className={`ledger-cell ledger-${c.status}${c.notified ? ' ledger-notified' : ''}`}>{text}</span>
                </Tooltip>
              );
            },
          })),
          {
            title: 'Vắng',
            fixed: 'right',
            width: 60,
            align: 'center',
            render: (_, r) => r.cells.filter((c) => c.status === 'absent').length,
          },
        ]}
      />
    </>
  );
}

export function AttendancePage() {
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const [date, setDate] = useState(() => {
    const q = params.get('ngay');
    return q && dayjs(q).isValid() ? dayjs(q) : dayjs(TODAY);
  });
  const [month, setMonth] = useState(dayjs(TODAY));

  const options = useMemo(
    () =>
      (classes.data ?? [])
        .filter((c) => c.active && (!isTeacherOnly(user.roles) || c.teacherId === user.id))
        .map((c) => ({ value: c.id, label: `${c.name} · ${c.teacherName}` })),
    [classes.data, user],
  );
  const heldToday = (classes.data ?? []).find((c) => options.some((o) => o.value === c.id) && c.weekdays.includes(dayjs(TODAY).day()));
  const classId = params.get('lop') ?? heldToday?.id ?? options[0]?.value;

  const editLimit = config.data?.teacherEditDays ?? 3;
  const dateStr = date.format('YYYY-MM-DD');
  const isFuture = dateStr > TODAY;
  const tooOld = isTeacherOnly(user.roles) && dayjs(TODAY).diff(date, 'day') > editLimit;
  const readOnly = isFuture || tooOld;

  return (
    <div className="fade-in">
      <PageHeader title="Điểm danh" subtitle="Ghi nhận buổi chính theo lớp và ngày. Mỗi khóa chỉ có một kết quả điểm danh cho cùng một ngày." />
      <Flex gap={8} wrap style={{ marginBottom: 12 }}>
        <Select
          value={classId}
          style={{ minWidth: 280, maxWidth: '100%' }}
          options={options}
          placeholder="Chọn lớp"
          loading={classes.isLoading}
          onChange={(v) => setParams({ lop: v })}
        />
      </Flex>
      {!classId ? (
        <Empty description="Bạn chưa được phân công lớp nào." />
      ) : (
        <Tabs
          items={[
            {
              key: 'day',
              label: 'Sổ ngày',
              children: (
                <>
                  <Flex gap={8} wrap align="center" style={{ marginBottom: 12 }}>
                    <DatePicker value={date} onChange={(d) => d && setDate(d)} format="DD/MM/YYYY" allowClear={false} />
                    <Button onClick={() => setDate(dayjs(TODAY))}>Hôm nay</Button>
                  </Flex>
                  {isFuture && <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Chưa tới ngày học — chưa thể điểm danh." />}
                  {tooOld && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 12 }}
                      title={`Giáo viên chỉ sửa điểm danh trong ${editLimit} ngày. Liên hệ Admin/Manager để điều chỉnh ngày này.`}
                    />
                  )}
                  <DaySheet key={`${classId}|${dateStr}`} classId={classId} date={dateStr} readOnly={readOnly} />
                </>
              ),
            },
            {
              key: 'month',
              label: 'Sổ tháng',
              children: (
                <>
                  <DatePicker picker="month" value={month} onChange={(d) => d && setMonth(d)} format="MM/YYYY" allowClear={false} style={{ marginBottom: 12 }} />
                  <MonthLedger classId={classId} month={month.format('YYYY-MM')} />
                </>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
