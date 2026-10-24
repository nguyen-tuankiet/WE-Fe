import { ApartmentOutlined, CalendarOutlined, PlusOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Flex, Form, Modal, Popconfirm, Select, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import { CAP_GROUPS, addCapSlot, getCap, listClasses, listHolidays, removeCapSlot, type CapCell } from '../api';
import { CalendarBoard, hhmm, pickSlot, slotRange, type CalEvent } from '../components/CalendarBoard';
import { PageHeader } from '../components/PageHeader';
import { weekdaysLabel } from '../domain/schedule';
import { ROOMS, SLOTS } from '../mock/db';
import { BRAND } from '../theme';

const PALETTE = [
  { bg: '#fdeaee', fg: '#b4233f' },
  { bg: '#e8f0fe', fg: '#1d4ed8' },
  { bg: '#e6f5ec', fg: '#15803d' },
  { bg: '#f0eafd', fg: '#6d28d9' },
  { bg: '#fff0df', fg: '#c2410c' },
  { bg: '#e1f4f3', fg: '#0f766e' },
];
const colorOf = (classId: string) => PALETTE[(parseInt(classId.replace(/\D/g, ''), 10) || 0) % PALETTE.length];

/** Nhóm ngày CAP của một ngày cụ thể (Chủ nhật không thuộc nhóm nào). */
const groupOfDate = (date: string) => CAP_GROUPS.find((g) => (g.days as readonly number[]).includes(dayjs(date).day()));

interface Slot {
  group: string;
  slotId: string;
  room: string;
  cell: CapCell;
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card size="small" styles={{ body: { padding: '14px 18px' } }}>
      <Flex justify="space-between" align="center">
        <div>
          <Typography.Text type="secondary">{label}</Typography.Text>
          <div style={{ fontSize: 30, fontWeight: 700, color: BRAND.red, lineHeight: 1.2 }}>{value}</div>
        </div>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: BRAND.redSoft, color: BRAND.red, display: 'grid', placeItems: 'center', fontSize: 20 }}>{icon}</div>
      </Flex>
    </Card>
  );
}

/** Lịch CAP: các lớp đã xếp vào phòng và ca, lặp lại hằng tuần theo nhóm ngày. Xem theo tháng/tuần/ngày; thêm hoặc gỡ lớp khỏi lịch. */
export function CapPage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState<string | undefined>();
  const [room, setRoom] = useState<string | undefined>();
  const [form] = Form.useForm();
  const [picked, setPicked] = useState<string | null>(null);
  const formGroup = Form.useWatch('group', form) as string | undefined;
  const formSlot = Form.useWatch('slotId', form) as string | undefined;

  const caps = useQueries({ queries: CAP_GROUPS.map((g) => ({ queryKey: ['cap', g.value], queryFn: () => getCap(g.value) })) });
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const holidays = useQuery({ queryKey: ['holidays'], queryFn: listHolidays });
  const closed = useMemo(() => new Map((holidays.data ?? []).map((h) => [h.date, h.reason])), [holidays.data]);

  /** Mọi ô CAP đã xếp, gộp theo nhóm ngày */
  const slots = useMemo<Slot[]>(
    () =>
      CAP_GROUPS.flatMap((g, i) =>
        Object.entries(caps[i].data ?? {}).map(([key, cell]) => {
          const [slotId, ...rest] = key.split('|');
          return { group: g.value, slotId, room: rest.join('|'), cell };
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [caps.map((c) => c.dataUpdatedAt).join('|')],
  );
  const loading = caps.some((c) => c.isLoading);

  const remove = useMutation({
    mutationFn: removeCapSlot,
    onSuccess: () => {
      message.success('Đã gỡ lớp khỏi lịch CAP.');
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });
  const add = useMutation({
    mutationFn: addCapSlot,
    onSuccess: () => {
      message.success('Đã xếp lớp vào lịch CAP.');
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const filtered = useMemo(() => slots.filter((s) => (!classId || s.cell.cls.id === classId) && (!room || s.room === room)), [slots, classId, room]);

  const getEvents = useCallback(
    (from: Dayjs, to: Dayjs): CalEvent[] => {
      const out: CalEvent[] = [];
      for (let d = from; !d.isAfter(to, 'day'); d = d.add(1, 'day')) {
        const date = d.format('YYYY-MM-DD');
        for (const s of filtered) {
          const g = CAP_GROUPS.find((x) => x.value === s.group)!;
          if (!(g.days as readonly number[]).includes(d.day())) continue;
          const { start, end } = slotRange(s.slotId);
          const c = s.cell;
          const col = colorOf(c.cls.id);
          out.push({
            id: `${date}|${s.group}|${s.slotId}|${s.room}`,
            date,
            slotId: s.slotId,
            title: c.cls.name,
            lines: [`${hhmm(start)}–${hhmm(end)} · P.${s.room}`, `GV ${c.teacherName}`, `${c.students.length}/${c.cls.maxSize} học viên`],
            color: col,
            popover: (
              <div style={{ width: 280 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{c.cls.name}</div>
                <div style={{ color: '#7b8499', marginBottom: 8 }}>
                  {d.format('dddd, DD/MM/YYYY')} · {SLOTS.find((x) => x.id === s.slotId)?.label} {hhmm(start)}–{hhmm(end)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', rowGap: 4, fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: '#7b8499' }}>Phòng</span>
                  <span>{s.room}</span>
                  <span style={{ color: '#7b8499' }}>Giáo viên</span>
                  <span>{c.teacherName}</span>
                  {c.cls.assistant && (
                    <>
                      <span style={{ color: '#7b8499' }}>Trợ giảng</span>
                      <span>{c.cls.assistant}</span>
                    </>
                  )}
                  <span style={{ color: '#7b8499' }}>Lặp lại</span>
                  <span>{g.label} hằng tuần</span>
                </div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                  <TeamOutlined /> Học viên ({c.students.length}/{c.cls.maxSize})
                </div>
                {c.students.length ? (
                  <ol style={{ margin: 0, paddingLeft: 18, maxHeight: 150, overflowY: 'auto', fontSize: 13 }}>
                    {c.students.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ol>
                ) : (
                  <Typography.Text type="secondary">Lớp chưa có học viên.</Typography.Text>
                )}
                <Popconfirm title="Gỡ lớp này khỏi lịch CAP?" description="Áp dụng cho mọi tuần của ô này. Lớp và học viên vẫn được giữ nguyên." okText="Gỡ" cancelText="Hủy" onConfirm={() => remove.mutate({ classId: c.cls.id, group: s.group, slotId: s.slotId, room: s.room })}>
                  <Button size="small" danger style={{ marginTop: 10 }}>
                    Gỡ khỏi lịch CAP
                  </Button>
                </Popconfirm>
              </div>
            ),
          });
        }
      }
      return out;
    },
    [filtered, remove],
  );

  const placed = new Set(slots.map((s) => s.cell.cls.id));
  const unplaced = (classes.data ?? []).filter((c) => c.active && !placed.has(c.id)).length;

  const group = CAP_GROUPS.find((g) => g.value === formGroup);
  const eligible = (classes.data ?? []).filter((c) => c.active && (!group || group.days.every((d) => c.weekdays.includes(d))));

  const takenRooms = (g: string, slotId: string) => new Set(slots.filter((s) => s.group === g && s.slotId === slotId).map((s) => s.room));
  const freeRoom = (g: string, slotId: string) => ROOMS.find((r) => !takenRooms(g, slotId).has(r.id))?.id ?? ROOMS[0].id;

  /** Mở form thêm lịch, điền sẵn theo ô vừa bấm (ngày → nhóm ngày, giờ → ca, phòng trống đầu tiên). */
  const openCreate = (date?: string, minutes?: number | null) => {
    const g = date ? groupOfDate(date) : CAP_GROUPS[0];
    if (!g) {
      message.info('Chủ nhật không thuộc nhóm ngày CAP nào.');
      return;
    }
    const slotId = (minutes != null ? pickSlot([...g.slots], minutes) : null) ?? g.slots[0];
    setPicked(date ?? null);
    setOpen(true);
    form.resetFields();
    form.setFieldsValue({ group: g.value, slotId, room: freeRoom(g.value, slotId) });
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Lịch CAP"
        subtitle="Lịch học, phòng và giáo viên của các lớp, lặp lại hằng tuần. Bấm vào một buổi để xem học viên hoặc gỡ khỏi lịch."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
            Thêm lịch
          </Button>
        }
      />

      <CalendarBoard
        getEvents={getEvents}
        onCreate={openCreate}
        slotsFor={(date) => [...(groupOfDate(date)?.slots ?? [])]}
        closed={closed}
        loading={loading}
        header={(events) => (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 16 }}>
            <StatCard label="Buổi trong khoảng đang xem" value={events.length} icon={<CalendarOutlined />} />
            <StatCard label="Lớp đã xếp lịch CAP" value={placed.size} icon={<ApartmentOutlined />} />
            <StatCard label="Phòng đang sử dụng" value={new Set(slots.map((s) => s.room)).size} icon={<TeamOutlined />} />
            <StatCard label="Lớp chưa xếp lịch CAP" value={unplaced} icon={<WarningOutlined />} />
          </div>
        )}
        toolbarExtra={
          <>
            <Select allowClear showSearch optionFilterProp="label" placeholder="Mọi lớp" style={{ width: 200, maxWidth: '100%' }} value={classId} onChange={setClassId} options={(classes.data ?? []).filter((c) => placed.has(c.id)).map((c) => ({ value: c.id, label: c.name }))} />
            <Select allowClear placeholder="Mọi phòng" style={{ width: 130 }} value={room} onChange={setRoom} options={ROOMS.map((r) => ({ value: r.id, label: r.id.length > 4 ? r.id : `P.${r.id}` }))} />
          </>
        }
        legend={
          <span>
            Mỗi lớp một màu · Bấm vào chỗ trống trên lịch để thêm lịch nhanh
          </span>
        }
      />
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
        CAP là nơi điều phối độc lập hay nguồn sinh lịch chính vẫn chờ quyết định (docs/08 #7). Ngày trung tâm nghỉ được tô xám.
      </Typography.Text>

      <Modal title="Thêm lịch CAP" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} okText="Xếp lớp" cancelText="Hủy" confirmLoading={add.isPending} destroyOnHidden>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => add.mutate({ classId: v.classId, group: v.group, slotId: v.slotId, room: v.room })}>
          {picked && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              Bạn chọn ngày <b>{dayjs(picked).format('dddd, DD/MM/YYYY')}</b>. Lịch CAP lặp lại hằng tuần cho cả nhóm ngày <b>{group?.label}</b>.
            </Typography.Paragraph>
          )}
          <Form.Item name="group" label="Nhóm ngày" rules={[{ required: true }]}>
            <Select
              options={CAP_GROUPS.map((g) => ({ value: g.value, label: g.label }))}
              onChange={(v) => {
                const g = CAP_GROUPS.find((x) => x.value === v)!;
                form.setFieldsValue({ classId: undefined, slotId: g.slots[0], room: freeRoom(g.value, g.slots[0]) });
              }}
            />
          </Form.Item>
          <Form.Item name="classId" label="Lớp" extra="Chỉ lớp có lịch học vào các ngày của nhóm mới xếp được." rules={[{ required: true, message: 'Chọn lớp' }]}>
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
              <Select
                onChange={(v) => form.setFieldsValue({ room: freeRoom(group?.value ?? CAP_GROUPS[0].value, v) })}
                options={SLOTS.filter((s) => (group?.slots ?? CAP_GROUPS[0].slots).includes(s.id as never)).map((s) => ({ value: s.id, label: `${s.label} · ${s.time}` }))}
              />
            </Form.Item>
            <Form.Item name="room" label="Phòng" rules={[{ required: true }]} style={{ flex: 1, minWidth: 180 }}>
              <Select
                options={ROOMS.map((r) => {
                  const busy = !!group && !!formSlot && takenRooms(group.value, formSlot).has(r.id);
                  return { value: r.id, label: `${r.floor} · ${r.id}${busy ? ' (đã có lớp)' : ''}`, disabled: busy };
                })}
              />
            </Form.Item>
          </Flex>
        </Form>
      </Modal>
    </div>
  );
}
