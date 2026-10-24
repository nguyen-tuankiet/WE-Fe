import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Collapse, Descriptions, Empty, Flex, Select, Spin, Table, Tag, Timeline, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { getStudentProfile, listReportStudents, type ExamResultView } from '../api';
import { IN_MEMORY_ROUTER } from '../env';
import { PageHeader } from '../components/PageHeader';
import { RatingTag } from '../components/StatusTag';
import { CRITERIA, classify, thresholdsFor } from '../domain/grading';
import { RATING_COLOR, fmtDate, fmtPercent } from '../i18n/vi';

function ResultBlock({ r }: { r: ExamResultView }) {
  const template = r.template;
  if (!template) return null;
  const thresholds = thresholdsFor(r.view.student);
  const criteria = CRITERIA[template];
  return (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      title={
        <Flex justify="space-between" wrap gap={8}>
          <span>
            {fmtDate(r.result.date)} · {r.view.program.name}
          </span>
          <Flex gap={8} align="center">
            <strong>{fmtPercent(r.percent)}</strong>
            <RatingTag rating={r.rating} />
          </Flex>
        </Flex>
      }
    >
      <Table
        size="small"
        pagination={false}
        rowKey="unitId"
        scroll={{ x: 520 }}
        dataSource={r.result.units}
        columns={[
          { title: 'Unit', render: (_, u) => r.result.snapshot.find((s) => s.id === u.unitId)?.name ?? u.unitId, width: 80 },
          { title: 'Chủ đề', render: (_, u) => r.result.snapshot.find((s) => s.id === u.unitId)?.topic },
          ...criteria.map((c) => ({
            title: c.label,
            render: (_: unknown, u: (typeof r.result.units)[number]) => {
              const v = u.values[c.key];
              if (v === null || v === undefined) return '—';
              if (c.kind === 'score') {
                const rating = classify(Number(v), thresholds.redflagBelow, thresholds.goodAbove);
                return <Tag color={RATING_COLOR[rating]}>{Math.round(Number(v) * 10) / 10}%</Tag>;
              }
              return c.options?.find((o) => o.value === v)?.label ?? String(v);
            },
          })),
        ]}
      />
      <Descriptions size="small" column={1} style={{ marginTop: 12 }}>
        <Descriptions.Item label="Nhận xét">{r.result.comment || '—'}</Descriptions.Item>
        <Descriptions.Item label="Hướng hỗ trợ">{r.result.support || '—'}</Descriptions.Item>
        <Descriptions.Item label="Người chấm">{r.result.examiner}</Descriptions.Item>
      </Descriptions>
      <Collapse
        ghost
        size="small"
        items={[
          {
            key: 'snap',
            label: 'Nội dung đã dùng khi kiểm tra (không đổi khi ngân hàng câu hỏi được sửa)',
            children: r.result.snapshot.map((u) => (
              <div key={u.id} style={{ marginBottom: 6 }}>
                <strong>{u.name} · {u.topic}:</strong> {u.words.join(', ')} — {u.patterns.join(' · ')}
              </div>
            )),
          },
        ]}
      />
    </Card>
  );
}

/** Báo cáo học tập của một học viên (in được). Chuyển nhanh sang học viên khác bằng ô tìm kiếm. */
export function ReportDetailPage() {
  const { studentId = '' } = useParams();
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ['report-students'], queryFn: listReportStudents });
  const profile = useQuery({ queryKey: ['student', studentId], queryFn: () => getStudentProfile(studentId), enabled: !!studentId });
  const exams = [...(profile.data?.exams ?? [])].sort((a, b) => b.result.date.localeCompare(a.result.date));

  return (
    <div className="fade-in">
      <Button className="no-print" type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/bao-cao')} style={{ marginBottom: 8, paddingLeft: 0 }}>
        Tổng hợp báo cáo
      </Button>
      <PageHeader
        title="Báo cáo học tập"
        subtitle="Kết quả kiểm tra của học viên, kèm phân loại Good / Average / Redflag."
        extra={
          <Flex gap={8} wrap className="no-print">
            <Select
              showSearch
              value={studentId}
              style={{ width: 280, maxWidth: '100%' }}
              placeholder="Gõ tên hoặc mã học viên"
              optionFilterProp="label"
              loading={list.isLoading}
              options={(list.data ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.code})` }))}
              onChange={(v) => navigate(`/bao-cao/${v}`)}
            />
            <Button icon={<PrinterOutlined />} onClick={() => window.print()} disabled={!exams.length || IN_MEMORY_ROUTER}>
              In báo cáo
            </Button>
          </Flex>
        }
      />

      {profile.isLoading ? (
        <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
      ) : !profile.data ? (
        <Alert type="error" showIcon title="Không tìm thấy học viên này" />
      ) : (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={{ xs: 1, md: 3 }}>
              <Descriptions.Item label="Học viên">{profile.data.student.name}</Descriptions.Item>
              <Descriptions.Item label="Mã">{profile.data.student.code}</Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">{fmtDate(profile.data.student.birthday)}</Descriptions.Item>
              <Descriptions.Item label="Ngưỡng áp dụng" span={3}>
                {profile.data.student.star
                  ? `Ngưỡng riêng (★): Redflag dưới ${profile.data.student.redflagBelow}%, Good trên ${profile.data.student.goodAbove}%`
                  : 'Mặc định: Redflag dưới 60%, Good trên 80%'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {exams.length > 1 && (
            <Card size="small" title="Tiến bộ qua các lần kiểm tra" style={{ marginBottom: 16 }}>
              <Timeline
                items={[...exams].reverse().map((r) => ({
                  color: r.rating === 'good' ? 'green' : r.rating === 'average' ? 'orange' : 'red',
                  children: `${fmtDate(r.result.date)} — ${fmtPercent(r.percent)} (${r.rating})`,
                }))}
              />
            </Card>
          )}

          {exams.length === 0 ? <Empty description="Chưa có kết quả kiểm tra" /> : exams.map((r) => <ResultBlock key={r.result.id} r={r} />)}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Điểm tổng là trung bình phần trăm các tiêu chí; Pronunciation và ngữ pháp được báo cáo riêng.
          </Typography.Text>
        </>
      )}
    </div>
  );
}
