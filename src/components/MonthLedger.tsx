import { useQuery } from '@tanstack/react-query';
import { Empty, Flex, Table, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { getMonthLedger, type LedgerRow } from '../api';
import type { AttendanceStatus } from '../domain/types';
import { ATTENDANCE_LABEL, fmtShort } from '../i18n/vi';
import { TABLE_PAGINATION } from './pagination';

/** Sổ điểm danh theo tháng của một lớp: mỗi ô là một buổi (có mặt, trễ, vắng, vắng đã báo, chưa ghi nhận). */
export function MonthLedger({ classId, month }: { classId: string; month: string }) {
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
