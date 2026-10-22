import {
  CalendarOutlined,
  ClockCircleOutlined,
  CloudOutlined,
  LeftOutlined,
  MoonOutlined,
  PlusOutlined,
  RightOutlined,
  SunOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Flex, Form, Modal, Popconfirm, Popover, Select, Table, Typography } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { CAP_GROUPS, TODAY, addCapSlot, getCap, listClasses, listHolidays, removeCapSlot, type CapCell } from '../api';
import { PageHeader } from '../components/PageHeader';
import { weekdaysLabel } from '../domain/schedule';
import { ROOMS, SLOTS } from '../mock/db';
import { fmtDate } from '../i18n/vi';
import { BRAND } from '../theme';

const PALETTE = [
  { bg: '#fdeaee', fg: '#b4233f', pill: '#fbd3dc' },
  { bg: '#e8f0fe', fg: '#1d4ed8', pill: '#d3e2fd' },
  { bg: '#e6f5ec', fg: '#15803d', pill: '#cdebd8' },
  { bg: '#f0eafd', fg: '#6d28d9', pill: '#e1d5fa' },
  { bg: '#fff0df', fg: '#c2410c', pill: '#fddcb8' },
  { bg: '#e1f4f3', fg: '#0f766e', pill: '#c4e8e6' },
];
const colorOf = (classId: string) => PALETTE[(parseInt(classId.replace(/\D/g, ''), 10) || 0) % PALETTE.length];

const SLOT_ICON: Record<string, React.ReactNode> = {
  chieu: <SunOutlined />,
  toi1: <CloudOutlined />,
  toi2: <MoonOutlined />,
  t7a: <SunOutlined />,
  t7b: <CloudOutlined />,
};
const SLOT_TINT: Record<string, { bg: string; fg: string }> = {
  chieu: { bg: '#fff4dc', fg: '#d48806' },
  toi1: { bg: '#ffe9e1', fg: '#d4380d' },
  toi2: { bg: '#efe8fb', fg: '#6d28d9' },
  t7a: { bg: '#fff4dc', fg: '#d48806' },
  t7b: { bg: '#ffe9e1', fg: '#d4380d' },
};

interface Target {
  group: string;
  slotId: string;
  room: string;
}

const CELL_HEIGHT = 112;
const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

/** Mọi thẻ lớp cùng một khung cố định (cùng chiều cao, cùng 4 dòng) để lưới CAP đều nhau. */
function CapCard({ cell, onRemove }: { cell: CapCell; onRemove: () => void }) {
  const c = colorOf(cell.cls.id);
  const hasGroup = cell.cls.name.includes(' · ');
  const tag = hasGroup ? cell.cls.name.split(' · ')[0] : cell.cls.subject;
  const title = cell.cls.name.replace(' · ', ' - ');
  return (
    <Popover
      trigger="click"
      title={`${cell.cls.name} · ${cell.students.length} học viên`}
      content={
        <Flex vertical gap={8} style={{ minWidth: 200 }}>
          {cell.students.length ? (
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {cell.students.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          ) : (
            <Typography.Text type="secondary">Lớp chưa có học viên.</Typography.Text>
          )}
          <Popconfirm title="Gỡ lớp này khỏi ô lịch?" description="Lớp và học viên vẫn được giữ nguyên." okText="Gỡ" cancelText="Hủy" onConfirm={onRemove}>
            <Button size="small" danger>
              Gỡ khỏi lịch
            </Button>
          </Popconfirm>
        </Flex>
      }
    >
      <div
        style={{
          background: c.bg,
          borderRadius: 12,
          padding: '10px 12px',
          cursor: 'pointer',
          fontSize: 12,
          lineHeight: '18px',
          position: 'relative',
          height: CELL_HEIGHT,
          boxSizing: 'border-box',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <span aria-hidden style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: c.fg }} />
        <span style={{ alignSelf: 'flex-start', maxWidth: '85%', background: c.pill, color: c.fg, borderRadius: 6, padding: '0 8px', fontWeight: 600, fontSize: 11, ...ellipsis }}>{tag}</span>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#2b2726', ...ellipsis }} title={title}>
          {title}
        </div>
        <div style={{ color: '#6b6665', ...ellipsis }}>
          GV: {cell.teacherName}
          {cell.cls.assistant ? ` · TG: ${cell.cls.assistant}` : ''}
        </div>
        <div style={{ color: '#6b6665', marginTop: 'auto' }}>
          <TeamOutlined /> {cell.students.length}/{cell.cls.maxSize} học viên
        </div>
      </div>
    </Popover>
  );
}

export function CapPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const todayDay = dayjs(TODAY).day();
  const todayIdx = todayDay === 6 || todayDay === 0 ? 2 : todayDay % 2 === 0 ? 1 : 0;
  const [step, setStep] = useState(todayIdx);
  const [target, setTarget] = useState<Target | null>(null);
  const [form] = Form.useForm();

  const weekOffset = Math.floor(step / 3);
  const group = CAP_GROUPS[((step % 3) + 3) % 3];
  const monday = dayjs(TODAY).subtract((todayDay + 6) % 7, 'day').add(weekOffset, 'week');
  const from = monday.add(group.fromOffset, 'day');
  const to = monday.add(group.toOffset, 'day');
  const range = group.fromOffset === group.toOffset ? from.format('DD/MM/YYYY') : `${from.format('DD/MM')} - ${to.format('DD/MM/YYYY')}`;
  const containsToday = TODAY >= from.format('YYYY-MM-DD') && TODAY <= to.format('YYYY-MM-DD');

  const cap = useQuery({ queryKey: ['cap', group.value], queryFn: () => getCap(group.value) });
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const holidays = useQuery({ queryKey: ['holidays'], queryFn: listHolidays });

  const weekHolidays = (holidays.data ?? []).filter((h) => h.date >= from.format('YYYY-MM-DD') && h.date <= to.format('YYYY-MM-DD'));
  const slots = SLOTS.filter((s) => group.slots.includes(s.id));
  const floors = ['Lầu 1', 'Lầu 2'].map((name) => ({ name, rooms: ROOMS.filter((r) => r.floor === name) }));

  const eligible = useMemo(
    () => (classes.data ?? []).filter((c) => c.active && group.days.every((d) => c.weekdays.includes(d))),
    [classes.data, group],
  );

  const add = useMutation({
    mutationFn: addCapSlot,
    onSuccess: () => {
      message.success('Đã xếp lớp vào lịch CAP.');
      setTarget(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });
  const remove = useMutation({
    mutationFn: removeCapSlot,
    onSuccess: () => {
      message.success('Đã gỡ lớp khỏi ô lịch.');
      qc.invalidateQueries();
    },
  });

  const openCreate = (t?: Partial<Target>) => {
    const next = { group: group.value, slotId: t?.slotId ?? slots[0].id, room: t?.room ?? ROOMS[0].id };
    setTarget(next);
    form.resetFields();
    form.setFieldsValue({ slotId: next.slotId, room: next.room });
  };

  const renderCell = (slotId: string, room: string) => {
    const c = cap.data?.[`${slotId}|${room}`];
    if (c) {
      return <CapCard cell={c} onRemove={() => remove.mutate({ classId: c.cls.id, group: group.value, slotId, room })} />;
    }
    return (
      <button type="button" className="cap-empty" aria-label={`Thêm lịch phòng ${room}`} onClick={() => openCreate({ slotId, room })}>
        <span className="cap-empty-dash">—</span>
        <PlusOutlined className="cap-empty-plus" />
      </button>
    );
  };

  return (
    <div className="fade-in">
      <PageHeader
        icon={<CalendarOutlined />}
        title="Lịch CAP"
        subtitle="Theo dõi lịch học, lịch giảng dạy và phân bổ lớp một cách nhanh chóng, thuận tiện."
      />

      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex gap={8} align="center">
          <Button aria-label="Trước" icon={<LeftOutlined />} onClick={() => setStep((s) => s - 1)} />
          <Button icon={<CalendarOutlined />} style={{ minWidth: 260, pointerEvents: 'none' }}>
            {group.label} ({range})
          </Button>
          <Button aria-label="Sau" icon={<RightOutlined />} onClick={() => setStep((s) => s + 1)} />
        </Flex>
        <Flex gap={8}>
          <Button icon={<CalendarOutlined />} onClick={() => setStep(todayIdx)} disabled={step === todayIdx}>
            Tuần này
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
            Thêm lịch
          </Button>
        </Flex>
      </Flex>

      {weekHolidays.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`Trung tâm nghỉ: ${weekHolidays.map((h) => `${fmtDate(h.date)} (${h.reason})`).join(', ')}`}
        />
      )}
      {containsToday && (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          Khoảng ngày này có hôm nay ({fmtDate(TODAY)}).
        </Typography.Text>
      )}

      <div style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <Table
          bordered={false}
          size="middle"
          loading={cap.isLoading}
          pagination={false}
          rowKey="id"
          dataSource={slots}
          scroll={{ x: 150 + 7 * 180 }}
          className="cap-table"
          tableLayout="fixed"
          columns={[
            {
              title: (
                <Flex gap={10} align="center">
                  <ClockCircleOutlined style={{ color: BRAND.red, fontSize: 18 }} /> Ca
                </Flex>
              ),
              width: 150,
              fixed: 'left',
              render: (_, s) => {
                const tint = SLOT_TINT[s.id];
                return (
                  <Flex gap={10} align="center">
                    <span style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', background: tint.bg, color: tint.fg, flex: 'none' }}>
                      {SLOT_ICON[s.id]}
                    </span>
                    <div>
                      <strong>{s.label}</strong>
                      <div style={{ fontSize: 12, color: '#6b6665' }}>{s.time.replace('–', ' - ')}</div>
                    </div>
                  </Flex>
                );
              },
            },
            ...floors.map((f) => ({
              title: f.name,
              align: 'center' as const,
              children: f.rooms.map((r) => ({
                title: r.id.length > 4 ? r.id : `P.${r.id}`,
                align: 'center' as const,
                width: 180,
                render: (_: unknown, s: (typeof SLOTS)[number]) => renderCell(s.id, r.id),
              })),
            })),
          ]}
        />
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
        CAP là nơi điều phối độc lập hay nguồn sinh lịch chính vẫn chờ quyết định (docs/08 #7). Bấm ô trống để xếp lớp, bấm ô có lớp để xem học viên hoặc gỡ khỏi lịch.
      </Typography.Text>

      <Modal
        title="Thêm lịch CAP"
        open={!!target}
        onCancel={() => setTarget(null)}
        onOk={() => form.submit()}
        okText="Xếp lớp"
        cancelText="Hủy"
        confirmLoading={add.isPending}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => add.mutate({ classId: v.classId, group: group.value, slotId: v.slotId, room: v.room })}
        >
          <Typography.Paragraph type="secondary">
            Nhóm ngày: <strong>{group.label}</strong> ({range}). Chỉ lớp có lịch học vào các ngày này mới xếp được.
          </Typography.Paragraph>
          <Form.Item name="classId" label="Lớp" rules={[{ required: true, message: 'Chọn lớp' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn lớp"
              notFoundContent="Không có lớp nào học vào các ngày của nhóm này"
              options={eligible.map((c) => ({ value: c.id, label: `${c.name} · ${weekdaysLabel(c.weekdays)} · GV ${c.teacherName}` }))}
            />
          </Form.Item>
          <Flex gap={12} wrap>
            <Form.Item name="slotId" label="Ca" rules={[{ required: true }]} style={{ flex: 1, minWidth: 180 }}>
              <Select options={slots.map((s) => ({ value: s.id, label: `${s.label} · ${s.time}` }))} />
            </Form.Item>
            <Form.Item name="room" label="Phòng" rules={[{ required: true }]} style={{ flex: 1, minWidth: 180 }}>
              <Select options={ROOMS.map((r) => ({ value: r.id, label: `${r.floor} · ${r.id}` }))} />
            </Form.Item>
          </Flex>
        </Form>
      </Modal>
    </div>
  );
}
