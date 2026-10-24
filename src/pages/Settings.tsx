import { DownloadOutlined, InboxOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, DatePicker, Flex, Form, Input, InputNumber, Modal, Popconfirm, Switch, Table, Tabs, Tag, Typography, Upload } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { addHoliday, getConfig, importStudentsCsv, listHolidays, listStaff, listStudents, removeHoliday, setConfig, setStaffActive, type ImportReport } from '../api';
import { useUser } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { StaffModal } from '../components/StaffModal';
import type { Staff as StaffMember } from '../domain/types';
import { ROLE_LABEL, fmtDate } from '../i18n/vi';

function Staff({ admin }: { admin: boolean }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['staff'], queryFn: listStaff, enabled: admin });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setStaffActive(id, active),
    onSuccess: (s) => {
      message.success(s.active ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản và thu hồi phiên đăng nhập. Lịch sử thao tác vẫn được giữ.');
      qc.invalidateQueries();
    },
  });
  const [modal, setModal] = useState<{ open: boolean; editing: StaffMember | null }>({ open: false, editing: null });
  if (!admin) return <Alert type="info" showIcon title="Chỉ Admin được quản lý tài khoản và vai trò." />;
  return (
    <>
    <Flex justify="flex-end" style={{ marginBottom: 12 }}>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal({ open: true, editing: null })}>Thêm nhân sự</Button>
    </Flex>
    <StaffModal open={modal.open} editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />
    <Table
      rowKey="id"
      loading={q.isLoading}
      dataSource={q.data}
      pagination={false}
      scroll={{ x: 640 }}
      columns={[
        { title: 'Họ tên', dataIndex: 'name' },
        { title: 'Email', dataIndex: 'email' },
        { title: 'Ngày sinh', width: 120, render: (_: unknown, s: StaffMember) => fmtDate(s.birthday) },
        { title: 'Vai trò', render: (_, s) => s.roles.map((r: keyof typeof ROLE_LABEL) => <Tag key={r} color="blue">{ROLE_LABEL[r]}</Tag>) },
        {
          title: 'Hoạt động',
          render: (_, s) => (
            <Popconfirm
              title={s.active ? 'Khóa tài khoản này?' : 'Mở khóa tài khoản này?'}
              description={s.active ? 'Phiên đăng nhập hiện tại sẽ bị thu hồi.' : undefined}
              okText="Xác nhận"
              cancelText="Hủy"
              onConfirm={() => toggle.mutate({ id: s.id, active: !s.active })}
            >
              <Switch checked={s.active} />
            </Popconfirm>
          ),
        },
        { title: '', width: 70, render: (_, s) => <Button size="small" onClick={() => setModal({ open: true, editing: s })}>Sửa</Button> },
      ]}
    />
    </>
  );
}

function Holidays() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['holidays'], queryFn: listHolidays });
  const [form] = Form.useForm();
  const add = useMutation({
    mutationFn: (v: { date: dayjs.Dayjs; reason: string }) => addHoliday({ date: dayjs(v.date).format('YYYY-MM-DD'), reason: v.reason }),
    onSuccess: () => {
      message.success('Đã ghi nhận ngày nghỉ. Các khóa có buổi rơi vào ngày này được dời đủ số buổi; không tính là vắng và không mất lượt bù.');
      form.resetFields();
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });
  const remove = useMutation({
    mutationFn: removeHoliday,
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <>
      <Form form={form} layout="inline" onFinish={(v) => add.mutate(v)} style={{ marginBottom: 16, rowGap: 8 }}>
        <Form.Item name="date" rules={[{ required: true, message: 'Chọn ngày' }]}>
          <DatePicker format="DD/MM/YYYY" placeholder="Ngày nghỉ" />
        </Form.Item>
        <Form.Item name="reason" rules={[{ required: true, message: 'Nhập lý do' }]}>
          <Input placeholder="Lý do" style={{ width: 240 }} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={add.isPending}>Thêm ngày nghỉ</Button>
      </Form>
      <Table
        rowKey="date"
        loading={q.isLoading}
        dataSource={q.data}
        pagination={false}
        columns={[
          { title: 'Ngày', render: (_, h) => fmtDate(h.date), width: 140 },
          { title: 'Lý do', dataIndex: 'reason' },
          { title: '', width: 90, render: (_, h) => <Popconfirm title="Xóa ngày nghỉ này?" okText="Xóa" cancelText="Hủy" onConfirm={() => remove.mutate(h.date)}><Button size="small" danger>Xóa</Button></Popconfirm> },
        ]}
      />
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
        Bản đầu chỉ có ngày nghỉ chung toàn trung tâm; nghỉ riêng từng lớp cần chốt thêm (docs/08 #7).
      </Typography.Text>
    </>
  );
}

function Config() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const save = useMutation({
    mutationFn: setConfig,
    onSuccess: () => {
      message.success('Đã lưu cấu hình.');
      qc.invalidateQueries();
    },
  });
  if (!q.data) return null;
  return (
    <Form layout="vertical" initialValues={q.data} onFinish={(v) => save.mutate(v)} style={{ maxWidth: 420 }}>
      <Form.Item name="reminderDays" label="Cửa sổ nhắc việc (ngày)" rules={[{ required: true }]}>
        <InputNumber min={7} max={90} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="teacherEditDays" label="Giáo viên được sửa điểm danh trong (ngày)" extra="Đang là cấu hình tạm — chờ xác nhận 3 ngày hay trong ngày (docs/08 #6).">
        <InputNumber min={0} max={30} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="redflagBelow" label="Ngưỡng Redflag mặc định (dưới %)">
        <InputNumber min={0} max={100} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="goodAbove" label="Ngưỡng Good mặc định (trên %)">
        <InputNumber min={0} max={100} style={{ width: '100%' }} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={save.isPending}>Lưu cấu hình</Button>
    </Form>
  );
}

function DataTools() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const students = useQuery({ queryKey: ['students'], queryFn: listStudents });
  const [pending, setPending] = useState<{ csv: string; report: ImportReport } | null>(null);

  /** Bước 1: chạy thử (không ghi) để đối chiếu; bước 2: xác nhận mới ghi. */
  const preview = useMutation({
    mutationFn: async (file: File) => {
      const csv = await file.text();
      return { csv, report: await importStudentsCsv(csv, true) };
    },
    onSuccess: setPending,
    onError: (e: Error) => message.error(e.message),
  });
  const commit = useMutation({
    mutationFn: () => importStudentsCsv(pending!.csv, false),
    onSuccess: (r) => {
      message.success(`Đã nhập ${r.created.length} học viên; bỏ qua ${r.duplicates.length} dòng trùng, ${r.errors.length} dòng lỗi.`);
      setPending(null);
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });
  const exportCsv = () => {
    const rows = students.data ?? [];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = ['Mã,Họ tên,Ngày sinh,Lớp,Trạng thái', ...rows.map((s) => [s.code, s.name, s.birthday, s.className, s.status].map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hoc-vien.csv';
    a.click();
    URL.revokeObjectURL(url);
    message.success('Đã xuất danh sách học viên.');
  };
  return (
    <Flex vertical gap={16} style={{ maxWidth: 640 }}>
      <Alert type="info" showIcon title="Nhập dữ liệu cần qua bước đối chiếu" description="Học viên trùng tên, số buổi chưa rõ và mã chương trình khác nhau phải được đối chiếu trước khi ghép. Nhập lặp không được nhân đôi dữ liệu; lô có lỗi phải báo rõ lô thành công và lô lỗi." />
      <Upload.Dragger
        accept=".csv"
        showUploadList={false}
        disabled={preview.isPending}
        beforeUpload={(file) => {
          preview.mutate(file);
          return false;
        }}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p>Kéo thả hoặc bấm để chọn tệp CSV học viên (cột: Họ tên, Ngày sinh, Phụ huynh, SĐT, Địa chỉ)</p>
        <p style={{ fontSize: 12, color: '#7b8499' }}>Hệ thống chạy thử và báo kết quả đối chiếu trước khi ghi. Tệp Excel: lưu thành CSV UTF-8 trước.</p>
      </Upload.Dragger>
      <Modal
        title="Kết quả đối chiếu trước khi nhập"
        open={!!pending}
        onCancel={() => setPending(null)}
        onOk={() => commit.mutate()}
        okText={`Nhập ${pending?.report.total ? pending.report.total - pending.report.duplicates.length - pending.report.errors.length : 0} học viên`}
        okButtonProps={{ disabled: !pending || pending.report.total - pending.report.duplicates.length - pending.report.errors.length === 0 }}
        cancelText="Hủy"
        confirmLoading={commit.isPending}
        width={640}
        destroyOnHidden
      >
        {pending && (
          <Flex vertical gap={12}>
            <Typography.Text>
              {pending.report.total} dòng · <b>{pending.report.total - pending.report.duplicates.length - pending.report.errors.length}</b> hợp lệ · {pending.report.duplicates.length} trùng · {pending.report.errors.length} lỗi
            </Typography.Text>
            {pending.report.errors.length > 0 && (
              <Table size="small" rowKey="row" pagination={false} scroll={{ y: 160 }} dataSource={pending.report.errors} columns={[{ title: 'Dòng', dataIndex: 'row', width: 70 }, { title: 'Lỗi', dataIndex: 'message' }]} />
            )}
            {pending.report.duplicates.length > 0 && (
              <Table
                size="small"
                rowKey="row"
                pagination={false}
                scroll={{ y: 160 }}
                dataSource={pending.report.duplicates}
                columns={[{ title: 'Dòng', dataIndex: 'row', width: 70 }, { title: 'Họ tên', dataIndex: 'name' }, { title: 'Trùng với', render: (_, d) => d.existingCode ?? 'dòng trước trong tệp' }]}
              />
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Dòng trùng (cùng họ tên và ngày sinh) không bị gộp tự động. Dòng lỗi được bỏ qua; sửa tệp rồi nhập lại phần còn thiếu — nhập lặp không nhân đôi.</Typography.Text>
          </Flex>
        )}
      </Modal>
      <Button icon={<DownloadOutlined />} onClick={exportCsv} loading={students.isLoading} style={{ alignSelf: 'flex-start' }}>
        Xuất danh sách học viên (CSV)
      </Button>
    </Flex>
  );
}

export function SettingsPage() {
  const user = useUser();
  return (
    <div className="fade-in">
      <PageHeader title="Cài đặt" subtitle="Tài khoản, ngày nghỉ trung tâm, cấu hình vận hành, nhập/xuất dữ liệu." />
      <Tabs
        items={[
          { key: 'staff', label: 'Nhân sự & vai trò', children: <Staff admin={user.roles.includes('admin')} /> },
          { key: 'holidays', label: 'Ngày nghỉ trung tâm', children: <Holidays /> },
          { key: 'config', label: 'Cấu hình', children: <Config /> },
          { key: 'data', label: 'Nhập / xuất dữ liệu', children: <DataTools /> },
        ]}
      />
    </div>
  );
}
