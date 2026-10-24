import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, AutoComplete, DatePicker, Form, Input, Modal } from 'antd';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { updateStudent } from '../api';
import type { Student } from '../domain/types';

interface Values {
  name: string;
  birthday: dayjs.Dayjs;
  guardian: string;
  phone: string;
  address: string;
  tuitionMode: string;
  nextCourse: string;
  note: string;
}

/** Sửa hồ sơ học viên (Admin/Manager): họ tên, ngày sinh, liên hệ, hình thức đóng học phí, ghi chú. */
export function StudentEditModal({ student, open, onClose }: { student: Student; open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<Values>();

  useEffect(() => {
    if (open)
      form.setFieldsValue({
        name: student.name,
        birthday: dayjs(student.birthday),
        guardian: student.guardian,
        phone: student.phone,
        address: student.address,
        tuitionMode: student.tuitionMode,
        nextCourse: student.nextCourse,
        note: student.note,
      });
  }, [open, student, form]);

  const save = useMutation({
    mutationFn: (v: Values) =>
      updateStudent(student.id, {
        name: v.name,
        birthday: dayjs(v.birthday).format('YYYY-MM-DD'),
        guardian: v.guardian ?? '',
        phone: v.phone ?? '',
        address: v.address ?? '',
        tuitionMode: v.tuitionMode ?? '',
        nextCourse: v.nextCourse ?? '',
        note: v.note ?? '',
      }),
    onSuccess: () => {
      message.success('Đã cập nhật hồ sơ học viên.');
      onClose();
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <Modal title="Sửa hồ sơ học viên" open={open} onCancel={onClose} onOk={() => form.submit()} okText="Lưu" cancelText="Hủy" confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} onFinish={(v) => save.mutate(v)}>
        <Form.Item name="name" label="Họ tên học viên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="birthday" label="Ngày sinh" rules={[{ required: true, message: 'Chọn ngày sinh' }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={(d) => d.isAfter(dayjs())} />
        </Form.Item>
        <Form.Item name="guardian" label="Phụ huynh / người liên hệ">
          <Input />
        </Form.Item>
        <Form.Item name="phone" label="Số điện thoại (Zalo)" rules={[{ pattern: /^(0\d{9})?$/, message: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0' }]}>
          <Input inputMode="tel" />
        </Form.Item>
        <Form.Item name="address" label="Địa chỉ">
          <Input />
        </Form.Item>
        <Form.Item name="tuitionMode" label="Hình thức đóng học phí">
          <AutoComplete options={['WE', 'A.KHOA', 'Đóng theo tháng', 'Đóng theo khóa'].map((v) => ({ value: v }))} placeholder="Chọn hoặc nhập hình thức khác" />
        </Form.Item>
        <Form.Item name="nextCourse" label="Khóa tiếp theo dự kiến">
          <Input />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú riêng">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
