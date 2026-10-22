import { CheckCircleFilled, CloseCircleFilled, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, DatePicker, Flex, Form, Input, InputNumber, Modal, Row, Select, Statistic, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TODAY, createReserve, listClasses, listEnrollments, listReserves, markReturned, type ReserveView } from '../api';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { RESERVE_STATUS_COLOR, RESERVE_STATUS_LABEL, fmtDate, fmtMoney } from '../i18n/vi';

const Check = ({ ok, children }: { ok: boolean; children: React.ReactNode }) => (
  <div style={{ color: ok ? '#2e8b57' : '#d84315' }}>
    {ok ? <CheckCircleFilled /> : <CloseCircleFilled />} {children}
  </div>
);

export function ReservePage() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const reserves = useQuery({ queryKey: ['reserves'], queryFn: listReserves });
  const enrollments = useQuery({ queryKey: ['enrollments'], queryFn: listEnrollments });
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const [createOpen, setCreateOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<ReserveView | null>(null);
  const [form] = Form.useForm();
  const [returnForm] = Form.useForm();
  const watchStreak = Form.useWatch('absentStreak', form) as number | undefined;
  const watchNotice = Form.useWatch('noticeAt', form) as dayjs.Dayjs | undefined;
  const watchDone = Form.useWatch('completedOn', form) as dayjs.Dayjs | undefined;
  const watchEnroll = Form.useWatch('enrollmentId', form) as string | undefined;

  const done = (msg: string) => {
    message.success(msg);
    qc.invalidateQueries();
  };
  const create = useMutation({
    mutationFn: createReserve,
    onSuccess: () => {
      done('Đã tạo hồ sơ bảo lưu. Lịch chính của khóa tạm dừng từ ngày hoàn tất thủ tục.');
      setCreateOpen(false);
    },
    onError: (e: Error) => message.error(e.message),
  });
  const back = useMutation({
    mutationFn: ({ id, classId, date }: { id: string; classId: string; date: string }) => markReturned(id, classId, date),
    onSuccess: () => {
      done('Đã ghi nhận nhập học lại. Lịch tính tiếp theo số buổi còn lại.');
      setReturnTarget(null);
    },
  });

  const rows = reserves.data ?? [];
  const hoursNotice = watchNotice && watchDone ? watchDone.diff(watchNotice, 'hour') : null;
  const alreadyReserved = !!watchEnroll && rows.some((r) => r.reserve.enrollmentId === watchEnroll);
  const eligible = (enrollments.data ?? []).filter((e) => e.enrollment.status === 'active');

  return (
    <div className="fade-in">
      <PageHeader
        title="Bảo lưu học phí"
        subtitle="Bảo lưu là thủ tục có điều kiện và thời hạn; chỉ bảo lưu học phí của phần chưa diễn ra."
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); form.resetFields(); }}>
            Tạo bảo lưu
          </Button>
        }
      />
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={8}><Card size="small"><Statistic title="Đang bảo lưu" value={rows.filter((r) => r.reserve.status === 'active').length} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="Sắp hết hạn (≤ 30 ngày)" value={rows.filter((r) => r.reserve.status === 'active' && r.daysLeft <= 30).length} styles={{ content: { color: '#fa8c18' } }} /></Card></Col>
        <Col xs={8}><Card size="small"><Statistic title="Hết hạn" value={rows.filter((r) => r.reserve.status === 'expired').length} styles={{ content: { color: '#d84315' } }} /></Card></Col>
      </Row>

      <Table<ReserveView>
        rowKey={(r) => r.reserve.id}
        loading={reserves.isLoading}
        dataSource={rows}
        pagination={TABLE_PAGINATION}
        scroll={{ x: 1000 }}
        columns={[
          { title: 'Học viên', render: (_, r) => <Link to={`/hoc-vien/${r.view.student.id}`}>{r.view.student.name}</Link> },
          { title: 'Chương trình', render: (_, r) => r.view.program.name },
          { title: 'Hoàn tất thủ tục', render: (_, r) => fmtDate(r.reserve.completedOn) },
          {
            title: 'Hạn (2 tháng)',
            render: (_, r) =>
              r.reserve.status === 'active' ? (
                <span>
                  {fmtDate(r.expiresOn)} <Tag color={r.daysLeft <= 14 ? 'error' : r.daysLeft <= 30 ? 'warning' : 'default'}>còn {r.daysLeft} ngày</Tag>
                </span>
              ) : (
                fmtDate(r.expiresOn)
              ),
          },
          { title: 'Buổi còn lại', render: (_, r) => r.reserve.remainingSessions },
          { title: 'Giá trị bảo lưu', render: (_, r) => fmtMoney(r.reserve.amount), align: 'right' },
          { title: 'Trạng thái', render: (_, r) => <Tag color={RESERVE_STATUS_COLOR[r.reserve.status]}>{RESERVE_STATUS_LABEL[r.reserve.status]}</Tag> },
          {
            title: '',
            render: (_, r) =>
              r.reserve.status === 'active' ? (
                <Button size="small" onClick={() => { setReturnTarget(r); returnForm.resetFields(); }}>Nhập học lại</Button>
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.reserve.note}</Typography.Text>
              ),
          },
        ]}
      />

      <Modal
        title="Tạo bảo lưu"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        okText="Tạo hồ sơ bảo lưu"
        cancelText="Hủy"
        confirmLoading={create.isPending}
        width={560}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) =>
            create.mutate({
              enrollmentId: v.enrollmentId,
              completedOn: dayjs(v.completedOn).format('YYYY-MM-DD'),
              noticeAt: dayjs(v.noticeAt).format('YYYY-MM-DDTHH:mm'),
              absentStreak: v.absentStreak,
              amount: v.amount,
              note: v.note ?? '',
            })
          }
        >
          <Form.Item name="enrollmentId" label="Khóa đăng ký" rules={[{ required: true, message: 'Chọn khóa' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={eligible.map((e) => ({ value: e.enrollment.id, label: `${e.student.name} — ${e.program.name}` }))}
              placeholder="Chọn học viên / khóa đang học"
            />
          </Form.Item>
          <Flex gap={12} wrap>
            <Form.Item name="absentStreak" label="Số buổi nghỉ liên tục dự kiến" rules={[{ required: true, message: 'Nhập số buổi' }]} style={{ flex: 1, minWidth: 200 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="amount" label="Giá trị bảo lưu (₫)" rules={[{ required: true, message: 'Nhập số tiền' }]} style={{ flex: 1, minWidth: 200 }}>
              <InputNumber min={0} step={100000} style={{ width: '100%' }} />
            </Form.Item>
          </Flex>
          <Flex gap={12} wrap>
            <Form.Item name="noticeAt" label="Thời điểm thông báo" rules={[{ required: true, message: 'Chọn thời điểm' }]} style={{ flex: 1, minWidth: 200 }}>
              <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="completedOn" label="Ngày hoàn tất thủ tục" rules={[{ required: true, message: 'Chọn ngày' }]} initialValue={dayjs(TODAY)} style={{ flex: 1, minWidth: 200 }}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Flex>
          <Form.Item name="note" label="Lý do / ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Alert
            type="warning"
            showIcon
            title="Kiểm tra điều kiện theo chính sách"
            description={
              <>
                <Check ok={(watchStreak ?? 0) >= 10}>Nghỉ liên tục từ 10 buổi trở lên</Check>
                <Check ok={hoursNotice !== null && hoursNotice >= 48}>Thông báo trước ít nhất 48 giờ{hoursNotice !== null ? ` (hiện ${hoursNotice} giờ)` : ''}</Check>
                <Check ok={!alreadyReserved}>Chưa bảo lưu lần nào cho khóa này (chỉ 1 lần)</Check>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Hiệu lực 2 tháng từ ngày hoàn tất; không bảo lưu ưu đãi; không hoàn tiền. Hệ thống sẽ chặn nếu chưa đủ điều kiện.
                </Typography.Text>
              </>
            }
          />
        </Form>
      </Modal>

      <Modal
        title="Nhập học lại"
        open={!!returnTarget}
        onCancel={() => setReturnTarget(null)}
        onOk={() => returnForm.submit()}
        okText="Xác nhận quay lại"
        cancelText="Hủy"
        confirmLoading={back.isPending}
        destroyOnHidden
      >
        {returnTarget && (
          <Form
            form={returnForm}
            layout="vertical"
            initialValues={{ classId: returnTarget.view.cls.id, date: dayjs(TODAY) }}
            onFinish={(v) => back.mutate({ id: returnTarget.reserve.id, classId: v.classId, date: dayjs(v.date).format('YYYY-MM-DD') })}
          >
            <Typography.Paragraph>
              <b>{returnTarget.view.student.name}</b> · còn {returnTarget.reserve.remainingSessions} buổi · giá trị {fmtMoney(returnTarget.reserve.amount)}
            </Typography.Paragraph>
            <Form.Item name="date" label="Ngày quay lại" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs(returnTarget.expiresOn))} />
            </Form.Item>
            <Form.Item name="classId" label="Lớp được xếp" rules={[{ required: true }]}>
              <Select options={(classes.data ?? []).filter((c) => c.active).map((c) => ({ value: c.id, label: `${c.name} · ${c.teacherName}` }))} />
            </Form.Item>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Học lại từ đầu hay tiếp tục phần còn lại, và cách dùng tiền bảo lưu, đang chờ xác nhận (docs/08 #1). Bản xem trước mặc định tiếp tục số buổi còn lại.
            </Typography.Text>
          </Form>
        )}
      </Modal>
    </div>
  );
}
