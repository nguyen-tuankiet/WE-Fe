import { ArrowDownOutlined, ArrowUpOutlined, DownloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, DatePicker, Empty, Flex, Input, Segmented, Select, Table, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { listExams, type ExamResultView } from '../api';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { RatingTag } from '../components/StatusTag';
import type { Rating } from '../domain/types';
import { RATING_COLOR, RATING_LABEL, fmtDate, fmtPercent } from '../i18n/vi';

interface StudentSummary {
  studentId: string;
  code: string;
  name: string;
  programs: string[];
  count: number;
  latest: ExamResultView;
  /** chênh lệch % so với lần kiểm tra liền trước (null nếu mới có 1 lần) */
  delta: number | null;
}

const RATINGS: Rating[] = ['good', 'average', 'redflag'];

/** Gộp các kết quả (đã lọc) theo học viên; kết quả "gần nhất" là lần kiểm tra mới nhất trong phạm vi lọc. */
function summarize(results: ExamResultView[]): StudentSummary[] {
  const by = new Map<string, ExamResultView[]>();
  for (const r of results) by.set(r.view.student.id, [...(by.get(r.view.student.id) ?? []), r]);
  return [...by.entries()].map(([studentId, list]) => {
    const sorted = [...list].sort((a, b) => b.result.date.localeCompare(a.result.date) || Number(b.result.id) - Number(a.result.id));
    return {
      studentId,
      code: sorted[0].view.student.code,
      name: sorted[0].view.student.name,
      programs: [...new Set(sorted.map((r) => r.view.program.name))],
      count: sorted.length,
      latest: sorted[0],
      delta: sorted[1] ? Math.round((sorted[0].percent - sorted[1].percent) * 10) / 10 : null,
    };
  });
}

/** Tổng hợp kết quả kiểm tra của mọi học viên; bấm vào một dòng để mở báo cáo chi tiết. */
export function ReportsPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const exams = useQuery({ queryKey: ['exams'], queryFn: listExams });
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState<Rating | 'all'>('all');
  const [program, setProgram] = useState<string | undefined>();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const legacy = params.get('hv');

  const base = useMemo(() => {
    const [from, to] = [range?.[0]?.format('YYYY-MM-DD'), range?.[1]?.format('YYYY-MM-DD')];
    return (exams.data?.results ?? []).filter(
      (r) => (!from || r.result.date >= from) && (!to || r.result.date <= to) && (!program || r.view.program.name === program),
    );
  }, [exams.data, range, program]);

  const all = useMemo(() => summarize(base), [base]);
  const counts = useMemo(() => Object.fromEntries(RATINGS.map((k) => [k, all.filter((s) => s.latest.rating === k).length])) as Record<Rating, number>, [all]);
  const rows = useMemo(() => {
    const k = search.trim().toLowerCase();
    return all
      .filter((s) => (rating === 'all' || s.latest.rating === rating) && (!k || s.name.toLowerCase().includes(k) || s.code.toLowerCase().includes(k)))
      .sort((a, b) => b.latest.result.date.localeCompare(a.latest.result.date) || a.name.localeCompare(b.name, 'vi'));
  }, [all, rating, search]);

  const programNames = useMemo(() => [...new Set((exams.data?.results ?? []).map((r) => r.view.program.name))].sort((a, b) => a.localeCompare(b, 'vi')), [exams.data]);

  if (legacy) return <Navigate to={`/bao-cao/${legacy}`} replace />;

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const header = ['Mã', 'Học viên', 'Chương trình', 'Số lần kiểm tra', 'Ngày kiểm tra gần nhất', 'Kết quả (%)', 'Phân loại', 'Thay đổi so với lần trước (%)'];
    const lines = rows.map((s) =>
      [s.code, s.name, s.programs.join(' / '), s.count, s.latest.result.date, s.latest.percent, RATING_LABEL[s.latest.rating], s.delta ?? ''].map(esc).join(','),
    );
    const url = URL.createObjectURL(new Blob([`﻿${[header.map(esc).join(','), ...lines].join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bao-cao-hoc-tap.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in">
      <PageHeader title="Báo cáo học tập" subtitle="Tổng hợp kết quả kiểm tra của mọi học viên. Bấm vào một học viên để xem báo cáo chi tiết và in." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Card size="small">
          <Typography.Text type="secondary">Học viên đã kiểm tra</Typography.Text>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{all.length}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{base.length} lần kiểm tra</Typography.Text>
        </Card>
        {RATINGS.map((k) => (
          <Card key={k} size="small" hoverable onClick={() => setRating(rating === k ? 'all' : k)} style={{ cursor: 'pointer', background: rating === k ? '#f7efef' : undefined }}>
            <Typography.Text type="secondary">Lần gần nhất: {RATING_LABEL[k]}</Typography.Text>
            <div style={{ fontSize: 26, fontWeight: 700, color: RATING_COLOR[k] === 'green' || RATING_COLOR[k] === 'success' ? '#1f7a3d' : undefined }}>{counts[k]}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{rating === k ? 'Đang lọc — bấm để bỏ lọc' : 'Bấm để lọc'}</Typography.Text>
          </Card>
        ))}
      </div>

      <Card>
        <Flex gap={8} wrap justify="space-between" style={{ marginBottom: 12 }}>
          <Flex gap={8} wrap>
            <Input.Search allowClear placeholder="Tìm tên hoặc mã học viên" style={{ width: 260, maxWidth: '100%' }} onChange={(e) => setSearch(e.target.value)} />
            <Select allowClear showSearch placeholder="Mọi chương trình" style={{ width: 220, maxWidth: '100%' }} value={program} onChange={setProgram} options={programNames.map((p) => ({ value: p, label: p }))} />
            <DatePicker.RangePicker format="DD/MM/YYYY" placeholder={['Kiểm tra từ', 'đến']} onChange={(v) => setRange(v)} />
          </Flex>
          <Flex gap={8} wrap>
            <Segmented
              value={rating}
              onChange={(v) => setRating(v as Rating | 'all')}
              options={[{ value: 'all', label: 'Tất cả' }, ...RATINGS.map((k) => ({ value: k, label: RATING_LABEL[k] }))]}
            />
            <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!rows.length}>
              Xuất CSV
            </Button>
          </Flex>
        </Flex>

        <Table<StudentSummary>
          rowKey="studentId"
          loading={exams.isLoading}
          dataSource={rows}
          pagination={TABLE_PAGINATION}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty description={all.length ? 'Không có học viên khớp bộ lọc' : 'Chưa có kết quả kiểm tra nào'} /> }}
          onRow={(r) => ({ onClick: () => navigate(`/bao-cao/${r.studentId}`), style: { cursor: 'pointer' } })}
          columns={[
            {
              title: 'Học viên',
              sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
              render: (_, r) => (
                <div>
                  <strong>{r.name}</strong>
                  <div style={{ fontSize: 12, color: '#7b8499' }}>{r.code}</div>
                </div>
              ),
            },
            { title: 'Chương trình', render: (_, r) => r.programs.join(', ') },
            { title: 'Số lần KT', width: 100, align: 'center', sorter: (a, b) => a.count - b.count, render: (_, r) => r.count },
            { title: 'Ngày KT gần nhất', width: 150, sorter: (a, b) => a.latest.result.date.localeCompare(b.latest.result.date), render: (_, r) => fmtDate(r.latest.result.date) },
            { title: 'Kết quả', width: 110, align: 'right', sorter: (a, b) => a.latest.percent - b.latest.percent, render: (_, r) => <strong>{fmtPercent(r.latest.percent)}</strong> },
            { title: 'Phân loại', width: 130, render: (_, r) => <RatingTag rating={r.latest.rating} /> },
            {
              title: 'So với lần trước',
              width: 140,
              render: (_, r) =>
                r.delta === null ? (
                  <Typography.Text type="secondary">Lần đầu</Typography.Text>
                ) : r.delta === 0 ? (
                  <Typography.Text type="secondary">Không đổi</Typography.Text>
                ) : (
                  <span style={{ color: r.delta > 0 ? '#1f7a3d' : '#a8321e', fontWeight: 600 }}>
                    {r.delta > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(r.delta)}%
                  </span>
                ),
            },
            { title: '', width: 100, render: (_, r) => <Link to={`/bao-cao/${r.studentId}`} onClick={(e) => e.stopPropagation()}>Xem báo cáo</Link> },
          ]}
        />
      </Card>
    </div>
  );
}
