import { ArrowLeftOutlined, CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, Collapse, Flex, Input, InputNumber, Progress, Radio, Row, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExamPlan, saveExam } from '../api';
import { useUser } from '../auth/AuthContext';
import { RatingTag } from '../components/StatusTag';
import { CRITERIA, isUnitComplete, summarize, thresholdsFor, type Criterion } from '../domain/grading';
import type { UnitContent, UnitScore } from '../domain/types';
import { fmtDate, fmtPercent } from '../i18n/vi';

type Values = Record<string, UnitScore['values']>;

function UnitFields({
  template,
  unit,
  values,
  disabled,
  onChange,
}: {
  template: keyof typeof CRITERIA;
  unit: UnitContent;
  values: UnitScore['values'];
  disabled: boolean;
  onChange: (key: string, v: number | string | null) => void;
}) {
  const total = unit.words.length;
  return (
    <Flex vertical gap={14}>
      <div>
        <Typography.Text type="secondary">Từ vựng ({total}): </Typography.Text>
        {unit.words.map((w) => (
          <Tag key={w}>{w}</Tag>
        ))}
        <div style={{ marginTop: 4 }}>
          <Typography.Text type="secondary">Mẫu câu: </Typography.Text>
          {unit.patterns.join(' · ')}
        </div>
      </div>
      <Row gutter={[16, 12]}>
        {CRITERIA[template].map((c: Criterion) => {
          const v = values[c.key];
          const isVocab = template === 'foundation' && c.key === 'vocabulary';
          return (
            <Col key={c.key} xs={24} md={12}>
              <div style={{ marginBottom: 4, fontWeight: 600 }}>
                {c.label}
                {c.reportOnly && <Typography.Text type="secondary" style={{ fontWeight: 400 }}> · báo cáo riêng</Typography.Text>}
              </div>
              {c.kind === 'score' ? (
                isVocab ? (
                  <Flex align="center" gap={8}>
                    <InputNumber
                      min={0}
                      max={total}
                      disabled={disabled}
                      value={v === null || v === undefined ? null : Math.round((Number(v) * total) / 100)}
                      onChange={(n) => onChange(c.key, n === null ? null : (n / total) * 100)}
                    />
                    <span>/ {total} từ</span>
                    {v !== null && v !== undefined && <Tag>{fmtPercent(Number(v))}</Tag>}
                  </Flex>
                ) : (
                  <InputNumber min={0} max={100} disabled={disabled} value={v === undefined ? null : (v as number | null)} onChange={(n) => onChange(c.key, n)} addonAfter="/ 100" />
                )
              ) : (
                <Radio.Group
                  optionType="button"
                  disabled={disabled}
                  value={v ?? null}
                  onChange={(e) => onChange(c.key, e.target.value)}
                  options={c.options}
                />
              )}
            </Col>
          );
        })}
      </Row>
    </Flex>
  );
}

export function GradingPage() {
  const { planId = '' } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['plan', planId], queryFn: () => getExamPlan(planId) });
  const [values, setValues] = useState<Values>({});
  const [comment, setComment] = useState('');
  const [support, setSupport] = useState('');
  const [active, setActive] = useState<string[]>([]);

  useEffect(() => {
    if (!q.data) return;
    const init: Values = {};
    q.data.units.forEach((u) => {
      init[u.id] = q.data.existing?.units.find((x) => x.unitId === u.id)?.values ?? {};
    });
    setValues(init);
    setComment(q.data.existing?.comment ?? '');
    setSupport(q.data.existing?.support ?? '');
    setActive(q.data.units[0] ? [q.data.units[0].id] : []);
  }, [q.data]);

  const template = q.data?.template ?? null;
  const unitScores: UnitScore[] = useMemo(
    () => (q.data?.units ?? []).map((u) => ({ unitId: u.id, values: values[u.id] ?? {} })),
    [q.data, values],
  );
  const thresholds = thresholdsFor(q.data?.view.student);
  const summary = template ? summarize(template, unitScores, thresholds) : null;
  const complete = !!template && unitScores.length > 0 && unitScores.every((u) => isUnitComplete(template, u));
  const started = unitScores.some((u) => Object.values(u.values).some((v) => v !== undefined && v !== null));

  const save = useMutation({
    mutationFn: () => saveExam({ planId, units: unitScores, comment, support, examiner: user.name }),
    onSuccess: () => {
      message.success('Đã lưu kết quả và chuyển lịch sang Hoàn tất.');
      qc.invalidateQueries();
      navigate('/hoc-vu');
    },
    onError: (e: Error) => message.error(e.message),
  });

  if (!q.data) return <Card loading />;
  const { view, units, existing } = q.data;
  if (!template) return <Alert type="error" showIcon title="Chương trình này chưa có nội dung kiểm tra, không thể chấm." />;

  return (
    <div className="fade-in">
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/hoc-vu')} style={{ paddingLeft: 0 }}>
        Học vụ & Kiểm tra
      </Button>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        Phiếu kiểm tra · {view.student.name}
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        {view.program.name} · dự kiến {fmtDate(q.data.plan.plannedDate)} · {units.length} Unit
        {existing && ` · đã chấm ${fmtDate(existing.date)} bởi ${existing.examiner} (lưu lại sẽ cập nhật, không tạo kết quả trùng)`}
      </Typography.Paragraph>
      {view.student.star && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`Học viên có dấu sao: Redflag dưới ${thresholds.redflagBelow}%, Good trên ${thresholds.goodAbove}%. Điểm gốc vẫn được giữ.`}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Collapse
            activeKey={active}
            onChange={(k) => setActive(k as string[])}
            items={units.map((u) => {
              const ok = isUnitComplete(template, { unitId: u.id, values: values[u.id] ?? {} });
              return {
                key: u.id,
                forceRender: true,
                style: ok ? { background: '#f0faf3' } : undefined,
                label: (
                  <Flex gap={8} align="center">
                    <strong>{u.name}</strong>
                    <span>{u.topic}</span>
                    {ok ? (
                      <Tag color="success" icon={<CheckCircleFilled />}>Hoàn tất</Tag>
                    ) : (
                      <Tag color="warning" icon={<ExclamationCircleFilled />}>Thiếu trường bắt buộc</Tag>
                    )}
                  </Flex>
                ),
                children: (
                  <UnitFields
                    template={template}
                    unit={u}
                    values={values[u.id] ?? {}}
                    disabled={false}
                    onChange={(k, v) => setValues((s) => ({ ...s, [u.id]: { ...s[u.id], [k]: v } }))}
                  />
                ),
              };
            })}
          />
          <Card size="small" style={{ marginTop: 16 }} title="Nhận xét & hướng hỗ trợ">
            <Flex vertical gap={12}>
              <Input.TextArea rows={3} placeholder="Nhận xét" value={comment} onChange={(e) => setComment(e.target.value)} />
              <Input.TextArea rows={2} placeholder="Hướng hỗ trợ học viên" value={support} onChange={(e) => setSupport(e.target.value)} />
            </Flex>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Kết quả tạm tính" style={{ position: 'sticky', top: 12 }}>
            {summary && (
              <Flex vertical gap={12}>
                {summary.perCriterion.map((c) => {
                  const entered = unitScores.some((u) => u.values[c.key] !== undefined && u.values[c.key] !== null);
                  return (
                    <div key={c.key}>
                      <Flex justify="space-between">
                        <span>{c.label}</span>
                        {entered ? <RatingTag rating={c.rating} /> : <Tag>Chưa nhập</Tag>}
                      </Flex>
                      <Progress percent={Math.round(c.percent)} size="small" status={entered && c.rating === 'redflag' ? 'exception' : 'normal'} />
                    </div>
                  );
                })}
                <Flex justify="space-between" align="center" style={{ borderTop: '1px solid #eee', paddingTop: 12 }}>
                  <div>
                    <div style={{ color: '#7b8499', fontSize: 12 }}>Điểm tổng</div>
                    <strong style={{ fontSize: 22 }}>{started ? fmtPercent(summary.percent) : '—'}</strong>
                  </div>
                  {started ? <RatingTag rating={summary.overall} /> : <Tag>Chưa có điểm</Tag>}
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Có tiêu chí Redflag thì kết quả chung là Redflag; nếu không, trên {thresholds.goodAbove}% là Good.
                </Typography.Text>
                <Tooltip title={complete ? '' : 'Cần chấm đủ mọi trường bắt buộc của tất cả Unit'}>
                  <Button type="primary" size="large" block disabled={!complete} loading={save.isPending} onClick={() => save.mutate()}>
                    Lưu & hoàn tất
                  </Button>
                </Tooltip>
              </Flex>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
