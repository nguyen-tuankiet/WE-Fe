import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Collapse, DatePicker, Form, Modal, Select, Table, Tabs, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TODAY, createExamPlan, listEnrollments, listExams, type ExamResultView, type PlanView } from '../api';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { RatingTag } from '../components/StatusTag';
import { CURRICULUM } from '../mock/catalog';
import { fmtDate, fmtPercent } from '../i18n/vi';
import type { UnitTemplate } from '../domain/types';

const TEMPLATE_LABEL: Record<UnitTemplate, string> = {
  baby: 'Baby — Spelling & Writing',
  foundation: 'Foundation — Vocabulary, Communication, Pronunciation',
  cambridge: 'Cambridge — Pattern, Freestyle, Pronunciation, ngữ pháp',
};

export function AcademicsPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['exams'], queryFn: listExams });
  const enrollments = useQuery({ queryKey: ['enrollments'], queryFn: listEnrollments });
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const enrollmentId = Form.useWatch('enrollmentId', form) as string | undefined;

  const selected = enrollments.data?.find((e) => e.enrollment.id === enrollmentId);
  const template = selected?.program.unitTemplate ?? null;

  const create = useMutation({
    mutationFn: (v: { enrollmentId: string; date: dayjs.Dayjs; unitIds: string[] }) =>
      createExamPlan(v.enrollmentId, dayjs(v.date).format('YYYY-MM-DD'), v.unitIds),
    onSuccess: () => {
      message.success('Đã thêm vào danh sách chờ chấm.');
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const pending = (q.data?.plans ?? []).filter((p) => p.plan.status === 'pending');

  return (
    <div className="fade-in">
      <PageHeader
        title="Học vụ & Kiểm tra"
        subtitle="Lên lịch kiểm tra theo học viên và khóa, chấm nhiều Unit trong một phiếu."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setOpen(true); form.resetFields(); }}>
            Lên lịch kiểm tra
          </Button>
        }
      />
      <Tabs
        items={[
          {
            key: 'pending',
            label: `Lịch chờ chấm (${pending.length})`,
            children: (
              <Table<PlanView>
                rowKey={(r) => r.plan.id}
                loading={q.isLoading}
                dataSource={pending}
                pagination={TABLE_PAGINATION}
                scroll={{ x: 760 }}
                locale={{ emptyText: 'Không có lịch kiểm tra chờ chấm' }}
                columns={[
                  { title: 'Ngày dự kiến', render: (_, r) => fmtDate(r.plan.plannedDate) },
                  { title: 'Học viên', render: (_, r) => <Link to={`/hoc-vien/${r.view.student.id}`}>{r.view.student.name}</Link> },
                  { title: 'Khóa', render: (_, r) => r.view.program.name },
                  { title: 'Unit', render: (_, r) => r.units.map((u) => <Tag key={u.id}>{u.name} · {u.topic}</Tag>) },
                  { title: '', render: (_, r) => <Button type="primary" size="small" onClick={() => navigate(`/hoc-vu/cham/${r.plan.id}`)}>Chấm</Button> },
                ]}
              />
            ),
          },
          {
            key: 'done',
            label: 'Kết quả đã chấm',
            children: (
              <Table<ExamResultView>
                rowKey={(r) => r.result.id}
                loading={q.isLoading}
                dataSource={q.data?.results ?? []}
                pagination={TABLE_PAGINATION}
                scroll={{ x: 760 }}
                columns={[
                  { title: 'Ngày', render: (_, r) => fmtDate(r.result.date) },
                  { title: 'Học viên', render: (_, r) => r.view.student.name },
                  { title: 'Khóa', render: (_, r) => r.view.program.name },
                  { title: 'Số Unit', render: (_, r) => r.result.units.length },
                  { title: 'Điểm tổng', render: (_, r) => fmtPercent(r.percent) },
                  { title: 'Phân loại', render: (_, r) => <RatingTag rating={r.rating} /> },
                  {
                    title: '',
                    render: (_, r) => (
                      <>
                        <Link to={`/hoc-vu/cham/${r.result.planId}`}>Mở lại</Link> · <Link to={`/bao-cao?hv=${r.view.student.id}`}>Báo cáo</Link>
                      </>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: 'curriculum',
            label: 'Khung chương trình',
            children: (
              <>
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  title="Nội dung mẫu để xem trước giao diện"
                  description="Nội dung kiểm tra thật do bộ phận học vụ cung cấp. Chương trình chưa có nội dung sẽ không cho chấm; hệ thống không điền nội dung giả."
                />
                <Collapse
                  items={(Object.keys(CURRICULUM) as UnitTemplate[]).map((t) => ({
                    key: t,
                    label: TEMPLATE_LABEL[t],
                    children: (
                      <Table
                        size="small"
                        rowKey="id"
                        pagination={false}
                        dataSource={CURRICULUM[t]}
                        columns={[
                          { title: 'Unit', dataIndex: 'name', width: 90 },
                          { title: 'Chủ đề', dataIndex: 'topic' },
                          { title: 'Từ vựng', render: (_, u) => `${u.words.length} từ: ${u.words.join(', ')}` },
                          { title: 'Mẫu câu', render: (_, u) => u.patterns.join(' · ') },
                        ]}
                      />
                    ),
                  }))}
                />
              </>
            ),
          },
        ]}
      />

      <Modal
        title="Lên lịch kiểm tra"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Thêm vào danh sách chờ"
        cancelText="Hủy"
        confirmLoading={create.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)}>
          <Form.Item name="enrollmentId" label="Học viên (qua khóa đang học)" rules={[{ required: true, message: 'Chọn học viên' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={(enrollments.data ?? [])
                .filter((e) => e.enrollment.status === 'active')
                .map((e) => ({ value: e.enrollment.id, label: `${e.student.name} — ${e.program.name}`, disabled: !e.program.unitTemplate }))}
              placeholder="Chọn học viên"
            />
          </Form.Item>
          {selected && !template && <Alert type="error" showIcon style={{ marginBottom: 12 }} title="Chương trình này chưa có nội dung kiểm tra." />}
          <Form.Item name="date" label="Ngày dự kiến" rules={[{ required: true, message: 'Chọn ngày' }]} initialValue={dayjs(TODAY).add(1, 'day')}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unitIds" label="Các Unit cần kiểm tra" rules={[{ required: true, message: 'Chọn ít nhất một Unit' }]}>
            <Select mode="multiple" disabled={!template} options={(template ? CURRICULUM[template] : []).map((u) => ({ value: u.id, label: `${u.name} · ${u.topic}` }))} placeholder="Chọn một hoặc nhiều Unit" />
          </Form.Item>
        </Form>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Khi chấm phải đủ mọi Unit đã chọn mới hoàn tất lịch.</Typography.Text>
      </Modal>
    </div>
  );
}
