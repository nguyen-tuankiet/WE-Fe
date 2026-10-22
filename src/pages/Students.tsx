import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, DatePicker, Flex, Form, Input, Modal, Select, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createStudent, listClasses, listStudents, type NewStudent, type StudentRow } from '../api';
import { useUser } from '../auth/AuthContext';
import { canSeePrivate, isManagement, isTeacherOnly } from '../auth/permissions';
import { PageHeader } from '../components/PageHeader';
import { TABLE_PAGINATION } from '../components/pagination';
import { STUDENT_STATUS_COLOR, STUDENT_STATUS_LABEL, fmtDate } from '../i18n/vi';
import type { StudentStatus } from '../domain/types';

export function StudentsPage() {
  const user = useUser();
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StudentStatus | 'all'>('all');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const students = useQuery({ queryKey: ['students'], queryFn: listStudents });
  const classes = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const create = useMutation({
    mutationFn: (v: NewStudent) => createStudent(v),
    onSuccess: (s) => {
      message.success(`Đã tạo hồ sơ ${s.code} — ${s.name}`);
      setOpen(false);
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const privateOk = canSeePrivate(user.roles);
  const rows = useMemo(() => {
    const ownClasses = new Set((classes.data ?? []).filter((c) => c.teacherId === user.id).map((c) => c.name));
    const q = search.trim().toLowerCase();
    return (students.data ?? []).filter(
      (s) =>
        (!isTeacherOnly(user.roles) || ownClasses.has(s.className)) &&
        (status === 'all' || s.status === status) &&
        (!q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || (privateOk && s.phone.includes(q))),
    );
  }, [students.data, classes.data, search, status, user, privateOk]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Học viên"
        subtitle="Mỗi học viên có một hồ sơ thống nhất, liên kết với một hoặc nhiều khóa đăng ký."
        extra={
          isManagement(user.roles) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              Thêm học viên
            </Button>
          )
        }
      />
      <Flex gap={8} wrap style={{ marginBottom: 12 }}>
        <Input.Search
          allowClear
          placeholder={privateOk ? 'Tìm theo tên, mã, số điện thoại' : 'Tìm theo tên, mã'}
          style={{ width: 300, maxWidth: '100%' }}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={status}
          onChange={setStatus}
          style={{ width: 160 }}
          options={[
            { value: 'all', label: 'Mọi trạng thái' },
            { value: 'active', label: 'Đang học' },
            { value: 'reserved', label: 'Bảo lưu' },
            { value: 'left', label: 'Đã nghỉ' },
          ]}
        />
      </Flex>
      <Table<StudentRow>
        rowKey="id"
        loading={students.isLoading}
        dataSource={rows}
        scroll={{ x: 760 }}
        pagination={TABLE_PAGINATION}
        columns={[
          { title: 'Mã', dataIndex: 'code', width: 90 },
          {
            title: 'Học viên',
            dataIndex: 'name',
            render: (v, r) => (
              <Flex gap={6} align="center">
                <Link to={`/hoc-vien/${r.id}`}>{v}</Link>
                {r.star && <Tag color="gold">★ Ngưỡng riêng</Tag>}
              </Flex>
            ),
            sorter: (a, b) => a.name.localeCompare(b.name, 'vi'),
          },
          { title: 'Ngày sinh', dataIndex: 'birthday', render: fmtDate, width: 110 },
          { title: 'Lớp hiện tại', dataIndex: 'className' },
          ...(privateOk
            ? [
                { title: 'Phụ huynh', dataIndex: 'guardian' },
                { title: 'Điện thoại', dataIndex: 'phone' },
                { title: 'Học phí', dataIndex: 'tuitionMode', width: 110 },
              ]
            : []),
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 110,
            render: (s: StudentStatus) => <Tag color={STUDENT_STATUS_COLOR[s]}>{STUDENT_STATUS_LABEL[s]}</Tag>,
          },
        ]}
      />
      <Modal
        title="Thêm học viên"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="Tạo hồ sơ"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) => create.mutate({ ...v, birthday: dayjs(v.birthday).format('YYYY-MM-DD'), note: v.note ?? '', tuitionMode: v.tuitionMode ?? 'WE' })}
        >
          <Form.Item name="name" label="Họ tên học viên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="birthday" label="Ngày sinh" rules={[{ required: true, message: 'Chọn ngày sinh' }]}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs())} />
          </Form.Item>
          <Form.Item name="guardian" label="Phụ huynh / người liên hệ" rules={[{ required: true, message: 'Nhập người liên hệ' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại (Zalo)" rules={[{ required: true, message: 'Nhập số điện thoại' }, { pattern: /^0\d{9}$/, message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' }]}>
            <Input inputMode="tel" />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ" initialValue="TP. Thủ Đức, TP.HCM">
            <Input />
          </Form.Item>
          <Form.Item name="tuitionMode" label="Hình thức đóng học phí" initialValue="WE">
            <Select options={['WE', 'A.KHOA', 'Theo tháng'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú riêng">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Hai học viên trùng tên vẫn có mã riêng; không tự gộp hồ sơ, hãy đối chiếu ngày sinh hoặc phụ huynh.
        </Typography.Text>
      </Modal>
    </div>
  );
}
