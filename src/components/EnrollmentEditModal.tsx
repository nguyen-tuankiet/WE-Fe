import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, DatePicker, Divider, Flex, Form, Input, InputNumber, Modal, Popconfirm, Switch, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { updateEnrollment, type EnrollmentPatch, type EnrollmentView } from '../api';

interface Values {
  startDate: dayjs.Dayjs;
  totalSessions: number;
  tuition: number;
  tuitionReceived: boolean;
  note: string;
}

const FMT = 'YYYY-MM-DD';

/** Sửa khóa đăng ký: học phí, đã nhận học phí, ghi chú, tổng số buổi, ngày bắt đầu; hoặc kết thúc khóa. */
export function EnrollmentEditModal({ target, onClose }: { target: EnrollmentView | null; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<Values>();
  const e = target?.enrollment;
  const active = e?.status === 'active';

  useEffect(() => {
    if (!target) return;
    form.setFieldsValue({
      startDate: dayjs(target.enrollment.startDate),
      totalSessions: target.progress.total || target.enrollment.totalSessions,
      tuition: target.enrollment.tuition,
      tuitionReceived: target.enrollment.tuitionReceived,
      note: target.enrollment.note,
    });
  }, [target, form]);

  const done = (text: string) => {
    message.success(text);
    onClose();
    qc.invalidateQueries();
  };

  const save = useMutation({
    mutationFn: (v: Values) => {
      const patch: EnrollmentPatch = {};
      if (v.tuition !== e!.tuition) patch.tuition = v.tuition;
      if (v.tuitionReceived !== e!.tuitionReceived) patch.tuitionReceived = v.tuitionReceived;
      if ((v.note ?? '') !== (e!.note ?? '')) patch.note = v.note ?? '';
      if (active) {
        if (dayjs(v.startDate).format(FMT) !== e!.startDate) patch.startDate = dayjs(v.startDate).format(FMT);
        if (v.totalSessions !== (target!.progress.total || e!.totalSessions)) patch.totalSessions = v.totalSessions;
      }
      if (Object.keys(patch).length === 0) throw new Error('Chưa có thay đổi nào.');
      return updateEnrollment(e!.id, patch);
    },
    onSuccess: () => done('Đã cập nhật khóa đăng ký.'),
    onError: (err: Error) => message.error(err.message),
  });

  const finish = useMutation({
    mutationFn: () => updateEnrollment(e!.id, { status: 'completed' }),
    onSuccess: () => done('Đã kết thúc khóa. Lịch sử điểm danh được giữ nguyên.'),
    onError: (err: Error) => message.error(err.message),
  });

  return (
    <Modal
      title="Sửa khóa đăng ký"
      open={!!target}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={save.isPending}
      destroyOnHidden
    >
      {target && (
        <>
          <Typography.Paragraph>
            <b>{target.student.name}</b> · {target.program.name}
            <br />
            <Typography.Text type="secondary">Lớp {target.cls.name} · đã diễn ra {target.progress.held}/{target.progress.total} buổi</Typography.Text>
          </Typography.Paragraph>
          {!active && <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Khóa không còn đang học: chỉ sửa được học phí, trạng thái đã nhận học phí và ghi chú." />}
          <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
            <Form.Item name="tuitionReceived" label="Đã nhận học phí" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="tuition" label="Học phí (₫)" rules={[{ required: true, message: 'Nhập học phí' }]}>
              <InputNumber min={0} step={100000} style={{ width: '100%' }} formatter={(v) => `${v ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(v) => Number(String(v ?? '').replace(/\./g, '')) as 0} />
            </Form.Item>
            <Form.Item name="note" label="Ghi chú">
              <Input.TextArea rows={2} maxLength={500} />
            </Form.Item>
            {active && (
              <>
                <Form.Item name="totalSessions" label="Tổng số buổi" extra={`Không thấp hơn số buổi đã diễn ra hoặc đã điểm danh. Các buổi chưa tới được lập lại; buổi đã qua giữ nguyên.`} rules={[{ required: true, message: 'Nhập số buổi' }]}>
                  <InputNumber min={Math.max(target.progress.held, 1)} max={200} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="startDate" label="Ngày bắt đầu" extra="Chỉ đổi được khi khóa chưa có điểm danh, lượt bù, bảo lưu hay chuyển lớp." rules={[{ required: true, message: 'Chọn ngày' }]}>
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </>
            )}
          </Form>
          {active && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Flex justify="space-between" align="center" gap={12} wrap>
                <Typography.Text type="secondary" style={{ maxWidth: 330 }}>
                  Kết thúc khóa sớm: các buổi chưa tới bị bỏ khỏi lịch, lịch sử điểm danh giữ nguyên. Không kết thúc được khi còn lượt bù đã xếp.
                </Typography.Text>
                <Popconfirm title="Kết thúc khóa này?" description="Thao tác không hoàn tác được từ giao diện." okText="Kết thúc khóa" cancelText="Hủy" okButtonProps={{ danger: true }} onConfirm={() => finish.mutate()}>
                  <Button danger loading={finish.isPending}>
                    Kết thúc khóa
                  </Button>
                </Popconfirm>
              </Flex>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
