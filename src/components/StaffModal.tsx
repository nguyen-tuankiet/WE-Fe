import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App, DatePicker, Form, Input, Modal, Select } from 'antd';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import { createStaff, updateStaff } from '../api';
import type { Role, Staff } from '../domain/types';
import { ROLE_LABEL } from '../i18n/vi';

interface Values {
  name: string;
  email?: string;
  pin?: string;
  roles: Role[];
  birthday?: dayjs.Dayjs | null;
}

const PIN_RULE = { pattern: /^\d{4,6}$/, message: 'PIN gồm 4–6 chữ số' };

/** Thêm nhân sự (Admin) hoặc sửa tên/vai trò/đặt lại PIN. Đổi PIN thu hồi mọi phiên đăng nhập cũ của người đó. */
export function StaffModal({ open, editing, onClose, presetRoles }: { open: boolean; editing?: Staff | null; onClose: () => void; presetRoles?: Role[] }) {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [form] = Form.useForm<Values>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editing) form.setFieldsValue({ name: editing.name, email: editing.email, roles: editing.roles, birthday: editing.birthday ? dayjs(editing.birthday) : null });
    else if (presetRoles) form.setFieldsValue({ roles: presetRoles });
  }, [open, editing, presetRoles, form]);

  const save = useMutation({
    mutationFn: (v: Values) =>
      editing
        ? updateStaff(editing.id, { name: v.name, roles: v.roles, birthday: v.birthday ? dayjs(v.birthday).format('YYYY-MM-DD') : null, ...(v.pin ? { pin: v.pin } : {}) })
        : createStaff({ email: v.email!, name: v.name, pin: v.pin!, roles: v.roles, birthday: v.birthday ? dayjs(v.birthday).format('YYYY-MM-DD') : null }),
    onSuccess: (s) => {
      message.success(editing ? `Đã cập nhật ${s.name}.` : `Đã tạo tài khoản ${s.email}.`);
      onClose();
      qc.invalidateQueries();
    },
    onError: (e: Error) => message.error(e.message),
  });

  return (
    <Modal title={editing ? 'Sửa nhân sự' : 'Thêm nhân sự'} open={open} onCancel={onClose} onOk={() => form.submit()} okText={editing ? 'Lưu' : 'Tạo tài khoản'} cancelText="Hủy" confirmLoading={save.isPending} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} requiredMark={false}>
        <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="birthday" label="Ngày sinh">
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày sinh" disabledDate={(d) => d.isAfter(dayjs())} />
        </Form.Item>
        <Form.Item name="email" label="Email đăng nhập" rules={editing ? [] : [{ required: true, message: 'Nhập email' }, { type: 'email', message: 'Email chưa hợp lệ' }]}>
          <Input disabled={!!editing} autoComplete="off" />
        </Form.Item>
        <Form.Item name="roles" label="Vai trò" extra="Một người có thể giữ nhiều vai trò." rules={[{ required: true, message: 'Chọn ít nhất một vai trò' }]}>
          <Select mode="multiple" options={(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        </Form.Item>
        <Form.Item
          name="pin"
          label={editing ? 'Đặt lại mã PIN (để trống nếu không đổi)' : 'Mã PIN (4–6 chữ số)'}
          rules={editing ? [PIN_RULE] : [{ required: true, message: 'Nhập mã PIN' }, PIN_RULE]}
        >
          <Input.Password maxLength={6} inputMode="numeric" autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
