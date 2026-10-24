import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Popover, Segmented, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { TODAY } from '../api';
import { SLOTS } from '../mock/db';
import { BRAND } from '../theme';

/**
 * Lịch kiểu Google Calendar dùng chung: xem theo Tháng / Tuần / Ngày, buổi hiện đúng giờ ca,
 * các buổi trùng giờ xếp cạnh nhau, bấm vào một buổi để mở hộp thông tin.
 */
export interface CalEvent {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  slotId: string;
  title: string;
  /** các dòng phụ hiện trong khối ở chế độ Tuần/Ngày (giờ · phòng, giáo viên…) */
  lines: string[];
  color: { bg: string; fg: string };
  popover: React.ReactNode;
}

type View = 'month' | 'week' | 'day';
const FMT = 'YYYY-MM-DD';
const HOUR_PX = 64;
/** Con trỏ dấu cộng đỏ khi rê vào chỗ có thể thêm lịch */
const PLUS_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><circle cx='13' cy='13' r='12' fill='%23860d12'/><path d='M13 7v12M7 13h12' stroke='white' stroke-width='2.6' stroke-linecap='round'/></svg>") 13 13, copy`;
const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const minutesOf = (h: string, m: string) => Number(h) * 60 + Number(m);
export function slotRange(slotId: string): { start: number; end: number } {
  const t = SLOTS.find((s) => s.id === slotId)?.time ?? '';
  const m = /(\d{1,2}):(\d{2})\D+(\d{1,2}):(\d{2})/.exec(t);
  return m ? { start: minutesOf(m[1], m[2]), end: minutesOf(m[3], m[4]) } : { start: 17 * 60, end: 18 * 60 + 30 };
}
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const allRanges = SLOTS.map((s) => slotRange(s.id));
const GRID_START = Math.floor(Math.min(...allRanges.map((r) => r.start)) / 60) * 60;
const GRID_END = Math.ceil(Math.max(...allRanges.map((r) => r.end)) / 60) * 60;

const byTime = (a: CalEvent, b: CalEvent) => slotRange(a.slotId).start - slotRange(b.slotId).start || a.title.localeCompare(b.title, 'vi');

/** Xếp các buổi trùng giờ cạnh nhau thành các làn như Google Calendar. */
function layout(list: CalEvent[]) {
  const sorted = [...list].sort(byTime);
  const out: { e: CalEvent; lane: number; lanes: number }[] = [];
  let cluster: typeof out = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    cluster.forEach((p) => (p.lanes = laneEnds.length));
    out.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const e of sorted) {
    const { start, end } = slotRange(e.slotId);
    if (start >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((x) => x <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    clusterEnd = Math.max(clusterEnd, end);
    cluster.push({ e, lane, lanes: 1 });
  }
  flush();
  return out;
}

function MonthChip({ e }: { e: CalEvent }) {
  const { start } = slotRange(e.slotId);
  return (
    <Popover trigger="click" placement="right" content={e.popover}>
      <div
        role="button"
        tabIndex={0}
        title={`${hhmm(start)} ${e.title}`}
        style={{ background: e.color.bg, color: e.color.fg, borderRadius: 4, padding: '1px 6px', fontSize: 12, lineHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
      >
        <span style={{ opacity: 0.75 }}>{hhmm(start)}</span> <b>{e.title}</b>
      </div>
    </Popover>
  );
}

interface CreateProps {
  /** Bấm vào chỗ trống để thêm: ngày, và phút trong ngày nếu bấm trên lưới giờ (null ở chế độ Tháng) */
  onCreate?: (date: string, minutes: number | null) => void;
  /** Các ca hợp lệ của một ngày (rỗng = ngày không thêm được); mặc định mọi ca */
  slotsFor?: (date: string) => string[];
}

/** Chọn ca theo giờ bấm: ca chứa giờ đó, nếu không có thì ca gần nhất. */
export function pickSlot(ids: string[], minutes: number): string | null {
  if (!ids.length) return null;
  const inside = ids.find((id) => {
    const r = slotRange(id);
    return minutes >= r.start && minutes < r.end;
  });
  if (inside) return inside;
  return [...ids].sort((a, b) => Math.abs(slotRange(a).start - minutes) - Math.abs(slotRange(b).start - minutes))[0];
}

function MonthGrid({ cursor, byDate, closed, onPickDay, onCreate, slotsFor }: { cursor: Dayjs; byDate: Map<string, CalEvent[]>; closed: Map<string, string>; onPickDay: (d: Dayjs) => void } & CreateProps) {
  const first = cursor.startOf('month');
  const lead = (first.day() + 6) % 7;
  const start = first.subtract(lead, 'day');
  const cells = Array.from({ length: Math.ceil((first.daysInMonth() + lead) / 7) * 7 }, (_, i) => start.add(i, 'day'));
  const MAX = 3;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 760 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #ecdfe0', background: '#fbf6f6' }}>
          {WEEKDAYS.map((w) => (
            <div key={w} style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: '#7b8499' }}>
              {w}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((d) => {
            const key = d.format(FMT);
            const inMonth = d.month() === cursor.month();
            const isToday = key === TODAY;
            const list = [...(byDate.get(key) ?? [])].sort(byTime);
            const canCreate = !!onCreate && (slotsFor ? slotsFor(key).length > 0 : true);
            return (
              <div
                key={key}
                title={canCreate ? 'Bấm vào chỗ trống để thêm lịch' : undefined}
                onClick={(ev) => {
                  if (canCreate && !(ev.target as HTMLElement).closest('button,[role=button]')) onCreate!(key, null);
                }}
                style={{ minHeight: 128, borderRight: '1px solid #f1e6e7', borderBottom: '1px solid #f1e6e7', padding: '4px 4px 6px', background: closed.has(key) ? '#f2eeed' : inMonth ? '#fff' : '#faf7f6', cursor: canCreate ? PLUS_CURSOR : undefined, position: 'relative' }}
              >
                {canCreate && (
                  <button
                    type="button"
                    className="cal-plus"
                    aria-label={`Thêm lịch ngày ${d.format('DD/MM/YYYY')}`}
                    onClick={() => onCreate!(key, null)}
                    style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, border: 0, borderRadius: 11, background: 'transparent', color: '#b4a9a8', cursor: PLUS_CURSOR, fontSize: 16, lineHeight: '22px', padding: 0 }}
                  >
                    +
                  </button>
                )}
                <Flex justify="center" style={{ marginBottom: 2 }}>
                  <button
                    type="button"
                    onClick={() => onPickDay(d)}
                    aria-label={`Xem ngày ${d.format('DD/MM/YYYY')}`}
                    style={{ border: 0, cursor: 'pointer', minWidth: 26, height: 26, borderRadius: 13, fontSize: 12, background: isToday ? BRAND.red : 'transparent', color: isToday ? '#fff' : inMonth ? '#2b2726' : '#b4a9a8', fontWeight: isToday ? 700 : 400 }}
                  >
                    {d.date() === 1 ? `${d.date()}/${d.month() + 1}` : d.date()}
                  </button>
                </Flex>
                {closed.has(key) && <div style={{ fontSize: 11, color: '#7b8499', textAlign: 'center', marginBottom: 2 }}>Nghỉ: {closed.get(key)}</div>}
                <div style={{ display: 'grid', gap: 2 }}>
                  {list.slice(0, MAX).map((e) => (
                    <MonthChip key={e.id} e={e} />
                  ))}
                  {list.length > MAX && (
                    <button type="button" onClick={() => onPickDay(d)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 12, color: BRAND.red, textAlign: 'left', padding: '0 6px' }}>
                      +{list.length - MAX} buổi nữa
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimeGrid({ days, byDate, closed, onPickDay, onCreate, slotsFor }: { days: Dayjs[]; byDate: Map<string, CalEvent[]>; closed: Map<string, string>; onPickDay: (d: Dayjs) => void } & CreateProps) {
  const [hover, setHover] = useState<{ date: string; slotId: string } | null>(null);
  const idsOf = (date: string) => (slotsFor ? slotsFor(date) : SLOTS.map((s) => s.id));
  const minutesAt = (ev: React.MouseEvent<HTMLElement>) => GRID_START + ((ev.clientY - ev.currentTarget.getBoundingClientRect().top) / HOUR_PX) * 60;
  const hours = Array.from({ length: (GRID_END - GRID_START) / 60 }, (_, i) => GRID_START / 60 + i);
  const height = (GRID_END - GRID_START) * (HOUR_PX / 60);
  const cols = `56px repeat(${days.length}, minmax(${days.length > 1 ? 120 : 320}px, 1fr))`;
  const now = dayjs();
  const nowMin = now.hour() * 60 + now.minute();
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: days.length > 1 ? 56 + days.length * 120 : 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, borderBottom: '1px solid #ecdfe0', background: '#fff' }}>
          <div />
          {days.map((d) => {
            const key = d.format(FMT);
            const isToday = key === TODAY;
            return (
              <div key={key} style={{ textAlign: 'center', padding: '8px 4px', borderLeft: '1px solid #f1e6e7' }}>
                <div style={{ fontSize: 12, color: isToday ? BRAND.red : '#7b8499', fontWeight: isToday ? 700 : 400 }}>{WEEKDAYS[(d.day() + 6) % 7]}</div>
                <button type="button" onClick={() => onPickDay(d)} style={{ border: 0, cursor: 'pointer', width: 34, height: 34, borderRadius: 17, fontSize: 18, background: isToday ? BRAND.red : 'transparent', color: isToday ? '#fff' : '#2b2726' }}>
                  {d.date()}
                </button>
                {closed.has(key) && <div style={{ fontSize: 11, color: '#7b8499' }}>Nghỉ: {closed.get(key)}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: cols, position: 'relative' }}>
          <div>
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX, fontSize: 11, color: '#7b8499', textAlign: 'right', paddingRight: 8, transform: 'translateY(-7px)' }}>
                {h > hours[0] ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const key = d.format(FMT);
            return (
              <div
                key={key}
                title={onCreate && idsOf(key).length ? 'Bấm vào chỗ trống để thêm lịch' : undefined}
                onMouseMove={(ev) => {
                  if (!onCreate) return;
                  const id = (ev.target as HTMLElement).closest('[role=button]') ? null : pickSlot(idsOf(key), minutesAt(ev));
                  setHover((h) => (id ? (h?.date === key && h.slotId === id ? h : { date: key, slotId: id }) : null));
                }}
                onMouseLeave={() => setHover(null)}
                onClick={(ev) => {
                  if (!onCreate || (ev.target as HTMLElement).closest('[role=button]')) return;
                  const id = pickSlot(idsOf(key), minutesAt(ev));
                  if (id) onCreate(key, minutesAt(ev));
                }}
                style={{ position: 'relative', height, borderLeft: '1px solid #f1e6e7', background: closed.has(key) ? '#f6f3f2' : undefined, cursor: onCreate && idsOf(key).length ? PLUS_CURSOR : undefined }}
              >
                {hours.map((h, i) => (
                  <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: i * HOUR_PX, borderTop: i ? '1px solid #f1e6e7' : undefined, pointerEvents: 'none' }} />
                ))}
                {hover?.date === key &&
                  (() => {
                    const r = slotRange(hover.slotId);
                    return (
                      <div style={{ position: 'absolute', left: 2, right: 2, top: ((r.start - GRID_START) * HOUR_PX) / 60, height: ((r.end - r.start) * HOUR_PX) / 60 - 2, border: `1.5px dashed ${BRAND.red}`, background: 'rgba(134,13,18,0.05)', borderRadius: 6, color: BRAND.red, fontSize: 12, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
                        + Thêm lịch · {hhmm(r.start)}–{hhmm(r.end)}
                      </div>
                    );
                  })()}
                {key === TODAY && nowMin >= GRID_START && nowMin <= GRID_END && <div style={{ position: 'absolute', left: 0, right: 0, top: ((nowMin - GRID_START) * HOUR_PX) / 60, borderTop: `2px solid ${BRAND.red}`, zIndex: 1 }} />}
                {layout(byDate.get(key) ?? []).map(({ e, lane, lanes }) => {
                  const { start, end } = slotRange(e.slotId);
                  const h = ((end - start) * HOUR_PX) / 60 - 2;
                  return (
                    <Popover key={e.id} trigger="click" placement="right" content={e.popover}>
                      <div
                        role="button"
                        tabIndex={0}
                        style={{
                          position: 'absolute',
                          top: ((start - GRID_START) * HOUR_PX) / 60,
                          height: h,
                          left: `calc(${(lane / lanes) * 100}% + 2px)`,
                          width: `calc(${100 / lanes}% - 4px)`,
                          background: e.color.bg,
                          color: e.color.fg,
                          borderRadius: 6,
                          padding: '3px 6px',
                          fontSize: 12,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={{ fontWeight: 700, lineHeight: '15px' }}>{e.title}</div>
                        {e.lines.slice(0, h > 72 ? 4 : h > 56 ? 3 : 2).map((l, i) => (
                          <div key={i} style={{ opacity: 0.85 }}>
                            {l}
                          </div>
                        ))}
                      </div>
                    </Popover>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface BoardProps extends CreateProps {
  /** Trả về các buổi nằm trong [from, to] (đã gồm cả bộ lọc của trang) */
  getEvents: (from: Dayjs, to: Dayjs) => CalEvent[];
  closed: Map<string, string>;
  loading?: boolean;
  /** Thẻ số liệu phía trên lịch, tính từ các buổi đang hiển thị */
  header?: (events: CalEvent[]) => React.ReactNode;
  toolbarExtra?: React.ReactNode;
  legend?: React.ReactNode;
}

export function CalendarBoard({ getEvents, closed, loading, header, toolbarExtra, legend, onCreate, slotsFor }: BoardProps) {
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(dayjs(TODAY));

  const range = useMemo(() => {
    if (view === 'day') return { from: cursor, to: cursor };
    if (view === 'week') {
      const from = cursor.subtract((cursor.day() + 6) % 7, 'day');
      return { from, to: from.add(6, 'day') };
    }
    const first = cursor.startOf('month');
    const lead = (first.day() + 6) % 7;
    const from = first.subtract(lead, 'day');
    return { from, to: from.add(Math.ceil((first.daysInMonth() + lead) / 7) * 7 - 1, 'day') };
  }, [view, cursor]);

  const events = useMemo(() => getEvents(range.from, range.to), [getEvents, range]);
  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);

  const title =
    view === 'month' ? cursor.format('[tháng] M [năm] YYYY') : view === 'week' ? `${range.from.format('D')} – ${range.to.format('D [tháng] M, YYYY')}` : cursor.format('dddd, D [tháng] M, YYYY');
  const days = Array.from({ length: view === 'day' ? 1 : 7 }, (_, i) => (view === 'day' ? cursor : range.from.add(i, 'day')));
  const pick = (d: Dayjs) => {
    setCursor(d);
    setView('day');
  };

  return (
    <>
      {header?.(events)}
      <Card styles={{ body: { padding: 0 } }} loading={loading}>
        <Flex justify="space-between" align="center" wrap gap={12} style={{ padding: '14px 16px 6px' }}>
          <Flex align="center" gap={8} wrap>
            <Button onClick={() => setCursor(dayjs(TODAY))}>Hôm nay</Button>
            <Button type="text" shape="circle" aria-label="Trước" icon={<LeftOutlined />} onClick={() => setCursor(cursor.subtract(1, view))} />
            <Button type="text" shape="circle" aria-label="Sau" icon={<RightOutlined />} onClick={() => setCursor(cursor.add(1, view))} />
            <Typography.Title level={4} style={{ margin: '0 0 0 4px', color: BRAND.redDark }}>
              {title}
            </Typography.Title>
          </Flex>
          <Flex gap={8} wrap>
            {toolbarExtra}
            <Segmented
              value={view}
              onChange={(v) => setView(v as View)}
              options={[
                { value: 'month', label: 'Tháng' },
                { value: 'week', label: 'Tuần' },
                { value: 'day', label: 'Ngày' },
              ]}
            />
          </Flex>
        </Flex>
        <Flex justify="space-between" wrap gap={8} style={{ padding: '0 16px 12px', fontSize: 12, color: '#7b8499' }}>
          <Flex gap={14} wrap>
            {legend}
          </Flex>
          <span>{events.length} buổi học trong khoảng này · Giờ Việt Nam</span>
        </Flex>
        {view === 'month' ? <MonthGrid cursor={cursor} byDate={byDate} closed={closed} onPickDay={pick} onCreate={onCreate} slotsFor={slotsFor} /> : <TimeGrid days={days} byDate={byDate} closed={closed} onPickDay={pick} onCreate={onCreate} slotsFor={slotsFor} />}
      </Card>
    </>
  );
}
