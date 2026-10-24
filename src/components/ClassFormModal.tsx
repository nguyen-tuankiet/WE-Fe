import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Checkbox, Form, Input, InputNumber, Modal, Select, Switch } from 'antd';
import { useEffect } from 'react';
import { createClass, listTeachers, updateClass, type ClassInput, type ClassRow } from '../api';
import { ROOMS, SLOTS } from '../mock/db';

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: d === 0 ? 'CN' : `Thứ ${d + 1}` }));

interface Props {
  open: boolean;
  /** có `editing` = sửa lớp, không có = tạo lớp mới */
  editing?: ClassRow | null;
  onClose: () => void;
}

type FormValues = Omit<ClassInput, 'teacherId'> & { teacherId?: string; active?: boolean };

export function ClassFormModal({ open, editing, onClose }: Props) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<FormValues>();
  const teachers = useQuery({ queryKey: ['teachers'], queryFn: listTeachers, enabled: open });

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        subject: editing.subject,
        slotId: editing.slotId,
        room: editing.room,
        teacherId: editing.teacherId || undefined,
        assistant: editing.assistant,
        maxSize: editing.maxSize,
        weekdays: editing.weekdays,
        active: editing.active,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ maxSize: 10, subject: '', assistant: '' });
    }
  }, [open, editing, form]);

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const { active, teacherId, ...rest } = v;
      const body = { ...rest, teacherId: teacherId ?? null };
      return editing ? updateClass(editing.id, { ...body, active }) : createClass(body);
    },
    onSuccess: (c) => {
      message.success(editing ? `Đã cập nhật lớp ${c.name}.` : `Đã tạo lớp ${c.name}.`);
      onClose();
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <Modal
      title={editing ? 'Sửa lớp' : 'Thêm lớp'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={editing ? 'Lưu' : 'Tạo lớp'}
      cancelText="Hủy"
      confirmLoading={save.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark={false}>
        <Form.Item name="name" label="Tên lớp" rules={[{ required: true, message: 'Nhập tên lớp' }]}>
          <Input placeholder="Ví dụ: Explorers 1 – T2/4/6 tối 1" />
        </Form.Item>
        <Form.Item name="subject" label="Môn / nhóm">
          <Input placeholder="Ví dụ: Kids Foundation" />
        </Form.Item>
        <Form.Item name="weekdays" label="Ngày học" rules={[{ required: true, message: 'Chọn ít nhất một ngày' }]}>
          <Checkbox.Group options={WEEKDAY_OPTIONS} />
        </Form.Item>
        <Form.Item name="slotId" label="Ca học" rules={[{ required: true, message: 'Chọn ca' }]}>
          <Select options={SLOTS.map((s) => ({ value: s.id, label: `${s.label} · ${s.time}` }))} />
        </Form.Item>
        <Form.Item name="room" label="Phòng" rules={[{ required: true, message: 'Chọn phòng' }]}>
          <Select options={ROOMS.map((r) => ({ value: r.id, label: `${r.id} (${r.floor})` }))} />
        </Form.Item>
        <Form.Item name="teacherId" label="Giáo viên">
          <Select allowClear placeholder="Chưa phân công" loading={teachers.isLoading} options={(teachers.data ?? []).map((t) => ({ value: t.id, label: t.name }))} />
        </Form.Item>
        <Form.Item name="assistant" label="Trợ giảng">
          <Input />
        </Form.Item>
        <Form.Item name="maxSize" label="Sĩ số tối đa" rules={[{ required: true, message: 'Nhập sĩ số' }]}>
          <InputNumber min={1} max={100} style={{ width: '100%' }} />
        </Form.Item>
        {editing && (
          <Form.Item name="active" label="Đang hoạt động" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
