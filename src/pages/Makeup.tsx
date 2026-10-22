import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Checkbox, DatePicker, Descriptions, Flex, Form, Input, Modal, Select, Table, Tabs, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listMakeups, scheduleMakeup, setMakeupStatus, type MakeupView, type PendingMakeup } from '../api';
import { useUser } from '../auth/AuthContext';
import { isManagement } from '../auth/permissions';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { ROOMS } from '../mock/db';
import { MAKEUP_STATUS_COLOR, MAKEUP_STATUS_LABEL, fmtDate } from '../i18n/vi';
import type { MakeupStatus } from '../domain/types';

export function MakeupPage() {
  const user = useUser();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const manage = isManagement(user.roles);
  const q = useQuery({ queryKey: ['makeups'], queryFn: listMakeups });
  const [target, setTarget] = useState<PendingMakeup | null>(null);
  const [cancelTarget, setCancelTarget] = useState<MakeupView | null>(null);
  const [form] = Form.useForm();
  const [cancelForm] = Form.useForm();

  const schedule = useMutation({
    mutationFn: scheduleMakeup,
    onSuccess: () => {
      message.success('Đã xếp lịch bù.');
      setTarget(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: MakeupStatus; note: string }) => setMakeupStatus(id, status, note),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái buổi bù.');
      setCancelTarget(null);
      cancelForm.resetFields();
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  const pending = q.data?.pending ?? [];
  const list = q.data?.list ?? [];

  return (
    <div className="fade-in">
      <PageHeader title="Học bù" subtitle="Mỗi lượt bù gắn với một buổi vắng đã báo nghỉ, trong định mức của khóa." />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Chính sách học bù"
        description={
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Baby Stars & Kids Foundation: tối đa <b>5 lượt/khóa</b>, mỗi lượt <b>30 phút</b>, sau giờ chính, vào cuối khóa.</li>
            <li>Các level khác: tối đa <b>2 lượt/khóa</b>, mỗi lượt <b>90 phút</b>, vào cuối khóa.</li>
            <li>Nghỉ không thông báo thì không xếp bù miễn phí. Vắng buổi bù đã xếp & đã thông báo → tính <b>đã dùng lượt</b>, không xếp lại.</li>
          </ul>
        }
      />
      <Tabs
        items={[
          {
            key: 'pending',
            label: `Chờ xếp (${pending.length})`,
            children: (
              <Table<PendingMakeup>
                rowKey={(r) => `${r.view.enrollment.id}|${r.absenceDate}`}
                loading={q.isLoading}
                dataSource={pending}
                pagination={TABLE_PAGINATION}
                scroll={{ x: 760 }}
                locale={{ emptyText: 'Không có buổi vắng nào đủ điều kiện chờ xếp bù' }}
                columns={[
                  { title: 'Học viên', render: (_, r) => <Link to={`/hoc-vien/${r.view.student.id}`}>{r.view.student.name}</Link> },
                  { title: 'Chương trình', render: (_, r) => r.view.program.name },
                  { title: 'Buổi vắng (đã báo)', render: (_, r) => fmtDate(r.absenceDate) },
                  { title: 'Lượt đã dùng', render: (_, r) => `${r.view.makeupUsed}/${r.view.quota?.maxCount}` },
                  { title: 'Thời lượng đề xuất', render: (_, r) => `${r.view.quota?.minutes} phút` },
                  {
                    title: '',
                    render: (_, r) =>
                      manage ? (
                        <Button type="primary" size="small" onClick={() => { setTarget(r); form.resetFields(); }}>
                          Xếp bù
                        </Button>
                      ) : null,
                  },
                ]}
              />
            ),
          },
          {
            key: 'list',
            label: `Lượt bù (${list.length})`,
            children: (
              <Table<MakeupView>
                rowKey={(r) => r.makeup.id}
                loading={q.isLoading}
                dataSource={list}
                pagination={TABLE_PAGINATION}
                scroll={{ x: 900 }}
                columns={[
                  { title: 'Học viên', render: (_, r) => <Link to={`/hoc-vien/${r.view.student.id}`}>{r.view.student.name}</Link> },
                  { title: 'Chương trình', render: (_, r) => r.view.program.name },
                  { title: 'Bù cho buổi vắng', render: (_, r) => fmtDate(r.makeup.absenceDate) },
                  { title: 'Ngày bù', render: (_, r) => fmtDate(r.makeup.date) },
                  { title: 'Thời lượng', render: (_, r) => `${r.makeup.minutes} phút` },
                  { title: 'Đã báo phụ huynh', render: (_, r) => (r.makeup.notifiedParent ? <Tag color="success">Đã báo</Tag> : <Tag color="warning">Chưa báo</Tag>) },
                  { title: 'Trạng thái', render: (_, r) => <Tag color={MAKEUP_STATUS_COLOR[r.makeup.status]}>{MAKEUP_STATUS_LABEL[r.makeup.status]}</Tag> },
                  {
                    title: 'Xử lý',
                    render: (_, r) =>
                      manage && r.makeup.status === 'scheduled' ? (
                        <Flex gap={6} wrap>
                          <Button size="small" onClick={() => setStatus.mutate({ id: r.makeup.id, status: 'done', note: '' })}>Hoàn tất</Button>
                          <Button size="small" danger onClick={() => setStatus.mutate({ id: r.makeup.id, status: 'missed', note: 'Vắng buổi bù đã thông báo' })}>Vắng bù</Button>
                          <Button size="small" onClick={() => setCancelTarget(r)}>Hủy</Button>
                        </Flex>
                      ) : (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.makeup.note}</Typography.Text>
                      ),
                  },
                ]}
              />
            ),
          },
        ]}
      />

      <Modal
        title="Xếp lịch học bù"
        open={!!target}
        onCancel={() => setTarget(null)}
        onOk={() => form.submit()}
        okText="Xếp bù"
        cancelText="Hủy"
        confirmLoading={schedule.isPending}
        destroyOnHidden
      >
        {target && (
          <>
            <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
              <Descriptions.Item label="Học viên">{target.view.student.name}</Descriptions.Item>
              <Descriptions.Item label="Bù cho buổi vắng">{fmtDate(target.absenceDate)}</Descriptions.Item>
              <Descriptions.Item label="Thời lượng">{target.view.quota?.minutes} phút</Descriptions.Item>
              <Descriptions.Item label="Kết thúc buổi chính">{fmtDate(target.view.progress.endDate)}</Descriptions.Item>
            </Descriptions>
            <Form
              form={form}
              layout="vertical"
              onFinish={(v) =>
                schedule.mutate({
                  enrollmentId: target.view.enrollment.id,
                  absenceDate: target.absenceDate,
                  date: dayjs(v.date).format('YYYY-MM-DD'),
                  room: v.room,
                  notifiedParent: !!v.notifiedParent,
                  note: v.note ?? '',
                })
              }
            >
              <Form.Item name="date" label="Ngày bù" rules={[{ required: true, message: 'Chọn ngày bù' }]} extra="Bù thực hiện vào cuối khóa, sau ngày kết thúc buổi chính.">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs(target.view.progress.endDate ?? undefined))} />
              </Form.Item>
              <Form.Item name="room" label="Phòng" rules={[{ required: true, message: 'Chọn phòng' }]} initialValue={target.view.cls.room}>
                <Select options={ROOMS.map((r) => ({ value: r.id, label: `${r.floor} · ${r.id}` }))} />
              </Form.Item>
              <Form.Item name="notifiedParent" valuePropName="checked">
                <Checkbox>Đã thông báo lịch bù cho học viên/phụ huynh</Checkbox>
              </Form.Item>
              <Form.Item name="note" label="Ghi chú">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        title="Hủy lịch bù"
        open={!!cancelTarget}
        onCancel={() => setCancelTarget(null)}
        onOk={() => cancelForm.submit()}
        okText="Xác nhận hủy"
        okButtonProps={{ danger: true }}
        cancelText="Không"
        destroyOnHidden
      >
        <Form form={cancelForm} layout="vertical" onFinish={(v) => cancelTarget && setStatus.mutate({ id: cancelTarget.makeup.id, status: 'cancelled', note: v.reason })}>
          <Form.Item name="reason" label="Lý do hủy" rules={[{ required: true, message: 'Cần ghi lý do hủy lịch bù' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Quyền xếp lại sau khi hủy chưa được chốt (docs/08 #4); bản xem trước tạm không tính lượt đã hủy vào định mức.
          </Typography.Text>
        </Form>
      </Modal>
    </div>
  );
}
